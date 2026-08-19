/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('mfi', (table) => {
    table.increments('id').primary();
    table.string('full_name', 200).notNullable();
    table.string('short_name', 50).notNullable().unique();
    table.date('establish_date').notNullable();
    table.date('initial_agreement_date').notNullable();
    table.decimal('initial_license_fee', 15, 2).notNullable().defaultTo(0.00);
    table.decimal('initial_om_fee', 15, 2).notNullable().defaultTo(0.00);
    table.integer('initial_branch_count').notNullable().defaultTo(0);
    table.boolean('is_head_office_billable').notNullable().defaultTo(false);
    table.string('status', 10).notNullable().defaultTo('active'); // active, inactive
    table.integer('created_by').unsigned().nullable()
      .references('id').inTable('users').onDelete('SET NULL');
    table.integer('updated_by').unsigned().nullable()
      .references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.timestamp('deleted_at').nullable(); // soft delete

    table.index(['short_name']);
    table.index(['status']);
    table.index(['deleted_at']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTableIfExists('mfi');
};
