/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('mfi_agreements', (table) => {
    table.increments('id').primary();
    table.integer('mfi_id').unsigned().notNullable()
      .references('id').inTable('mfi').onDelete('CASCADE');
    table.date('agreement_date').notNullable();
    table.decimal('license_fee_per_branch', 15, 2).notNullable().defaultTo(0.00);
    table.decimal('om_fee_per_branch', 15, 2).notNullable().defaultTo(0.00);
    table.text('remarks').nullable();
    table.integer('created_by').unsigned().nullable()
      .references('id').inTable('users').onDelete('SET NULL');
    table.integer('updated_by').unsigned().nullable()
      .references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index(['mfi_id']);
    table.index(['agreement_date']);
    table.unique(['mfi_id', 'agreement_date']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTableIfExists('mfi_agreements');
};
