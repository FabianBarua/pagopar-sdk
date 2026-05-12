import {
    PagoparApiError,
    PagoparNetworkError,
    PagoparWebhookSignatureError,
} from './errors.js';
import {
    sha1,
    tokenConsultarPedido,
    tokenFormasPago,
    tokenIniciarTransaccion,
    tokenPagoRecurrente,
    tokenWebhook,
} from './hash.js';
import type {
    AgregarClienteInput,
    AgregarClienteResultado,
    AgregarTarjetaInput,
    ConfirmarTarjetaInput,
    EliminarTarjetaInput,
    FormaPagoWS,
    IniciarTransaccionInput,
    IniciarTransaccionResultado,
    ListarTarjetasInput,
    PagarConTarjetaInput,
    PagoparResponse,
    PedidoEstado,
    TarjetaCatastrada,
} from './types.js';

export interface PagoparClientOptions {
    /** Clave pública del comercio (token_publico). */
    publicKey: string;
    /** Clave privada del comercio (token privado). NUNCA exponer en frontend. */
    privateKey: string;
    /**
     * URL base de la API. Default: producción.
     * Para sandbox/desarrollo, Pagopar provee un endpoint distinto que el
     * comercio recibe al solicitar acceso.
     */
    baseUrl?: string;
    /** Timeout en ms para cada request. Default: 15_000. */
    timeoutMs?: number;
    /** `fetch` personalizado (útil para tests / proxys). */
    fetch?: typeof fetch;
}

const DEFAULT_BASE_URL = 'https://api.pagopar.com';
const DEFAULT_TIMEOUT = 15_000;

/**
 * Cliente principal de Pagopar.
 *
 * Cubre el flujo estándar (iniciar transacción, consultar pedido, formas de
 * pago, validación de webhook) y expone un sub-cliente `recurrente` para
 * pagos recurrentes vía Bancard.
 *
 * @example
 * ```ts
 * const pagopar = new PagoparClient({
 *   publicKey: process.env.PAGOPAR_PUBLIC_KEY!,
 *   privateKey: process.env.PAGOPAR_PRIVATE_KEY!,
 * });
 *
 * const { data: hash } = await pagopar.iniciarTransaccion({ ... });
 * const checkoutUrl = pagopar.checkoutUrl(hash);
 * ```
 */
export class PagoparClient {
    public readonly publicKey: string;
    public readonly privateKey: string;
    public readonly baseUrl: string;
    public readonly timeoutMs: number;
    private readonly _fetch: typeof fetch;

    /** Sub-cliente para pagos recurrentes vía Bancard. */
    public readonly recurrente: RecurrenteClient;

    constructor(opts: PagoparClientOptions) {
        if (!opts.publicKey) throw new Error('publicKey es obligatorio');
        if (!opts.privateKey) throw new Error('privateKey es obligatorio');
        this.publicKey = opts.publicKey;
        this.privateKey = opts.privateKey;
        this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
        this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT;
        this._fetch = opts.fetch ?? fetch;
        this.recurrente = new RecurrenteClient(this);
    }

    /**
     * Crea un pedido en Pagopar.
     *
     * Devuelve `{ data, pedido }` — `data` es el hash con el que se construye
     * la URL de checkout y debe persistirse para consultas posteriores.
     *
     * @see https://soporte.pagopar.com/portal/es/kb/articles/api-integracion-medios-pagos
     */
    async iniciarTransaccion(
        input: IniciarTransaccionInput,
    ): Promise<IniciarTransaccionResultado> {
        const token = tokenIniciarTransaccion(
            this.privateKey,
            input.id_pedido_comercio,
            input.monto_total,
        );
        const body = {
            token,
            public_key: this.publicKey,
            tipo_pedido: 'VENTA-COMERCIO' as const,
            ...input,
        };
        const res = await this._post<
            Array<IniciarTransaccionResultado> | IniciarTransaccionResultado
        >('/api/comercios/2.0/iniciar-transaccion', body);
        // Pagopar devuelve resultado como array con un solo elemento.
        return Array.isArray(res) ? res[0]! : res;
    }

    /**
     * Construye la URL de checkout (a la que se debe redirigir al comprador)
     * a partir del hash del pedido devuelto por `iniciarTransaccion`.
     *
     * @param hashPedido el campo `data` retornado por `iniciarTransaccion`.
     * @param formaPago opcional — preselecciona la forma de pago en el checkout.
     */
    checkoutUrl(hashPedido: string, formaPago?: number): string {
        const url = `https://www.pagopar.com/pagos/${encodeURIComponent(hashPedido)}`;
        return formaPago != null ? `${url}?forma_pago=${formaPago}` : url;
    }

    /**
     * Consulta el estado actual de un pedido por su hash.
     * Endpoint: POST /api/pedidos/1.1/traer
     */
    async consultarPedido(hashPedido: string): Promise<PedidoEstado> {
        const body = {
            hash_pedido: hashPedido,
            token: tokenConsultarPedido(this.privateKey),
            token_publico: this.publicKey,
        };
        const res = await this._post<PedidoEstado[]>(
            '/api/pedidos/1.1/traer',
            body,
        );
        return res[0]!;
    }

    /**
     * Lista las formas de pago habilitadas para el comercio.
     * Endpoint: POST /api/forma-pago/1.1/traer/
     */
    async listarFormasPago(): Promise<FormaPagoWS[]> {
        const body = {
            token: tokenFormasPago(this.privateKey),
            token_publico: this.publicKey,
        };
        return this._post<FormaPagoWS[]>('/api/forma-pago/1.1/traer/', body);
    }

