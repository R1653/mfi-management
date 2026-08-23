/**
 * Migration: 013_fix_branches_mfi_id_branch_code_unique_index.js
 *
 * Problem: The existing UNIQUE INDEX on branches(mfi_id, branch_code) is a full-table constraint.
 * This means SQLite enforces uniqueness even for soft-deleted rows, causing a SQLITE_CONSTRAINT 
 * error when a user tries to create a branch with the same code as a previously deleted record.
 *
 * Fix: Drop the old global unique index and replace it with a partial unique index
 * that only applies to active (non-deleted) rows: WHERE deleted_at IS NULL.
 */
exports.up = async function (knex) {
  // Drop the existing global unique index
  await knex.raw('DROP INDEX IF EXISTS `branches_mfi_id_branch_code_unique`');

  // Create a partial unique index — only enforces uniqueness on non-deleted rows
  await knex.raw(
    "CREATE UNIQUE INDEX `branches_mfi_id_branch_code_unique_active` ON `branches` (`mfi_id`, `branch_code`) WHERE `deleted_at` IS NULL"
  );
};

exports.down = async function (knex) {
  // Restore original global unique index on rollback
  await knex.raw('DROP INDEX IF EXISTS `branches_mfi_id_branch_code_unique_active`');
  await knex.raw('CREATE UNIQUE INDEX `branches_mfi_id_branch_code_unique` ON `branches` (`mfi_id`, `branch_code`)');
};
