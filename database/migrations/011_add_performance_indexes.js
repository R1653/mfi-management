/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  const hasBranchesTable = await knex.schema.hasTable('branches');
  if (hasBranchesTable) {
    await knex.schema.alterTable('branches', (table) => {
      table.index(['mfi_id', 'branch_type', 'deleted_at'], 'idx_branches_mfi_type_deleted');
      table.index(['billable_month'], 'idx_branches_billable_month');
    });
  }

  const hasAgreementsTable = await knex.schema.hasTable('mfi_agreements');
  if (hasAgreementsTable) {
    await knex.schema.alterTable('mfi_agreements', (table) => {
      table.index(['mfi_id', 'agreement_date'], 'idx_agreements_mfi_date');
    });
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  const hasBranchesTable = await knex.schema.hasTable('branches');
  if (hasBranchesTable) {
    await knex.schema.alterTable('branches', (table) => {
      table.dropIndex([], 'idx_branches_mfi_type_deleted');
      table.dropIndex([], 'idx_branches_billable_month');
    });
  }

  const hasAgreementsTable = await knex.schema.hasTable('mfi_agreements');
  if (hasAgreementsTable) {
    await knex.schema.alterTable('mfi_agreements', (table) => {
      table.dropIndex([], 'idx_agreements_mfi_date');
    });
  }
};
