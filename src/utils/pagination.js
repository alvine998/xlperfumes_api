const DEFAULT_PAGE_LIMIT = 50;
const MAX_PAGE_LIMIT = 100;

function positiveInteger(value, fallback) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function paginationFromQuery(query, { defaultLimit = DEFAULT_PAGE_LIMIT, maxLimit = MAX_PAGE_LIMIT } = {}) {
  const limit = Math.min(positiveInteger(query.limit, defaultLimit), maxLimit);
  const maxPage = Math.max(1, Math.floor(Number.MAX_SAFE_INTEGER / limit));
  const page = Math.min(positiveInteger(query.page, 1), maxPage);
  return { page, limit, offset: (page - 1) * limit };
}

function paginationMetadata({ page, limit }, total) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}

module.exports = { paginationFromQuery, paginationMetadata };
