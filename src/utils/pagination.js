import { PAGINATION } from '../config/constants.js';

/**
 * Parse pagination params from query string.
 * Supports both offset-based and cursor-based pagination.
 */
export function parsePaginationParams(query) {
  const page = Math.max(1, parseInt(query.page, 10) || PAGINATION.DEFAULT_PAGE);
  const perPage = Math.min(
    PAGINATION.MAX_PER_PAGE,
    Math.max(1, parseInt(query.per_page || query.limit, 10) || PAGINATION.DEFAULT_PER_PAGE),
  );
  const after = query.after || null; // cursor token
  const useCursor = !!after;

  return { page, perPage, after, useCursor };
}

/**
 * Build offset-based pagination metadata.
 * @param {number} total Total documents
 * @param {number} page Current page
 * @param {number} perPage Items per page
 * @returns {object} Pagination meta
 */
export function buildOffsetPagination(total, page, perPage) {
  const lastPage = Math.ceil(total / perPage) || 1;
  return {
    type: 'offset',
    total,
    per_page: perPage,
    current_page: page,
    last_page: lastPage,
    has_next: page < lastPage,
    has_prev: page > 1,
  };
}

/**
 * Build cursor-based pagination metadata.
 * @param {Array} items Result items
 * @param {number} limit Items per page
 * @param {string|null} cursorField Field to use as cursor (default: '_id')
 * @returns {object} Pagination meta with next_cursor
 */
export function buildCursorPagination(items, limit, cursorField = '_id') {
  const hasNext = items.length > limit;
  if (hasNext) {
    items.pop(); // remove extra item used for has_next detection
  }

  const nextCursor = hasNext && items.length > 0
    ? Buffer.from(String(items[items.length - 1][cursorField])).toString('base64')
    : null;

  return {
    type: 'cursor',
    per_page: limit,
    has_next: hasNext,
    next_cursor: nextCursor,
    count: items.length,
  };
}

/**
 * Decode a cursor token.
 * @param {string} cursor Base64 encoded cursor
 * @returns {string} Decoded cursor value
 */
export function decodeCursor(cursor) {
  try {
    return Buffer.from(cursor, 'base64').toString('utf8');
  } catch {
    return null;
  }
}
