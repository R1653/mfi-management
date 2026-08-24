/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema
    .alterTable('mfi', (table) => {
      table.date('agreement_expire_date').nullable();
      table.index(['agreement_expire_date']);
    })
    .alterTable('mfi_agreements', (table) => {
      table.date('agreement_expire_date').nullable();
      table.index(['agreement_expire_date']);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema
    .alterTable('mfi', (table) => {
      table.dropColumn('agreement_expire_date');
    })
    .alterTable('mfi_agreements', (table) => {
      table.dropColumn('agreement_expire_date');
    });
};
