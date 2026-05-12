# Migraciones de base de datos

Estas migraciones replican el esquema del paquete oficial
[`bypersoft/laravel-pagopar`](https://bitbucket.org/bypersoft/laravel-pagopar/src/master/)
y agregan una tabla `pagopar_api_logs` para almacenar **todos los requests
enviados y responses recibidos** desde y hacia la API de Pagopar (útil para
auditoría, conciliación y depuración).

Están escritas para [**Knex**](https://knexjs.org/) (compatible con
PostgreSQL, MySQL, MariaDB, SQLite y MSSQL). Si usás otro stack (Prisma,
TypeORM, Drizzle, SQL plano…), pueden servir como referencia del esquema.

## Tablas

| Tabla | Origen | Propósito |
| --- | --- | --- |
| `pagopar_compradores` | laravel-pagopar | Datos del comprador reusables entre pedidos |
| `pagopar_pedidos` | laravel-pagopar | Pedido enviado a `iniciar-transaccion` + estado actual |
| `pagopar_detalles_pedido` | laravel-pagopar | Items de cada pedido |
| `pagopar_reversas` | laravel-pagopar | Pagos reversados sin confirmación |
| `pagopar_api_logs` | **nuevo** | Bitácora request/response con Pagopar |

## Cómo correr

```bash
npm install --save-dev knex pg     # o mysql2, sqlite3, etc.
npx knex migrate:latest --migrations-directory ./migrations
```

`knexfile.js` mínimo:

```js
module.exports = {
  client: 'pg',
  connection: process.env.DATABASE_URL,
  migrations: { directory: './migrations' },
};
```

## Cómo se llena `pagopar_api_logs`

Envolvé las llamadas del SDK con un wrapper que persiste el intercambio:

```ts
import { PagoparClient, PagoparApiError } from 'pagopar-sdk';
import { db } from './db';

async function logged<T>(
  endpoint: string,
  request: unknown,
  fn: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();
  try {
    const result = await fn();
    await db('pagopar_api_logs').insert({
      direction: 'outgoing',
      endpoint,
      method: 'POST',
      request_body: JSON.stringify(request),
      response_body: JSON.stringify(result),
      http_status: 200,
      duration_ms: Date.now() - startedAt,
      ok: true,
    });
    return result;
  } catch (err) {
    await db('pagopar_api_logs').insert({
      direction: 'outgoing',
      endpoint,
      method: 'POST',
      request_body: JSON.stringify(request),
      response_body: err instanceof PagoparApiError ? JSON.stringify(err.raw) : null,
      http_status: err instanceof PagoparApiError ? err.status ?? null : null,
      duration_ms: Date.now() - startedAt,
      ok: false,
      error_message: (err as Error).message,
    });
    throw err;
  }
}
```

Y para webhooks (`direction = 'incoming'`):

```ts
import crypto from 'node:crypto';

app.post('/pagopar/webhook', async (req, res) => {
  const payload = req.body?.resultado?.[0];
  if (!pagopar.verifyWebhookSignature(payload)) return res.status(401).end();

  const idempotencyKey = crypto
    .createHash('sha1')
    .update(`${payload.hash_pedido}|${payload.fecha_pago}|${payload.numero_comprobante_interno ?? ''}`)
    .digest('hex');

  // Inserta sólo si no existía (UNIQUE en idempotency_key)
  const inserted = await db('pagopar_api_logs')
    .insert({
      direction: 'incoming',
      endpoint: '/pagopar/webhook',
      method: 'POST',
      request_body: JSON.stringify(req.body),
      ok: true,
      hash_pedido: payload.hash_pedido,
      idempotency_key: idempotencyKey,
    })
    .onConflict('idempotency_key')
    .ignore()
    .returning('id');

  if (inserted.length === 0) {
    // Ya procesado: respondé 200 igual para que Pagopar no reintente
    return res.status(200).json(req.body.resultado);
  }

  // … aquí actualizás pagopar_pedidos.estado, etc.
  return res.status(200).json(req.body.resultado);
});
```
