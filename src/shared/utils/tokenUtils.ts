/**
 * Utilities for secure token generation and hashing in the frontend
 */

/**
 * Generates a cryptographically secure random token.
 * Returns a 64-character hex string.
 */
export function generateRawToken(): string {
  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Computes the SHA-256 hash of a raw token.
 * Returns a 64-character hex string representing the hash.
 */
export async function hashToken(rawToken: string): Promise<string> {
  const data = new TextEncoder().encode(rawToken);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
