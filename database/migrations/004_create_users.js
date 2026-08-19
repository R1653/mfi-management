/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('users', (table) => {
    table.increments('id').primary();
    table.string('name', 100).notNullable();
    table.string('login_id', 50).notNullable().unique();
    table.string('email', 100).nullable().unique();
    table.string('mobile', 20).nullable();
    table.string('password', 255).notNullable();
    table.integer('role_id').unsigned().nullable()
      .references('id').inTable('roles').onDelete('SET NULL');
    table.string('status', 10).notNullable().defaultTo('active'); // active, inactive
    table.timestamp('last_login_at').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index(['login_id']);
    table.index(['role_id']);
    table.index(['status']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTableIfExists('users');
};
