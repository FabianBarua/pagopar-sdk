/**
 * Error genérico cuando Pagopar responde con `respuesta: false`.
 */
export class PagoparApiError extends Error {
    /** Mensaje de error tal como lo devolvió Pagopar en `resultado`. */
    public readonly resultado: unknown;
    /** URL del endpoint invocado. */
    public readonly endpoint: string;
    /** HTTP status si la respuesta fue HTTP error. */
    public readonly status?: number;
    /** Cuerpo crudo de la respuesta (útil para depurar). */
    public readonly raw?: unknown;

    constructor(
        message: string,
        opts: {
            endpoint: string;
            resultado?: unknown;
            status?: number;
            raw?: unknown;
        },
    ) {
        super(message);
        this.name = 'PagoparApiError';
        this.endpoint = opts.endpoint;
        this.resultado = opts.resultado;
        this.status = opts.status;
        this.raw = opts.raw;
    }
}

/** Error de red / problemas al ejecutar el fetch. */
export class PagoparNetworkError extends Error {
    public readonly cause?: unknown;
    constructor(message: string, cause?: unknown) {
        super(message);
        this.name = 'PagoparNetworkError';
        this.cause = cause;
    }
}

/** Error de validación del webhook (firma inválida). */
export class PagoparWebhookSignatureError extends Error {
    constructor(message = 'Firma del webhook inválida') {
        super(message);
        this.name = 'PagoparWebhookSignatureError';
    }
}
