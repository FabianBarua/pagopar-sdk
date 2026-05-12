/* eslint-disable @typescript-eslint/no-explicit-any */

/** IDs de las formas de pago soportadas por Pagopar. */
export const FORMA_PAGO = {
    BANCARD: 9,
    PROCARD: 1,
    AQUI_PAGO: 2,
    PAGO_EXPRESS: 3,
    PRACTIPAGO: 4,
    TIGO_MONEY: 10,
    TRANSFERENCIA_BANCARIA: 11,
    BILLETERA_PERSONAL: 12,
    PAGO_MOVIL: 13,
    INFONET_COBRANZAS: 15,
    ZIMPLE: 18,
    WALLY: 20,
    WEPA: 22,
    GIROS_CLARO: 23,
    PAGO_QR: 24,
    PIX: 25,
} as const;

export type FormaPagoId = (typeof FORMA_PAGO)[keyof typeof FORMA_PAGO];

/** Comprador del pedido. */
export interface Comprador {
    ruc: string;
    email: string;
    /** Si no usás couriers, enviar siempre "1". */
    ciudad: string | null;
    nombre: string;
    /** Formato internacional, ej "+595971111234". */
    telefono: string;
    direccion: string;
    documento: string;
    coordenadas?: string;
    razon_social: string;
    /** Por el momento siempre "CI". */
    tipo_documento: 'CI';
    direccion_referencia?: string | null;
}

/** Item de la lista de productos del pedido. */
export interface CompraItem {
    /** Si no usás couriers, enviar "1". */
    ciudad: string;
    nombre: string;
    cantidad: number;
    /** Si no usás couriers, enviar "909". */
    categoria: string;
    /** Igual que el `public_key` del comercio, salvo split billing. */
    public_key: string;
    url_imagen: string;
    descripcion: string;
    id_producto: number | string;
    /** Total agrupado por producto, en guaraníes. */
    precio_total: number;
    vendedor_telefono?: string;
    vendedor_direccion?: string;
    vendedor_direccion_referencia?: string;
    vendedor_direccion_coordenadas?: string;
}

/** Payload para `iniciar-transaccion`. El SDK calcula `token` y `public_key`. */
export interface IniciarTransaccionInput {
    comprador: Comprador;
    /** Monto total del pedido en guaraníes (PYG). */
    monto_total: number;
    /** "VENTA-COMERCIO" o "COMERCIO-HEREDADO" (split billing). */
    tipo_pedido?: 'VENTA-COMERCIO' | 'COMERCIO-HEREDADO';
    compras_items: CompraItem[];
    /** Formato 'YYYY-MM-DD HH:mm:ss'. */
    fecha_maxima_pago: string;
    /** ID único del pedido en el sistema del comercio (alfanumérico). */
    id_pedido_comercio: string;
    descripcion_resumen?: string;
    /** ID de forma de pago para preselección (ver `FORMA_PAGO`). */
    forma_pago?: FormaPagoId | number;
}

export interface IniciarTransaccionResultado {
    /** Hash del pedido — guardar en BD, sirve para construir la URL de checkout. */
    data: string;
    /** Número de pedido informativo. */
    pedido: string;
}

export interface PedidoEstado {
    pagado: boolean;
    forma_pago: string;
    fecha_pago: string | null;
    monto: string;
    fecha_maxima_pago: string;
    hash_pedido: string;
    numero_pedido: string;
    cancelado: boolean;
    forma_pago_identificador: string;
    token: string;
    numero_comprobante_interno?: string | null;
    ultimo_mensaje_error?: string | null;
    mensaje_resultado_pago?: {
        titulo: string;
        descripcion: string;
    };
}

export interface FormaPagoWS {
    forma_pago: string;
    titulo: string;
    descripcion: string;
    monto_minimo: string;
    porcentaje_comision: string;
    pagos_internacionales?: boolean;
}

/** Estructura genérica de respuesta de Pagopar. */
export interface PagoparResponse<T> {
    respuesta: boolean;
    resultado: T;
}

/* ===========================================================
 * Pagos recurrentes vía Bancard
 * =========================================================== */

export interface AgregarClienteInput {
    /** ID del usuario en el sistema del comercio. No debe repetirse. */
    identificador: number | string;
    nombre_apellido: string;
    email: string;
    celular: string;
}

export interface AgregarClienteResultado {
    id_comprador_comercio: string;
    nombres_apellidos: string;
    email: string;
    celular: string;
}

export interface AgregarTarjetaInput {
    /** ID del usuario al que se asociará la tarjeta. */
    identificador: number | string;
    /** URL a la cual Bancard redireccionará al completar el catastro. */
    url: string;
}

export interface ConfirmarTarjetaInput {
    identificador: number | string;
    /** Misma URL utilizada en `agregarTarjeta`. */
    url: string;
}

export interface ListarTarjetasInput {
    identificador: number | string;
}

export interface TarjetaCatastrada {
    tarjeta: string;
    url_logo: string;
    /** Ej: "541863******1234" */
    tarjeta_numero: string;
    /** Hash temporal de la tarjeta — se usa para pagar o eliminar. */
    alias_token: string;
}

export interface EliminarTarjetaInput {
    identificador: number | string;
    /** `alias_token` obtenido en `listarTarjetas`. */
    tarjeta: string;
}

export interface PagarConTarjetaInput {
    identificador: number | string;
    /** `data` (hash del pedido) obtenido al iniciar la transacción. */
    hash_pedido: string;
    /** `alias_token` obtenido en `listarTarjetas`. */
    tarjeta: string;
}
