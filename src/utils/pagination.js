/**
 * Standard server-side pagination & filter helper for Knex queries
 * 
 * @param {import('knex').Knex.QueryBuilder} baseQuery 
 * @param {Object} options
 * @param {number} [options.page=1]
 * @param {number} [options.limit=10]
 * @returns {Promise<Object>}
 */
async function paginate(baseQuery, { page = 1, limit = 10 } = {}) {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
  const offset = (pageNum - 1) * pageSize;

  // Clone query to count total rows without limit/offset
  const countResult = await baseQuery.clone().clearSelect().clearOrder().count('* as total').first();
  const total = parseInt(countResult.total || 0, 10);
  const totalPages = Math.ceil(total / pageSize);

  const data = await baseQuery.offset(offset).limit(pageSize);

  return {
    data,
    pagination: {
      total,
      page: pageNum,
      limit: pageSize,
      totalPages,
      hasNext: pageNum < totalPages,
      hasPrev: pageNum > 1
    }
  };
}

module.exports = {
  paginate
};
