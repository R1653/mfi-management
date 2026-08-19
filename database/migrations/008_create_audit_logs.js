/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('audit_logs', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().nullable()
      .references('id').inTable('users').onDelete('SET NULL');
    table.string('module', 50).notNullable();
    table.string('action', 50).notNullable();
    table.integer('record_id').nullable();
    table.text('old_value').nullable(); // JSON string
    table.text('new_value').nullable(); // JSON string
    table.string('ip_address', 45).nullable();
    table.text('user_agent').nullable();
    table.text('description').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['user_id']);
    table.index(['module']);
    table.index(['action']);
    table.index(['created_at']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTableIfExists('audit_logs');
};
