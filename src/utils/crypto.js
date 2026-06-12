import crypto from 'crypto';

/**
 * Hash a string using SHA-256.
 * Used for storing refresh token hashes.
 * @param {string} str
 * @returns {string}
 */
export function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

/**
 * Generate a random hex token.
 * @param {number} [bytes=32]
 * @returns {string}
 */
export function generateToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Generate a random alphanumeric string.
 * @param {number} [length=16]
 * @returns {string}
 */
export function randomString(length = 16) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

/**
 * Generate a sequential order number.
 * Format: ORD-YYYY-NNNNNN
 * @param {import('mongoose').Connection} connection Mongoose connection
 * @returns {Promise<string>}
 */
export async function generateOrderNumber(connection) {
  const year = new Date().getFullYear();
  const Counter = connection.collection('counters');

  const result = await Counter.findOneAndUpdate(
    { _id: `order_${year}` },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' },
  );

  const seq = String(result.seq).padStart(6, '0');
  return `ORD-${year}-${seq}`;
}

/**
 * Generate a sequential ticket number.
 * Format: TKT-YYYY-NNNNNN
 * @param {import('mongoose').Connection} connection Mongoose connection
 * @returns {Promise<string>}
 */
export async function generateTicketNumber(connection) {
  const year = new Date().getFullYear();
  const Counter = connection.collection('counters');

  const result = await Counter.findOneAndUpdate(
    { _id: `ticket_${year}` },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' },
  );

  const seq = String(result.seq).padStart(6, '0');
  return `TKT-${year}-${seq}`;
}
