import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { AdminUser } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { 
  LayoutDashboard, 
  Settings, 
  Star, 
  Sparkles, 
  FileText, 
  LogOut,
  ChevronRight,
  Home
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface AdminLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/admin/dashboard", testId: "nav-dashboard" },
  { icon: Settings, label: "Settings", path: "/admin/settings", testId: "nav-settings" },
  { icon: Star, label: "Hero Management", path: "/admin/hero", testId: "nav-hero" },
  { icon: Sparkles, label: "Featured Content", path: "/admin/featured", testId: "nav-featured" },
  { icon: FileText, label: "Audit Logs", path: "/admin/audit-logs", testId: "nav-audit-logs" },
];

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: admin } = useQuery<AdminUser>({
    queryKey: ["/api/admin/me"],
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/logout");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Logged Out",
        description: "You have been logged out successfully",
      });
      setLocation("/admin/login");
    },
  });

  const getBreadcrumbs = () => {
    const paths = location.split('/').filter(Boolean);
    return paths.map((path, index) => {
      const href = '/' + paths.slice(0, index + 1).join('/');
      const label = path.charAt(0).toUpperCase() + path.slice(1).replace('-', ' ');
      return { label, href, isLast: index === paths.length - 1 };
    });
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
        <div className="p-6 border-b border-slate-800">
          <Link href="/">
            <div className="flex items-center gap-2 text-purple-400 hover:text-purple-300 transition-colors cursor-pointer">
              <Home className="w-5 h-5" />
              <span className="font-semibold">Back to Site</span>
            </div>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path;
            
            return (
              <Link key={item.path} href={item.path}>
                <a
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors cursor-pointer",
                    isActive 
                      ? "bg-purple-600/20 text-purple-400 border-l-4 border-purple-500" 
                      : "text-slate-400 hover:bg-slate-800 hover:text-slate-300"
                  )}
                  data-testid={item.testId}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </a>
              </Link>
            );
          })}
        </nav>

        {/* Admin Info & Logout */}
        <div className="p-4 border-t border-slate-800">
          {admin && (
            <div className="mb-3 px-4 py-2">
              <p className="text-sm font-medium text-slate-300">
                {admin.firstName} {admin.lastName}
              </p>
              <p className="text-xs text-slate-500">{admin.email}</p>
              {admin.isSuperAdmin && (
                <span className="inline-block mt-1 text-xs bg-purple-600/20 text-purple-400 px-2 py-0.5 rounded">
                  Super Admin
                </span>
              )}
            </div>
          )}
          <Button
            onClick={() => logoutMutation.mutate()}
            variant="ghost"
            className="w-full justify-start text-slate-400 hover:text-slate-300 hover:bg-slate-800"
            disabled={logoutMutation.isPending}
            data-testid="button-logout"
          >
            <LogOut className="w-5 h-5 mr-3" />
            {logoutMutation.isPending ? "Logging out..." : "Logout"}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <header className="bg-slate-900 border-b border-slate-800 px-8 py-4">
          <div className="flex items-center gap-2 text-sm">
            {breadcrumbs.map((crumb, index) => (
              <div key={crumb.href} className="flex items-center gap-2">
                {index > 0 && <ChevronRight className="w-4 h-4 text-slate-600" />}
                {crumb.isLast ? (
                  <span className="text-slate-300 font-medium">{crumb.label}</span>
                ) : (
                  <Link href={crumb.href}>
                    <a className="text-slate-500 hover:text-slate-300 transition-colors">
                      {crumb.label}
                    </a>
                  </Link>
                )}
              </div>
            ))}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 bg-slate-950 p-8 overflow-auto">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
