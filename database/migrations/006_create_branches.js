/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('branches', (table) => {
    table.increments('id').primary();
    table.integer('mfi_id').unsigned().notNullable()
      .references('id').inTable('mfi').onDelete('CASCADE');
    table.string('branch_name', 200).notNullable();
    table.string('branch_code', 50).notNullable();
    table.date('branch_opening_date').notNullable();
    table.date('software_start_date').notNullable();
    table.string('billable_month', 7).notNullable(); // YYYY-MM
    table.string('branch_type', 30).notNullable().defaultTo('Branch Office'); // Branch Office, Area Office, Zone Office
    table.string('status', 10).notNullable().defaultTo('active'); // active, inactive
    table.integer('created_by').unsigned().nullable()
      .references('id').inTable('users').onDelete('SET NULL');
    table.integer('updated_by').unsigned().nullable()
      .references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.timestamp('deleted_at').nullable(); // soft delete

    table.index(['mfi_id']);
    table.index(['branch_code']);
    table.index(['status']);
    table.index(['deleted_at']);
    table.unique(['mfi_id', 'branch_code']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTableIfExists('branches');
};
