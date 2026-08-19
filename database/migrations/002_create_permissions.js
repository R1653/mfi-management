/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('permissions', (table) => {
    table.increments('id').primary();
    table.string('name', 100).notNullable().unique(); // e.g., mfi.view, mfi.create
    table.string('module', 50).notNullable(); // e.g., mfi, branch, agreement, user, role, audit, report
    table.string('action', 50).notNullable(); // e.g., view, create, update, delete, manage, export
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTableIfExists('permissions');
};
