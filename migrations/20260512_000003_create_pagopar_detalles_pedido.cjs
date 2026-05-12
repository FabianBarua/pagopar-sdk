/**
 * Migration: pagopar_detalles_pedido
 * Equivalente a 2025_05_36_135354_create_detalles_pedido_table.php del paquete
 * laravel-pagopar (bypersoft). Cada fila es un item dentro del pedido.
 *
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
    await knex.schema.createTable('pagopar_detalles_pedido', (t) => {
        t.bigIncrements('id').primary();
        t.bigInteger('id_pedido')
            .unsigned()
            .notNullable()
            .references('id')
            .inTable('pagopar_pedidos')
            .onDelete('CASCADE');

        t.string('nombre', 100).notNullable().comment('Nombre del producto');
        t.string('descripcion', 100).notNullable().comment('Descripcion del producto');
        t.decimal('precio_total', 15, 2).notNullable().comment('precio_unitario * cantidad');
        t.string('ciudad', 30).notNullable().defaultTo('Asuncion');
        t.string('public_key').notNullable().comment('Misma public_key del pedido');
        t.decimal('cantidad', 8, 2).notNullable();
        t.string('categoria').nullable().comment('Categoria Pagopar del producto');
        t.string('url_imagen').nullable();
        t.string('id_producto').nullable().comment('Id del producto en el comercio');

        // Datos opcionales del vendedor (marketplace)
        t.string('vendedor_telefono', 20).nullable();
        t.string('vendedor_direccion', 100).nullable();
        t.string('vendedor_direccion_referencia', 100).nullable();
        t.decimal('vendedor_latitud', 10, 8).nullable();
        t.decimal('vendedor_longitud', 11, 8).nullable();

        t.timestamps(true, true);

        t.index(['id_pedido']);
    });
};

/** @param {import('knex').Knex} knex */
exports.down = async function down(knex) {
    await knex.schema.dropTableIfExists('pagopar_detalles_pedido');
};
