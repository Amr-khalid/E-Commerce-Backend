import mongoose from 'mongoose';
import { SORT_OPTIONS, PAGINATION } from '../config/constants.js';
import { parsePaginationParams, buildOffsetPagination, buildCursorPagination, decodeCursor } from '../utils/pagination.js';

/**
 * Dynamic Query Builder for advanced product filtering.
 * Supports 12+ filter types, 8 sort options, and dual pagination.
 *
 * All filters compose together in a single MongoDB query.
 */
class QueryBuilder {
  constructor(Model) {
    this.Model = Model;
    this.filter = {};
    this.sortObj = { createdAt: -1 };
    this.selectFields = '';
    this.populateFields = [];
    this.paginationParams = null;
  }

  /**
   * Build filter + sort + pagination from query params.
   * @param {Object} query req.query object
   * @returns {QueryBuilder} this (chainable)
   */
  fromQuery(query) {
    this._buildFilters(query);
    this._buildSort(query);
    this.paginationParams = parsePaginationParams(query);

    if (query.fields) {
      this.selectFields = query.fields.split(',').join(' ');
    }

    return this;
  }

  /**
   * Build MongoDB filters from query params.
   * @private
   */
  _buildFilters(query) {
    const filter = {};

    // ─── Active/Status (default: only active) ─────────
    filter.isActive = query.is_active !== 'false';
    if (query.status) {
      filter.status = query.status;
    } else {
      filter.status = 'active';
    }

    // ─── Price Range ──────────────────────────────────
    if (query.price_min || query.price_max) {
      filter.price = {};
      if (query.price_min) filter.price.$gte = parseFloat(query.price_min);
      if (query.price_max) filter.price.$lte = parseFloat(query.price_max);
    }

    // ─── Categories (multi-select) ────────────────────
    if (query.category_ids) {
      const ids = Array.isArray(query.category_ids)
        ? query.category_ids
        : [query.category_ids];
      filter.categories = {
        $in: ids.map((id) => new mongoose.Types.ObjectId(id)),
      };
    }

    // ─── Brand (multi-select) ─────────────────────────
    if (query.brand_ids) {
      const brands = Array.isArray(query.brand_ids)
        ? query.brand_ids
        : [query.brand_ids];
      filter.brand = { $in: brands };
    }

    // ─── Rating (minimum) ─────────────────────────────
    if (query.rating_min) {
      filter.avgRating = { $gte: parseFloat(query.rating_min) };
    }

    // ─── On Sale ──────────────────────────────────────
    if (query.on_sale === 'true') {
      filter.discountPrice = { $ne: null, $gt: 0 };
    }

    // ─── In Stock ─────────────────────────────────────
    if (query.in_stock === 'true') {
      filter.stock = { $gt: 0 };
    }

    // ─── Dynamic Attributes ───────────────────────────
    // Format: attributes[color][]=red&attributes[size][]=XL
    if (query.attributes) {
      const attrConditions = [];
      for (const [key, values] of Object.entries(query.attributes)) {
        const vals = Array.isArray(values) ? values : [values];
        attrConditions.push({
          attributes: {
            $elemMatch: {
              key: key,
              value: { $in: vals },
            },
          },
        });
      }
      if (attrConditions.length > 0) {
        filter.$and = filter.$and || [];
        filter.$and.push(...attrConditions);
      }
    }

    // ─── Flags (multi-select) ─────────────────────────
    if (query.flags) {
      const flags = Array.isArray(query.flags) ? query.flags : [query.flags];
      for (const flag of flags) {
        if (['featured', 'newArrival', 'bestSeller', 'topPriority'].includes(flag)) {
          filter[`flags.${flag}`] = true;
        }
      }
    }

    // ─── Text Search ──────────────────────────────────
    if (query.q) {
      filter.$text = { $search: query.q };
    }

    // ─── Date Range ───────────────────────────────────
    if (query.created_after || query.created_before) {
      filter.createdAt = {};
      if (query.created_after) filter.createdAt.$gte = new Date(query.created_after);
      if (query.created_before) filter.createdAt.$lte = new Date(query.created_before);
    }

    // ─── SKU Search ───────────────────────────────────
    if (query.sku) {
      filter.sku = query.sku.toUpperCase();
    }

    this.filter = filter;
  }

  /**
   * Build sort object from query.
   * @private
   */
  _buildSort(query) {
    if (query.sort && SORT_OPTIONS[query.sort]) {
      this.sortObj = SORT_OPTIONS[query.sort];
    } else if (query.q) {
      // If text search, sort by relevance by default
      this.sortObj = { score: { $meta: 'textScore' } };
    }
  }

  /**
   * Select specific fields
   * @param {string} fields Space-separated field names
   * @returns {QueryBuilder}
   */
  select(fields) {
    this.selectFields = fields;
    return this;
  }

  /**
   * Add populate
   * @param {string|Object} populate
   * @returns {QueryBuilder}
   */
  populate(populate) {
    this.populateFields.push(populate);
    return this;
  }

  /**
   * Execute the query with offset-based pagination.
   * @returns {Object} { data, pagination }
   */
  async execWithOffsetPagination() {
    const { page, perPage } = this.paginationParams || { page: 1, perPage: PAGINATION.DEFAULT_PER_PAGE };

    // Count total (use estimatedDocumentCount for unfiltered, countDocuments for filtered)
    const hasFilters = Object.keys(this.filter).length > 2; // beyond isActive/status
    const total = hasFilters
      ? await this.Model.countDocuments(this.filter)
      : await this.Model.estimatedDocumentCount();

    const skip = (page - 1) * perPage;

    let dbQuery = this.Model.find(this.filter)
      .sort(this.sortObj)
      .skip(skip)
      .limit(perPage);

    if (this.selectFields) {
      dbQuery = dbQuery.select(this.selectFields);
    }

    // Add text score if text search
    if (this.filter.$text) {
      dbQuery = dbQuery.select({ score: { $meta: 'textScore' } });
    }

    for (const pop of this.populateFields) {
      dbQuery = dbQuery.populate(pop);
    }

    const data = await dbQuery.lean();
    const pagination = buildOffsetPagination(total, page, perPage);

    return { data, pagination };
  }

  /**
   * Execute the query with cursor-based pagination.
   * @returns {Object} { data, pagination }
   */
  async execWithCursorPagination() {
    const { perPage, after } = this.paginationParams || { perPage: PAGINATION.DEFAULT_PER_PAGE, after: null };

    if (after) {
      const cursorValue = decodeCursor(after);
      if (cursorValue) {
        this.filter._id = { $lt: new mongoose.Types.ObjectId(cursorValue) };
      }
    }

    // Fetch one extra to check if there's a next page
    let dbQuery = this.Model.find(this.filter)
      .sort({ _id: -1, ...this.sortObj })
      .limit(perPage + 1);

    if (this.selectFields) {
      dbQuery = dbQuery.select(this.selectFields);
    }

    for (const pop of this.populateFields) {
      dbQuery = dbQuery.populate(pop);
    }

    const data = await dbQuery.lean();
    const pagination = buildCursorPagination(data, perPage);

    return { data, pagination };
  }

  /**
   * Execute with automatic pagination mode selection.
   * @returns {Object} { data, pagination }
   */
  async exec() {
    if (this.paginationParams?.useCursor) {
      return this.execWithCursorPagination();
    }
    return this.execWithOffsetPagination();
  }
}

export default QueryBuilder;