    /**
     * Verifica que la firma del webhook recibido provenga realmente de Pagopar.
     *
     * El comercio debe llamar este método **antes** de actualizar el estado
     * del pedido. Compara `sha1(privateKey + hash_pedido)` con el `token`
     * recibido en el payload.
     *
     * @returns `true` si la firma es válida, `false` en caso contrario.
     */
    verifyWebhookSignature(payload: {
        hash_pedido: string;
        token: string;
    }): boolean {
        const expected = tokenWebhook(this.privateKey, payload.hash_pedido);
        return safeEqual(expected, payload.token);
    }

    /**
     * Igual que `verifyWebhookSignature` pero arroja `PagoparWebhookSignatureError`
     * si la firma no coincide. Útil para usar en middlewares.
     */
    assertWebhookSignature(payload: {
        hash_pedido: string;
        token: string;
    }): void {
        if (!this.verifyWebhookSignature(payload)) {
            throw new PagoparWebhookSignatureError();
        }
    }

    /* =================================================================
     * HTTP helpers
     * ================================================================= */

    /** @internal */
    async _post<T>(path: string, body: unknown): Promise<T> {
        const url = `${this.baseUrl}${path}`;
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);

        let res: Response;
        try {
            res = await this._fetch(url, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(body),
                signal: ctrl.signal,
            });
        } catch (err) {
            throw new PagoparNetworkError(
                `Error de red al invocar ${path}: ${(err as Error).message}`,
                err,
            );
        } finally {
            clearTimeout(timer);
        }

        let json: PagoparResponse<T> | null = null;
        let raw: string | undefined;
        try {
            raw = await res.text();
            json = raw ? (JSON.parse(raw) as PagoparResponse<T>) : null;
        } catch {
            throw new PagoparApiError(
                `Respuesta no-JSON desde ${path} (HTTP ${res.status})`,
                { endpoint: path, status: res.status, raw },
            );
        }

        if (!res.ok) {
            throw new PagoparApiError(
                `Pagopar respondió HTTP ${res.status} en ${path}`,
                { endpoint: path, status: res.status, raw: json },
            );
        }

        if (!json || json.respuesta !== true) {
            const msg =
                typeof json?.resultado === 'string'
                    ? json.resultado
                    : 'Pagopar devolvió respuesta=false';
            throw new PagoparApiError(msg, {
                endpoint: path,
                resultado: json?.resultado,
                status: res.status,
                raw: json,
            });
        }

        return json.resultado;
    }
}

/**
 * Sub-cliente para los endpoints de pagos recurrentes vía Bancard.
 *
 * Todos comparten la misma fórmula de token: `sha1(privateKey + "PAGO-RECURRENTE")`.
 *
 * @see https://soporte.pagopar.com/portal/es/kb/articles/pagos-recurrentes-vía-bancard-pagopar
 */
export class RecurrenteClient {
    constructor(private readonly client: PagoparClient) { }

    private baseBody() {
        return {
            token: tokenPagoRecurrente(this.client.privateKey),
            token_publico: this.client.publicKey,
        };
    }

    /** Crea un cliente/comprador asociado al comercio. */
    agregarCliente(
        input: AgregarClienteInput,
    ): Promise<AgregarClienteResultado> {
        return this.client._post<AgregarClienteResultado>(
            '/api/pago-recurrente/1.1/agregar-cliente/',
            { ...this.baseBody(), ...input },
        );
    }

    /**
     * Solicita a Pagopar el ID de proceso para iniciar el catastro de una
     * tarjeta. El string retornado se pasa al iframe de Bancard
     * (`Bancard.Cards.createForm(...)`).
     */
    agregarTarjeta(input: AgregarTarjetaInput): Promise<string> {
        return this.client._post<string>(
            '/api/pago-recurrente/1.1/agregar-tarjeta/',
            { ...this.baseBody(), ...input },
        );
    }

    /**
     * Confirma el catastro de la(s) tarjeta(s). Debe invocarse SIEMPRE al
     * volver desde el iframe de Bancard, sin importar si el catastro fue
     * exitoso o no.
     */
    confirmarTarjeta(input: ConfirmarTarjetaInput): Promise<unknown> {
        return this.client._post<unknown>(
            '/api/pago-recurrente/1.1/confirmar-tarjeta/',
            { ...this.baseBody(), ...input },
        );
    }

    /**
     * Lista las tarjetas catastradas de un usuario.
     * El `alias_token` retornado es **temporal** — re-llamar este endpoint
     * cada vez que se necesite pagar o eliminar una tarjeta.
     */
    listarTarjetas(
        input: ListarTarjetasInput,
    ): Promise<TarjetaCatastrada[]> {
        return this.client._post<TarjetaCatastrada[]>(
            '/api/pago-recurrente/2.0/listar-tarjeta/',
            { ...this.baseBody(), ...input },
        );
    }

    /** Elimina una tarjeta catastrada. `tarjeta` es el `alias_token`. */
    eliminarTarjeta(input: EliminarTarjetaInput): Promise<string> {
        return this.client._post<string>(
            '/api/pago-recurrente/2.0/eliminar-tarjeta/',
            { ...this.baseBody(), ...input },
        );
    }

    /**
     * Cobra un pedido previamente creado utilizando una tarjeta catastrada.
     * Requiere que `iniciarTransaccion` se haya ejecutado antes para obtener
     * `hash_pedido`, y que `listarTarjetas` se haya invocado para obtener un
     * `alias_token` fresco.
     */
    pagar(input: PagarConTarjetaInput): Promise<unknown> {
        return this.client._post<unknown>('/api/pago-recurrente/2.0/pagar/', {
            ...this.baseBody(),
            ...input,
        });
    }
}

/** Comparación constant-time para hashes hexadecimales. */
function safeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
        diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diff === 0;
}

// Re-export para conveniencia
export { sha1 };
