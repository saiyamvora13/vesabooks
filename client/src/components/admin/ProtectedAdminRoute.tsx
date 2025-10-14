import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AdminUser } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";

interface ProtectedAdminRouteProps {
  children: React.ReactNode;
  requireSuperAdmin?: boolean;
}

export default function ProtectedAdminRoute({ children, requireSuperAdmin = false }: ProtectedAdminRouteProps) {
  const [, setLocation] = useLocation();

  const { data: admin, isLoading } = useQuery<AdminUser | null>({
    queryKey: ["/api/admin/me"],
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="space-y-4 w-full max-w-md p-8">
          <Skeleton className="h-8 w-3/4 bg-slate-800" />
          <Skeleton className="h-4 w-full bg-slate-800" />
          <Skeleton className="h-4 w-2/3 bg-slate-800" />
        </div>
      </div>
    );
  }

  if (!admin) {
    setLocation("/admin/login");
    return null;
  }

  if (requireSuperAdmin && !admin.isSuperAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center p-8">
          <h1 className="text-2xl font-bold text-slate-100 mb-2">Access Denied</h1>
          <p className="text-slate-400">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
