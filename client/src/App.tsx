import { lazy, Suspense } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HelmetProvider } from "react-helmet-async";
import { Loader2 } from "lucide-react";
import Home from "@/pages/home"; // Eagerly load home page to avoid Suspense on initial render

// Lazy load all other pages for code splitting
const Create = lazy(() => import("@/pages/create"));
const View = lazy(() => import("@/pages/view"));
const Library = lazy(() => import("@/pages/library"));
const Cart = lazy(() => import("@/pages/cart"));
const Checkout = lazy(() => import("@/pages/checkout"));
const Purchases = lazy(() => import("@/pages/purchases"));
const Signup = lazy(() => import("@/pages/signup"));
const Login = lazy(() => import("@/pages/login"));
const ForgotPassword = lazy(() => import("@/pages/forgot-password"));
const ResetPassword = lazy(() => import("@/pages/reset-password"));
const NotFound = lazy(() => import("@/pages/not-found"));
const AdminLogin = lazy(() => import("@/pages/admin-login"));
const AdminDashboard = lazy(() => import("@/pages/admin/dashboard"));
const AdminSettings = lazy(() => import("@/pages/admin/settings"));
const AdminHeroManagement = lazy(() => import("@/pages/admin/hero-management"));
const AdminFeatured = lazy(() => import("@/pages/admin/featured"));
const AdminAuditLogs = lazy(() => import("@/pages/admin/audit-logs"));
const AdminSamplePrompts = lazy(() => import("@/pages/admin/sample-prompts"));

// Loading fallback component
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/signup" component={Signup} />
        <Route path="/login" component={Login} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/create" component={Create} />
        <Route path="/library" component={Library} />
        <Route path="/cart" component={Cart} />
        <Route path="/checkout" component={Checkout} />
        <Route path="/purchases" component={Purchases} />
        <Route path="/view/:id" component={View} />
        <Route path="/shared/:shareUrl" component={View} />
        
        {/* Admin Routes */}
        <Route path="/admin/login" component={AdminLogin} />
        <Route path="/admin/dashboard" component={AdminDashboard} />
        <Route path="/admin/settings" component={AdminSettings} />
        <Route path="/admin/hero" component={AdminHeroManagement} />
        <Route path="/admin/featured" component={AdminFeatured} />
        <Route path="/admin/sample-prompts" component={AdminSamplePrompts} />
        <Route path="/admin/audit-logs" component={AdminAuditLogs} />
        
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
}

export default App;
