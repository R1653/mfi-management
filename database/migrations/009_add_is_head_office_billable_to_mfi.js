/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  const hasColumn = await knex.schema.hasColumn('mfi', 'is_head_office_billable');
  if (!hasColumn) {
    await knex.schema.table('mfi', (table) => {
      table.boolean('is_head_office_billable').notNullable().defaultTo(false);
    });
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  const hasColumn = await knex.schema.hasColumn('mfi', 'is_head_office_billable');
  if (hasColumn) {
    await knex.schema.table('mfi', (table) => {
      table.dropColumn('is_head_office_billable');
    });
  }
};
