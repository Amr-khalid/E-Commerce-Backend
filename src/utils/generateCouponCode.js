import crypto from 'crypto';

/**
 * Generate a unique, human-readable coupon code.
 * Format: PREFIX-XXXX-XXXX (e.g., SUMMER-A3K9-B2M1)
 *
 * @param {object} [options]
 * @param {string} [options.prefix] Optional prefix
 * @param {number} [options.length=8] Code length (excluding prefix)
 * @param {string} [options.charset] Character set
 * @returns {string} Unique coupon code
 */
export function generateCouponCode({
  prefix = '',
  length = 8,
  charset = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', // Exclude O,0,I,1 for readability
} = {}) {
  const bytes = crypto.randomBytes(length);
  let code = '';

  for (let i = 0; i < length; i++) {
    code += charset[bytes[i] % charset.length];
  }

  // Format as groups of 4
  const formatted = code.match(/.{1,4}/g).join('-');

  return prefix ? `${prefix.toUpperCase()}-${formatted}` : formatted;
}

/**
 * Generate a batch of unique coupon codes.
 * Uses a Set to guarantee no duplicates within the batch.
 *
 * @param {number} count Number of codes to generate
 * @param {object} [options] Same options as generateCouponCode
 * @returns {string[]} Array of unique codes
 */
export function generateBulkCouponCodes(count, options = {}) {
  const codes = new Set();
  let attempts = 0;
  const maxAttempts = count * 3; // safety valve

  while (codes.size < count && attempts < maxAttempts) {
    codes.add(generateCouponCode(options));
    attempts++;
  }

  if (codes.size < count) {
    throw new Error(`Could not generate ${count} unique codes after ${maxAttempts} attempts`);
  }

  return Array.from(codes);
}
