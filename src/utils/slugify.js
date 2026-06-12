import slugifyLib from 'slugify';

/**
 * Generate a URL-safe slug from text.
 * Supports Arabic and other non-Latin scripts.
 * Appends a short random suffix to guarantee uniqueness.
 *
 * @param {string} text Input text
 * @param {object} [options]
 * @param {boolean} [options.unique=true] Append random suffix
 * @returns {string} URL-safe slug
 */
export function generateSlug(text, { unique = true } = {}) {
  let slug = slugifyLib(text, {
    lower: true,
    strict: true,
    trim: true,
    locale: 'ar', // Arabic support
  });

  // If slugify produced empty string (pure Arabic), transliterate manually
  if (!slug || slug.length === 0) {
    slug = text
      .replace(/[^\w\u0600-\u06FF\s-]/g, '') // keep Arabic, alphanumeric, spaces, hyphens
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();
  }

  // Fallback if still empty
  if (!slug || slug.length === 0) {
    slug = 'item';
  }

  if (unique) {
    const suffix = Math.random().toString(36).substring(2, 8);
    slug = `${slug}-${suffix}`;
  }

  return slug;
}

/**
 * Generate a unique slug, checking against existing slugs in the database.
 * @param {string} text Input text
 * @param {import('mongoose').Model} Model Mongoose model to check against
 * @param {string} [field='slug'] Field name to check
 * @returns {Promise<string>} Unique slug
 */
export async function generateUniqueSlug(text, Model, field = 'slug') {
  let slug = generateSlug(text, { unique: false });
  let candidate = slug;
  let counter = 0;

  while (true) {
    const exists = await Model.findOne({ [field]: candidate }).lean().select(field);
    if (!exists) return candidate;

    counter++;
    candidate = `${slug}-${counter}`;

    // Safety: prevent infinite loop
    if (counter > 100) {
      candidate = `${slug}-${Date.now()}`;
      return candidate;
    }
  }
}
