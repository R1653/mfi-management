/**
 * Migration: 012_fix_mfi_short_name_unique_index.js
 *
 * Problem: The existing UNIQUE INDEX on mfi.short_name is a full-table constraint.
 * This means SQLite enforces uniqueness even for soft-deleted rows (deleted_at IS NOT NULL),
 * causing a SQLITE_CONSTRAINT error when a user tries to create an MFI with the same
 * short_name as a previously deleted record.
 *
 * Fix: Drop the old global unique index and replace it with a partial unique index
 * that only applies to active (non-deleted) rows: WHERE deleted_at IS NULL.
 */
exports.up = async function (knex) {
  // Drop the existing global unique index
  await knex.raw('DROP INDEX IF EXISTS `mfi_short_name_unique`');

  // Create a partial unique index — only enforces uniqueness on non-deleted rows
  await knex.raw(
    "CREATE UNIQUE INDEX `mfi_short_name_unique_active` ON `mfi` (`short_name`) WHERE `deleted_at` IS NULL"
  );
};

exports.down = async function (knex) {
  // Restore original global unique index on rollback
  await knex.raw('DROP INDEX IF EXISTS `mfi_short_name_unique_active`');
  await knex.raw('CREATE UNIQUE INDEX `mfi_short_name_unique` ON `mfi` (`short_name`)');
};
