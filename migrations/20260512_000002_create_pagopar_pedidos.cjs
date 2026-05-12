/**
 * Migration: pagopar_pedidos
 * Equivalente a 2025_05_06_135156_create_pedidos_table.php del paquete
 * laravel-pagopar (bypersoft). Almacena el pedido enviado a Pagopar y el
 * estado actual.
 *
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
    await knex.schema.createTable('pagopar_pedidos', (t) => {
        t.bigIncrements('id').primary();

        // Identificadores del pedido en TU sistema y en Pagopar
        t.string('id_pedido_comercio').notNullable().comment('Id alfanumerico del pedido en el comercio (unico)');
        t.bigInteger('id_pedido_pagopar').nullable().comment('Id retornado por Pagopar');
        t.string('hash').nullable().comment('Hash del pedido devuelto por iniciar-transaccion (clave de callback)');

        // Tokens / firmas
        t.string('token').notNullable().comment('Token publico de la cuenta de Pagopar (public_key)');
        t.string('public_token').notNullable().comment('sha1(private_key + id_pedido_comercio + monto_total)');

        // Datos comerciales
        t.decimal('monto_total', 15, 2).notNullable().comment('Monto total del pedido en PYG');
        t.string('tipo_pedido').notNullable().defaultTo('VENTA-COMERCIO').comment('VENTA-COMERCIO, VENTA-ENTRADAS, etc.');
        t.string('descripcion_resumen').nullable().comment('Descripcion corta del pedido');
        t.timestamp('fecha_maxima_pago').notNullable().comment('Fecha maxima de pago aceptada por Pagopar');
        t.enum('estado', ['pendiente', 'pagado', 'cancelado', 'reversado']).notNullable().defaultTo('pendiente');

        // Datos opcionales del pago confirmado
        t.string('forma_pago').nullable().comment('Forma de pago efectivamente usada (Bancard, AquiPago, etc.)');
        t.string('numero_comprobante_interno').nullable().comment('Comprobante devuelto por Pagopar al pagar');
        t.timestamp('fecha_pago').nullable();

        // Relaciones
        t.bigInteger('id_comprador').unsigned().nullable().references('id').inTable('pagopar_compradores').onDelete('SET NULL');
        t.bigInteger('id_usuario').unsigned().nullable().comment('Usuario interno del comercio que origino el pedido');

        // Payload original (snapshot) para auditoria
        t.json('payload').nullable().comment('Cuerpo JSON enviado a iniciar-transaccion');

        t.timestamps(true, true);

        t.unique(['id_pedido_comercio']);
        t.index(['hash']);
        t.index(['estado']);
        t.index(['id_pedido_pagopar']);
    });
};

/** @param {import('knex').Knex} knex */
exports.down = async function down(knex) {
    await knex.schema.dropTableIfExists('pagopar_pedidos');
};
