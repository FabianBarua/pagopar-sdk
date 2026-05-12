# pagopar-sdk

SDK no oficial de **[Pagopar](https://www.pagopar.com/)** para **Node.js / TypeScript**.

Cubre el flujo completo de la pasarela paraguaya:

- ✅ **Iniciar transacción** (`/api/comercios/2.0/iniciar-transaccion`)
- ✅ **Consultar estado del pedido** (`/api/pedidos/1.1/traer`)
- ✅ **Listar formas de pago** (`/api/forma-pago/1.1/traer/`)
- ✅ **Validación segura del webhook** (firma SHA1 con timing-safe compare)
- ✅ **Pagos recurrentes vía Bancard**: `agregar-cliente`, `agregar-tarjeta`, `confirmar-tarjeta`, `listar-tarjeta`, `eliminar-tarjeta`, `pagar`
- ✅ Tipado completo en TypeScript, sin dependencias externas
- ✅ Funciona en Node 18+ (usa `fetch` nativo)

---

## Tabla de contenidos

- [Instalación](#instalación)
- [Configuración](#configuración)
- [Uso rápido](#uso-rápido)
- [Casos de uso](#casos-de-uso)
  - [1. Checkout único (e-commerce)](#1-checkout-único-e-commerce)
  - [2. Integración paso a paso con Express.js](#2-integración-paso-a-paso-con-expressjs)
  - [3. Webhook seguro de notificación de pago](#3-webhook-seguro-de-notificación-de-pago)
  - [4. Página de resultado para el cliente](#4-página-de-resultado-para-el-cliente)
  - [5. Suscripciones / cobros recurrentes con tarjeta](#5-suscripciones--cobros-recurrentes-con-tarjeta)
  - [6. Mostrar las tarjetas guardadas del usuario](#6-mostrar-las-tarjetas-guardadas-del-usuario)
  - [7. Listar formas de pago dinámicamente](#7-listar-formas-de-pago-dinámicamente)
  - [8. Reintentos y manejo de errores](#8-reintentos-y-manejo-de-errores)
- [Helpers de bajo nivel](#helpers-de-bajo-nivel)
- [Formas de pago disponibles](#formas-de-pago-disponibles)
- [Sandbox / entornos](#sandbox--entornos)
- [Persistencia / migraciones](#persistencia--migraciones)
- [Errores comunes](#errores-comunes)
---

## Instalación

```bash
npm install pagopar-sdk
# o
pnpm add pagopar-sdk
# o
yarn add pagopar-sdk
```

---

## Configuración

Necesitás dos claves que obtenés en **Pagopar.com → "Integrar con mi sitio web"**:

| Variable | Descripción |
| --- | --- |
| `PAGOPAR_PUBLIC_KEY` | `token_publico` del comercio. Puede aparecer en frontends. |
| `PAGOPAR_PRIVATE_KEY` | Token privado. **NUNCA** debe exponerse al cliente. |

En la misma sección de Pagopar.com también configurá:

- **URL de respuesta (webhook)** → `https://tu-sitio.com/pagopar/webhook`
- **URL de resultado (redirección)** → `https://tu-sitio.com/pagopar/resultado`

---

## Uso rápido

```ts
import { PagoparClient, FORMA_PAGO } from 'pagopar-sdk';

const pagopar = new PagoparClient({
  publicKey: process.env.PAGOPAR_PUBLIC_KEY!,
  privateKey: process.env.PAGOPAR_PRIVATE_KEY!,
});

// 1. Crear el pedido
const { data: hashPedido } = await pagopar.iniciarTransaccion({
  id_pedido_comercio: 'PED-001',
  monto_total: 100_000,
  fecha_maxima_pago: '2026-12-31 23:59:59',
  descripcion_resumen: 'Suscripción mensual',
  forma_pago: FORMA_PAGO.BANCARD,
  comprador: {
    ruc: '1234567-8',
    email: 'cliente@example.com',
    ciudad: '1',
    nombre: 'Juan Pérez',
    telefono: '+595981234567',
    direccion: '',
    documento: '1234567',
    razon_social: 'Juan Pérez',
    tipo_documento: 'CI',
  },
  compras_items: [
    {
      ciudad: '1',
      nombre: 'Suscripción',
      cantidad: 1,
      categoria: '909',
      public_key: process.env.PAGOPAR_PUBLIC_KEY!,
      url_imagen: '',
      descripcion: 'Suscripción mensual',
      id_producto: 1,
      precio_total: 100_000,
    },
  ],
});

// 2. Redirigir al checkout
const checkoutUrl = pagopar.checkoutUrl(hashPedido, FORMA_PAGO.BANCARD);
// res.redirect(checkoutUrl)

// 3. Más tarde: consultar estado
const estado = await pagopar.consultarPedido(hashPedido);
console.log(estado.pagado, estado.monto, estado.forma_pago);
```

---

## Casos de uso

### 1. Checkout único (e-commerce)

Función reutilizable que recibe los datos del carrito y devuelve la URL a la
que hay que redirigir al usuario.

```ts
import { PagoparClient, type CompraItem } from 'pagopar-sdk';

const pagopar = new PagoparClient({
  publicKey: process.env.PAGOPAR_PUBLIC_KEY!,
  privateKey: process.env.PAGOPAR_PRIVATE_KEY!,
});

interface CarritoInput {
  orderId: string;             // tu ID interno único, alfanumérico
  total: number;               // PYG, sin decimales
  email: string;
  nombre: string;
  documento: string;
  items: Array<{ id: string | number; nombre: string; precio: number; cantidad: number }>;
}

export async function generarCheckoutUrl(carrito: CarritoInput): Promise<string> {
  const compras_items: CompraItem[] = carrito.items.map((it) => ({
    ciudad: '1',
    nombre: it.nombre,
    cantidad: it.cantidad,
    categoria: '909',
    public_key: process.env.PAGOPAR_PUBLIC_KEY!,
    url_imagen: '',
    descripcion: it.nombre,
    id_producto: it.id,
    precio_total: it.precio * it.cantidad,
  }));

  const { data: hashPedido } = await pagopar.iniciarTransaccion({
    id_pedido_comercio: carrito.orderId,
    monto_total: carrito.total,
    fecha_maxima_pago: enHoras(48),
    descripcion_resumen: `Pedido ${carrito.orderId}`,
    comprador: {
      ruc: '',
      email: carrito.email,
      ciudad: '1',
      nombre: carrito.nombre,
      telefono: '',
      direccion: '',
      documento: carrito.documento,
      razon_social: carrito.nombre,
      tipo_documento: 'CI',
    },
    compras_items,
  });

  // Persistí la relación orderId ↔ hashPedido en tu BD ANTES de redirigir
  // await db.orders.update(carrito.orderId, { pagoparHash: hashPedido });

  return pagopar.checkoutUrl(hashPedido);
}

function enHoras(h: number): string {
  const d = new Date(Date.now() + h * 3600_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
```

---

### 2. Integración paso a paso con Express.js

Aplicación Express completa que cubre los 4 pasos del flujo Pagopar.

```ts
// server.ts
import express, { Request, Response } from 'express';
import {
  PagoparClient,
  PagoparApiError,
  PagoparWebhookSignatureError,
  FORMA_PAGO,
} from 'pagopar-sdk';

const pagopar = new PagoparClient({
  publicKey: process.env.PAGOPAR_PUBLIC_KEY!,
  privateKey: process.env.PAGOPAR_PRIVATE_KEY!,
});

const app = express();
app.use(express.json());

// "BD" en memoria para el ejemplo
const pedidos = new Map<string, { orderId: string; pagado: boolean; monto: number }>();

// ── Paso 1: el comercio crea el pedido y redirige al checkout ─────────────
app.post('/checkout', async (req: Request, res: Response) => {
  const orderId = `PED-${Date.now()}`;
  const monto = 100_000;

  try {
    const { data: hashPedido } = await pagopar.iniciarTransaccion({
      id_pedido_comercio: orderId,
      monto_total: monto,
      fecha_maxima_pago: '2026-12-31 23:59:59',
      forma_pago: FORMA_PAGO.BANCARD,
      comprador: {
        ruc: '1234567-8',
        email: 'cliente@example.com',
        ciudad: '1',
        nombre: 'Juan Pérez',
        telefono: '+595981234567',
        direccion: '',
        documento: '1234567',
        razon_social: 'Juan Pérez',
        tipo_documento: 'CI',
      },
      compras_items: [
        {
          ciudad: '1',
          nombre: 'Producto demo',
          cantidad: 1,
          categoria: '909',
          public_key: process.env.PAGOPAR_PUBLIC_KEY!,
          url_imagen: '',
          descripcion: 'Producto demo',
          id_producto: 1,
          precio_total: monto,
        },
      ],
    });

    pedidos.set(hashPedido, { orderId, pagado: false, monto });
    return res.redirect(pagopar.checkoutUrl(hashPedido, FORMA_PAGO.BANCARD));
  } catch (err) {
    if (err instanceof PagoparApiError) {
      return res.status(400).json({ error: err.message, detalle: err.resultado });
    }
    throw err;
  }
});

// ── Paso 3: webhook server-to-server ──────────────────────────────────────
app.post('/pagopar/webhook', (req: Request, res: Response) => {
  const payload = req.body?.resultado?.[0];
  if (!payload) return res.status(400).send('Payload inválido');

  try {
    pagopar.assertWebhookSignature(payload);
  } catch (err) {
    if (err instanceof PagoparWebhookSignatureError) {
      return res.status(401).send('Firma inválida');
    }
    throw err;
  }

  const pedido = pedidos.get(payload.hash_pedido);
  if (pedido) pedido.pagado = payload.pagado === true;

  // Pagopar espera el contenido de `resultado` tal cual; si no recibe HTTP 200
  // reintenta cada 10 minutos.
  return res.status(200).json(req.body.resultado);
});

// ── Paso 4: página de resultado tras la redirección ───────────────────────
app.get('/pagopar/resultado', async (req: Request, res: Response) => {
  const hashPedido = String(req.query.hash_pedido ?? '');
  if (!hashPedido) return res.status(400).send('Falta hash_pedido');

  const estado = await pagopar.consultarPedido(hashPedido);
  res.send(`
    <h1>${estado.pagado ? '✓ Pago confirmado' : '⏳ Pendiente'}</h1>
    <p><b>Pedido:</b> ${estado.numero_pedido}</p>
    <p><b>Monto:</b> Gs. ${estado.monto}</p>
    <p><b>Forma de pago:</b> ${estado.forma_pago}</p>
  `);
});

app.listen(3000, () => console.log('▶ http://localhost:3000'));
```

> 💡 Para testear el webhook localmente, exponé el puerto con `ngrok http 3000`
> y configurá esa URL pública como **URL de respuesta** en Pagopar.com.

---

### 3. Webhook seguro de notificación de pago

El paso más crítico. **SIEMPRE** validá la firma antes de tocar la BD —
de lo contrario cualquiera podría marcar pedidos como pagados.

```ts
import { PagoparWebhookSignatureError } from 'pagopar-sdk';

app.post('/pagopar/webhook', async (req, res) => {
  const payload = req.body?.resultado?.[0];
  if (!payload) return res.status(400).send('payload inválido');

  // Comparación timing-safe de sha1(privateKey + hash_pedido)
  if (!pagopar.verifyWebhookSignature(payload)) {
    return res.status(401).send('firma inválida');
  }

  // Idempotencia: si ya procesamos este evento, no hacer nada.
  const ya = await db.webhooks.findByHash(payload.hash_pedido, payload.fecha_pago);
  if (ya) return res.status(200).json(req.body.resultado);

  await db.transaction(async (tx) => {
    if (payload.pagado === true) {
      await tx.orders.markPaid(payload.hash_pedido, {
        comprobante: payload.numero_comprobante_interno,
        formaPago: payload.forma_pago,
        fechaPago: payload.fecha_pago,
      });
    } else {
      await tx.orders.markReversed(payload.hash_pedido);
    }
    await tx.webhooks.save(payload);
  });

  res.status(200).json(req.body.resultado);
});
```

---

### 4. Página de resultado para el cliente

Cuando el cliente termina (o cancela) el pago, Pagopar lo redirige a la
URL configurada. Conviene **consultar el estado en vivo** en lugar de fiarse
sólo del query string.

```ts
app.get('/pagopar/resultado', async (req, res) => {
  const hashPedido = String(req.query.hash_pedido ?? '');
  const estado = await pagopar.consultarPedido(hashPedido);

  if (estado.pagado) {
    return res.render('pago-exitoso', { estado });
  }
  if (estado.cancelado) {
    return res.render('pago-cancelado', { estado });
  }
  // Pendiente (típico de Aqui Pago / Pago Express / Transferencia)
  return res.render('pago-pendiente', {
    estado,
    instrucciones: estado.mensaje_resultado_pago?.descripcion,
  });
});
```

---

### 5. Suscripciones / cobros recurrentes con tarjeta

Permite cobrar a una tarjeta previamente catastrada, sin que el usuario vuelva
a ingresar los datos. Útil para suscripciones, renovaciones, etc.

> **Requisito:** solicitar habilitación a `administracion@pagopar.com` y haber
> implementado el flujo estándar.

#### 5.1. Registrar al cliente (una vez por usuario)

```ts
await pagopar.recurrente.agregarCliente({
  identificador: user.id,           // ID en TU sistema, único e inmutable
  nombre_apellido: user.fullName,
  email: user.email,
  celular: user.phone,
});
```

#### 5.2. Catastrar una tarjeta nueva (frontend + backend)

**Backend** — generar el `processId`:

```ts
app.post('/tarjetas/nueva', async (req, res) => {
  const processId = await pagopar.recurrente.agregarTarjeta({
    identificador: req.user.id,
    url: 'https://mi-sitio.com/tarjetas/callback',
  });
  res.json({ processId });
});
```

**Frontend** — montar el iframe de Bancard:

```html
<script src="bancard-checkout-2.1.0.js"></script>
<div id="iframe-container" style="height:130px;width:100%"></div>
<script>
  fetch('/tarjetas/nueva', { method: 'POST' })
    .then((r) => r.json())
    .then(({ processId }) => {
      Bancard.Cards.createForm('iframe-container', processId, { styles: {} });
    });
</script>
```

**Backend** — al volver del iframe, **siempre** confirmar (haya éxito o no):

```ts
app.get('/tarjetas/callback', async (req, res) => {
  await pagopar.recurrente.confirmarTarjeta({
    identificador: req.user.id,
    url: 'https://mi-sitio.com/tarjetas/callback',
  });

  if (req.query.status === 'add_new_card_success') {
    return res.redirect('/perfil/tarjetas?ok=1');
  }
  return res.redirect(`/perfil/tarjetas?error=${encodeURIComponent(String(req.query.description ?? ''))}`);
});
```

#### 5.3. Cobrar una suscripción periódica (cron mensual)

```ts
import { PagoparApiError } from 'pagopar-sdk';

export async function cobrarSuscripcionMensual(userId: number) {
  // 1. El alias_token caduca; obtené uno fresco siempre antes de pagar
  const tarjetas = await pagopar.recurrente.listarTarjetas({ identificador: userId });
  if (tarjetas.length === 0) throw new Error('Usuario sin tarjetas catastradas');

  const tarjeta = tarjetas[0]; // o la marcada como "default" en tu BD

  // 2. Crear el pedido
  const orderId = `SUB-${userId}-${new Date().toISOString().slice(0, 7)}`; // SUB-42-2026-05
  const { data: hashPedido } = await pagopar.iniciarTransaccion({
    id_pedido_comercio: orderId,
    monto_total: 50_000,
    fecha_maxima_pago: '2026-12-31 23:59:59',
    descripcion_resumen: 'Suscripción mensual',
    comprador: { /* datos del usuario */ } as any,
    compras_items: [/* ... */] as any,
  });

  // 3. Cobrar con la tarjeta catastrada
  try {
    await pagopar.recurrente.pagar({
      identificador: userId,
      hash_pedido: hashPedido,
      tarjeta: tarjeta.alias_token,
    });
    return { ok: true, hashPedido };
  } catch (err) {
    if (err instanceof PagoparApiError) {
      // Notificar al usuario, marcar la suscripción como vencida, etc.
      return { ok: false, motivo: String(err.resultado) };
    }
    throw err;
  }
}
```

#### 5.4. Eliminar una tarjeta

```ts
app.delete('/perfil/tarjetas/:aliasToken', async (req, res) => {
  // El alias_token enviado por el frontend puede haber caducado:
  // siempre re-listamos para obtener uno válido referido a la misma tarjeta lógica.
  const tarjetas = await pagopar.recurrente.listarTarjetas({ identificador: req.user.id });
  const t = tarjetas.find((x) => x.tarjeta === req.params.aliasToken /* o por número */);
  if (!t) return res.status(404).end();

  await pagopar.recurrente.eliminarTarjeta({
    identificador: req.user.id,
    tarjeta: t.alias_token,
  });
  res.status(204).end();
});
```

---

### 6. Mostrar las tarjetas guardadas del usuario

```ts
app.get('/perfil/tarjetas', async (req, res) => {
  const tarjetas = await pagopar.recurrente.listarTarjetas({
    identificador: req.user.id,
  });

  // Ojo: NUNCA expongas el alias_token al cliente — es un token de acceso.
  // Mandá sólo lo necesario para mostrar.
  res.json(
    tarjetas.map((t) => ({
      id: t.tarjeta,
      numero: t.tarjeta_numero,    // ej: "541863******1234"
      logo: t.url_logo,
    })),
  );
});
```

---

### 7. Listar formas de pago dinámicamente

Útil para construir un selector "Pagar con…" sin hardcodear opciones.

```ts
const formas = await pagopar.listarFormasPago();
// [{ forma_pago: '9', titulo: 'Tarjetas de crédito', monto_minimo: '1000', porcentaje_comision: '6.82', ... }]

const habilitadas = formas.filter((f) => Number(f.monto_minimo) <= total);
```

---

### 8. Reintentos y manejo de errores

```ts
import {
  PagoparApiError,
  PagoparNetworkError,
  PagoparWebhookSignatureError,
} from 'pagopar-sdk';

async function conReintento<T>(fn: () => Promise<T>, intentos = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < intentos; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      // Sólo reintentar errores de red, no errores lógicos
      if (!(err instanceof PagoparNetworkError)) throw err;
      await new Promise((r) => setTimeout(r, 500 * 2 ** i)); // backoff exponencial
    }
  }
  throw lastErr;
}

try {
  const pedido = await conReintento(() =>
    pagopar.iniciarTransaccion({ /* ... */ } as any),
  );
} catch (err) {
  if (err instanceof PagoparApiError) {
    // err.message    → mensaje de Pagopar (ej: "Token no coincide")
    // err.endpoint   → '/api/comercios/2.0/iniciar-transaccion'
    // err.resultado  → contenido crudo de `resultado`
    // err.status     → HTTP status si aplica
    logger.error({ err }, 'Pagopar rechazó el pedido');
  } else if (err instanceof PagoparNetworkError) {
    logger.error({ err }, 'Pagopar inalcanzable, reintentar luego');
  } else {
    throw err;
  }
}
```

---

## Helpers de bajo nivel

Si necesitás generar tokens manualmente (por ejemplo para tests o
integraciones legacy):

```ts
import {
  sha1,
  tokenIniciarTransaccion,  // sha1(privateKey + idPedido + floatval(monto))
  tokenConsultarPedido,     // sha1(privateKey + 'CONSULTA')
  tokenFormasPago,          // sha1(privateKey + 'FORMA-PAGO')
  tokenPagoRecurrente,      // sha1(privateKey + 'PAGO-RECURRENTE')
  tokenWebhook,             // sha1(privateKey + hashPedido)
} from 'pagopar-sdk';
```

---

## Formas de pago disponibles

```ts
import { FORMA_PAGO } from 'pagopar-sdk';

FORMA_PAGO.BANCARD                // 9  – Tarjetas Visa/Master/Amex/etc.
FORMA_PAGO.PROCARD                // 1
FORMA_PAGO.AQUI_PAGO              // 2
FORMA_PAGO.PAGO_EXPRESS           // 3
FORMA_PAGO.PRACTIPAGO             // 4
FORMA_PAGO.TIGO_MONEY             // 10
FORMA_PAGO.TRANSFERENCIA_BANCARIA // 11
FORMA_PAGO.BILLETERA_PERSONAL     // 12
FORMA_PAGO.PAGO_MOVIL             // 13
FORMA_PAGO.INFONET_COBRANZAS      // 15
FORMA_PAGO.ZIMPLE                 // 18
FORMA_PAGO.WALLY                  // 20
FORMA_PAGO.WEPA                   // 22
FORMA_PAGO.GIROS_CLARO            // 23
FORMA_PAGO.PAGO_QR                // 24
FORMA_PAGO.PIX                    // 25
```

---

## Sandbox / entornos

Pagopar provee un endpoint de desarrollo distinto al de producción. Para
apuntar el SDK a otro host:

```ts
new PagoparClient({
  publicKey: '...',
  privateKey: '...',
  baseUrl: 'https://api.dev.pagopar.com', // según el host que te indiquen
  timeoutMs: 20_000,
});
```

Ver [Entornos y pase a Producción](https://soporte.pagopar.com/portal/es/kb/articles/entornos-pase-a-producci%C3%B3n).

---

## Persistencia / migraciones

El paquete incluye en [`migrations/`](migrations/README.md) un set de
migraciones [**Knex**](https://knexjs.org/) (compatibles con PostgreSQL,
MySQL, MariaDB, SQLite y MSSQL) que crean las siguientes tablas:

| Tabla | Propósito |
| --- | --- |
| `pagopar_compradores` | Datos del comprador reusables entre pedidos |
| `pagopar_pedidos` | Pedido enviado a `iniciar-transaccion` + estado actual + payload original |
| `pagopar_detalles_pedido` | Items de cada pedido |
| `pagopar_reversas` | Pagos reversados por falta de confirmación del webhook |
| **`pagopar_api_logs`** | **Bitácora de cada request enviado y response recibido** (con `idempotency_key` para webhooks) |

El esquema replica el del paquete oficial Laravel
[`bypersoft/laravel-pagopar`](https://bitbucket.org/bypersoft/laravel-pagopar/src/master/)
y agrega `pagopar_api_logs` para auditoría completa del intercambio HTTP.

```bash
npm install --save-dev knex pg
npx knex migrate:latest --migrations-directory ./node_modules/pagopar-sdk/migrations
```

Ver [`migrations/README.md`](migrations/README.md) para el snippet completo
de cómo loggear request/response y manejar idempotencia de webhooks.

---

## Errores comunes

[Listado oficial](https://soporte.pagopar.com/portal/es/kb/articles/listado-de-errores-al-iniciar-transacci%C3%B3n):

| Error | Causa típica |
| --- | --- |
| `Token no coincide` | `id_pedido_comercio` debe ser **idéntico** (string) al usado para el token. `"01"` ≠ `"1"`. |
| `El pedido ya existe para ese comercio` | `id_pedido_comercio` es único combinando dev + producción. |
| `Monto debe ser mínimo Gs. 1.000 o máximo de Gs. 50.000.000` | Validá rango antes de enviar. |
| `El email del comprador debe existir` | El campo `comprador.email` es obligatorio. |
| `Forma de pago seleccionado no corresponde` | El comercio no tiene esa forma habilitada. |

---

## Licencia

MIT
