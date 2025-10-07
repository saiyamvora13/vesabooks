// Replit Auth: Utility to check for unauthorized errors
export function isUnauthorizedError(error: Error): boolean {
  // Match format: "401: ..." (from default query fetcher)
  return error.message.startsWith("401:");
}
