import { createHash } from 'node:crypto';

/**
 * Genera un hash SHA1 en hexadecimal del valor proporcionado.
 * Pagopar utiliza siempre SHA1 para firmar los tokens de cada endpoint.
 */
export function sha1(value: string): string {
  return createHash('sha1').update(value, 'utf8').digest('hex');
}

/**
 * Token para el endpoint `iniciar-transaccion`.
 *
 * Fórmula: sha1(privateKey + idPedidoComercio + floatval(montoTotal))
 *
 * IMPORTANTE: `idPedidoComercio` es alfanumérico — debe ser EXACTAMENTE el
 * mismo string enviado en `id_pedido_comercio` (no es lo mismo "01" que "1").
 *
 * `montoTotal` se normaliza usando `floatval` de PHP. En JS replicamos eso:
 * un número entero como 100000 se convierte a "100000", uno con decimales
 * como 100.5 se convierte a "100.5".
 */
export function tokenIniciarTransaccion(
  privateKey: string,
  idPedidoComercio: string | number,
  montoTotal: number,
): string {
  return sha1(`${privateKey}${idPedidoComercio}${floatval(montoTotal)}`);
}

/** Token para el endpoint `pedidos/1.1/traer` (consultar estado del pedido). */
export function tokenConsultarPedido(privateKey: string): string {
  return sha1(`${privateKey}CONSULTA`);
}

/** Token para el endpoint `forma-pago/1.1/traer`. */
export function tokenFormasPago(privateKey: string): string {
  return sha1(`${privateKey}FORMA-PAGO`);
}

/** Token para todos los endpoints de pagos recurrentes vía Bancard. */
export function tokenPagoRecurrente(privateKey: string): string {
  return sha1(`${privateKey}PAGO-RECURRENTE`);
}

/**
 * Token con el que Pagopar firma la notificación (webhook) de un pedido.
 * Fórmula: sha1(privateKey + hashPedido)
 */
export function tokenWebhook(privateKey: string, hashPedido: string): string {
  return sha1(`${privateKey}${hashPedido}`);
}

/**
 * Replica el comportamiento de `strval(floatval($monto))` de PHP, que es
 * lo que la documentación oficial de Pagopar utiliza para construir el
 * token de `iniciar-transaccion`.
 *
 * Ejemplos:
 *   100000   -> "100000"
 *   100000.0 -> "100000"
 *   100.5    -> "100.5"
 *   "100"    -> "100"
 */
export function floatval(value: number | string): string {
  const n = typeof value === 'number' ? value : parseFloat(value);
  if (!Number.isFinite(n)) return '0';
  // PHP no agrega ".0" a enteros: floatval(100000) -> "100000"
  return Number.isInteger(n) ? n.toFixed(0) : String(n);
}
