// Replit Auth: useAuth hook for checking authentication status
import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";
import { isUnauthorizedError } from "@/lib/authUtils";

export function useAuth() {
  const { data: user, isLoading, error } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  // Treat 401 errors as "not authenticated" rather than loading state
  const isUnauthenticated = error && isUnauthorizedError(error as Error);

  return {
    user: isUnauthenticated ? null : user,
    isLoading: isLoading && !isUnauthenticated,
    isAuthenticated: !!user && !isUnauthenticated,
  };
}
