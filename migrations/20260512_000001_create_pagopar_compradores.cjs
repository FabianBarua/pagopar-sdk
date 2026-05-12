/**
 * Migration: pagopar_compradores
 * Equivalente a 2025_05_06_134339_create_compradores_table.php del paquete
 * laravel-pagopar (bypersoft).
 *
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
    await knex.schema.createTable('pagopar_compradores', (t) => {
        t.bigIncrements('id').primary();
        t.string('email').notNullable().comment('El correo del comprador');
        t.string('telefono').notNullable().comment('El telefono del comprador');
        t.string('ciudad').nullable().comment('La ciudad del comprador');
        t.string('ruc').notNullable().comment('El ruc del comprador');
        t.string('razon_social').notNullable().comment('La razon social de la orden');
        t.string('nombre').notNullable().comment('El nombre del comprador');
        t.string('documento').notNullable().comment('Numero de cedula, pasaporte, etc.');
        t.string('tipo_documento').notNullable().comment('CI, RUC, Pasaporte, etc.');
        t.string('direccion').nullable().defaultTo('').comment('La direccion del comprador');
        t.string('direccion_referencia').nullable().defaultTo('').comment('Referencias de la direccion');
        t.decimal('latitud', 10, 8).nullable().comment('Latitud');
        t.decimal('longitud', 11, 8).nullable().comment('Longitud');
        t.timestamps(true, true);

        t.index(['documento']);
        t.index(['email']);
    });
};

/** @param {import('knex').Knex} knex */
exports.down = async function down(knex) {
    await knex.schema.dropTableIfExists('pagopar_compradores');
};
