/**
 * Generate a unique order reference in the format ORDER-XXXXXXXX
 * Uses base36 encoding for timestamp + random suffix for uniqueness
 * Example: ORDER-ABC12345
 */
export function generateOrderReference(): string {
  // Get timestamp in base36 (0-9, a-z) for shorter representation
  const timestamp = Date.now().toString(36).toUpperCase();
  
  // Generate 8 random characters (alphanumeric)
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let randomSuffix = '';
  for (let i = 0; i < 8; i++) {
    randomSuffix += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  
  // Combine timestamp (for rough ordering) + random suffix (for uniqueness)
  // Take last 8 chars to keep it consistent length
  const combined = (timestamp + randomSuffix).slice(-8);
  
  return `ORDER-${combined}`;
}

/**
 * Validate if a string is a valid order reference format
 */
export function isValidOrderReference(ref: string): boolean {
  return /^ORDER-[A-Z0-9]{8}$/.test(ref);
}

/**
 * Extract the short order ID from a full order reference
 * ORDER-ABC12345 -> ABC12345
 */
export function getShortOrderId(orderReference: string): string {
  return orderReference.replace('ORDER-', '');
}
