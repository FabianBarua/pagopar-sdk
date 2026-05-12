/**
 * Migration: pagopar_api_logs
 * Bitacora de TODAS las llamadas HTTP intercambiadas con Pagopar.
 * Guarda el request enviado y el response recibido (incluyendo errores) para
 * auditoria, reproducibilidad de bugs y conciliacion contra Pagopar.
 *
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
    await knex.schema.createTable('pagopar_api_logs', (t) => {
        t.bigIncrements('id').primary();

        // Direccion del trafico
        t.enum('direction', ['outgoing', 'incoming']).notNullable()
            .comment('outgoing = request iniciado por el SDK; incoming = webhook recibido');

        // Endpoint y metodo
        t.string('endpoint').notNullable().comment('Path relativo: /api/comercios/2.0/iniciar-transaccion, etc.');
        t.string('method', 10).notNullable().defaultTo('POST');

        // Cuerpos del intercambio
        t.json('request_body').nullable().comment('Cuerpo JSON enviado (o recibido, en webhooks)');
        t.json('request_headers').nullable();
        t.json('response_body').nullable().comment('Cuerpo JSON devuelto por Pagopar');
        t.integer('http_status').nullable();
        t.integer('duration_ms').nullable().comment('Latencia en milisegundos');

        // Resultado logico
        t.boolean('ok').notNullable().defaultTo(false).comment('respuesta.respuesta === true');
        t.text('error_message').nullable();

        // Vinculos para joins rapidos
        t.string('id_pedido_comercio').nullable().index();
        t.string('hash_pedido').nullable().index();
        t.bigInteger('id_pedido')
            .unsigned()
            .nullable()
            .references('id')
            .inTable('pagopar_pedidos')
            .onDelete('SET NULL');

        // Idempotencia para webhooks (evita procesar dos veces el mismo evento)
        t.string('idempotency_key').nullable().unique()
            .comment('Para webhooks: sha1(hash_pedido + fecha_pago + numero_comprobante_interno)');

        t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

        t.index(['direction', 'endpoint']);
        t.index(['ok']);
        t.index(['created_at']);
    });
};

/** @param {import('knex').Knex} knex */
exports.down = async function down(knex) {
    await knex.schema.dropTableIfExists('pagopar_api_logs');
};
