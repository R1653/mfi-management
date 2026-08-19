/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // 1. Create teams table
  const hasTeams = await knex.schema.hasTable('teams');
  if (!hasTeams) {
    await knex.schema.createTable('teams', (table) => {
      table.increments('id').primary();
      table.string('team_name', 100).notNullable();
      table.string('team_code', 50).notNullable().unique();
      table.text('remarks').nullable();
      table.string('status', 20).notNullable().defaultTo('active'); // active, inactive
      table.integer('created_by').unsigned().references('id').inTable('users').onDelete('SET NULL');
      table.integer('updated_by').unsigned().references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.timestamp('deleted_at').nullable();
    });
  }

  // 2. Create team_members table
  const hasTeamMembers = await knex.schema.hasTable('team_members');
  if (!hasTeamMembers) {
    await knex.schema.createTable('team_members', (table) => {
      table.increments('id').primary();
      table.string('member_name', 100).notNullable();
      table.string('member_code', 50).notNullable().unique();
      table.integer('team_id').unsigned().references('id').inTable('teams').onDelete('SET NULL');
      table.boolean('is_team_leader').notNullable().defaultTo(false);
      table.text('remarks').nullable();
      table.string('status', 20).notNullable().defaultTo('active'); // active, inactive
      table.integer('created_by').unsigned().references('id').inTable('users').onDelete('SET NULL');
      table.integer('updated_by').unsigned().references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.timestamp('deleted_at').nullable();
    });
  }

  // 3. Add team_id and team_member_id to mfi table
  const hasTeamId = await knex.schema.hasColumn('mfi', 'team_id');
  if (!hasTeamId) {
    await knex.schema.table('mfi', (table) => {
      table.integer('team_id').unsigned().references('id').inTable('teams').onDelete('SET NULL').nullable();
    });
  }

  const hasTeamMemberId = await knex.schema.hasColumn('mfi', 'team_member_id');
  if (!hasTeamMemberId) {
    await knex.schema.table('mfi', (table) => {
      table.integer('team_member_id').unsigned().references('id').inTable('team_members').onDelete('SET NULL').nullable();
    });
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  const hasTeamMemberId = await knex.schema.hasColumn('mfi', 'team_member_id');
  if (hasTeamMemberId) {
    await knex.schema.table('mfi', (table) => {
      table.dropColumn('team_member_id');
    });
  }

  const hasTeamId = await knex.schema.hasColumn('mfi', 'team_id');
  if (hasTeamId) {
    await knex.schema.table('mfi', (table) => {
      table.dropColumn('team_id');
    });
  }

  await knex.schema.dropTableIfExists('team_members');
  await knex.schema.dropTableIfExists('teams');
};
