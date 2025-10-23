import { useState } from "react";
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
  Home,
  TrendingUp,
  Menu,
  ShoppingCart
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface AdminLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/admin/dashboard", testId: "nav-dashboard" },
  { icon: TrendingUp, label: "Analytics", path: "/admin/analytics", testId: "nav-analytics" },
  { icon: ShoppingCart, label: "Orders", path: "/admin/orders", testId: "nav-orders" },
  { icon: Settings, label: "Settings", path: "/admin/settings", testId: "nav-settings" },
  { icon: Star, label: "Hero Management", path: "/admin/hero", testId: "nav-hero" },
  { icon: Sparkles, label: "Featured Content", path: "/admin/featured", testId: "nav-featured" },
  { icon: FileText, label: "Audit Logs", path: "/admin/audit-logs", testId: "nav-audit-logs" },
];

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [location, setLocation] = useLocation();
  const [sheetOpen, setSheetOpen] = useState(false);
  const { toast } = useToast();
  const isMobile = useIsMobile();

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

  // Sidebar content component - reusable for both desktop and mobile
  const SidebarContent = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
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
                  "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors cursor-pointer min-h-[48px]", // Added min-h for touch targets
                  isActive 
                    ? "bg-purple-600/20 text-purple-400 border-l-4 border-purple-500" 
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-300"
                )}
                data-testid={item.testId}
                onClick={onNavigate}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
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
          className="w-full justify-start text-slate-400 hover:text-slate-300 hover:bg-slate-800 min-h-[48px]"
          disabled={logoutMutation.isPending}
          data-testid="button-logout"
        >
          <LogOut className="w-5 h-5 mr-3" />
          {logoutMutation.isPending ? "Logging out..." : "Logout"}
        </Button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Desktop Sidebar */}
      {!isMobile && (
        <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
          <SidebarContent />
        </aside>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <header className="bg-slate-900 border-b border-slate-800 px-4 sm:px-8 py-4">
          <div className="flex items-center justify-between">
            {/* Mobile Menu Button and Breadcrumbs */}
            <div className="flex items-center gap-4">
              {isMobile && (
                <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                  <SheetTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-slate-400 hover:text-slate-300 hover:bg-slate-800"
                      data-testid="button-mobile-menu"
                    >
                      <Menu className="h-6 w-6" />
                      <span className="sr-only">Toggle Menu</span>
                    </Button>
                  </SheetTrigger>
                  <SheetContent 
                    side="left" 
                    className="w-[280px] sm:w-[320px] bg-slate-900 border-slate-800 p-0 flex flex-col"
                  >
                    <SidebarContent onNavigate={() => setSheetOpen(false)} />
                  </SheetContent>
                </Sheet>
              )}
              
              <div className="flex items-center gap-2 text-sm overflow-x-auto">
                {breadcrumbs.map((crumb, index) => (
                  <div key={crumb.href} className="flex items-center gap-2 flex-shrink-0">
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
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 bg-slate-950 p-4 sm:p-6 md:p-8 overflow-auto">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
