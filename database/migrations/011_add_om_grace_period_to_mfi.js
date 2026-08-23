/**
 * Migration: Add Grace Period for O&M (in months) to MFI table
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('mfi', (table) => {
    table.integer('om_grace_period_months').nullable().defaultTo(null)
      .comment('Grace period for O&M fee in months. Positive = future, Negative = past.');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('mfi', (table) => {
    table.dropColumn('om_grace_period_months');
  });
};
