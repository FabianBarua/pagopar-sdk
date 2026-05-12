/**
 * Migration: pagopar_reversas
 * Equivalente a 2025_07_10_100200_create_pagopar_reversas_table.php del
 * paquete laravel-pagopar (bypersoft). Guarda los pagos reversados
 * automaticamente al no recibir confirmacion del webhook.
 *
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
    await knex.schema.createTable('pagopar_reversas', (t) => {
        t.uuid('id').primary();
        t.string('hash').notNullable().comment('hash_pedido devuelto por Pagopar');
        t.string('status').notNullable();
        t.string('key').notNullable();
        t.string('level').notNullable();
        t.string('dsc').notNullable().comment('Descripcion del motivo de la reversa');
        t.timestamps(true, true);

        t.index(['hash']);
    });
};

/** @param {import('knex').Knex} knex */
exports.down = async function down(knex) {
    await knex.schema.dropTableIfExists('pagopar_reversas');
};
