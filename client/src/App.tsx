import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/home";
import Create from "@/pages/create";
import View from "@/pages/view";
import Library from "@/pages/library";
import Cart from "@/pages/cart";
import Checkout from "@/pages/checkout";
import Purchases from "@/pages/purchases";
import Signup from "@/pages/signup";
import Login from "@/pages/login";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import NotFound from "@/pages/not-found";
import AdminLogin from "@/pages/admin-login";
import AdminDashboard from "@/pages/admin/dashboard";
import AdminSettings from "@/pages/admin/settings";
import AdminHeroManagement from "@/pages/admin/hero-management";
import AdminFeatured from "@/pages/admin/featured";
import AdminAuditLogs from "@/pages/admin/audit-logs";
import AdminSamplePrompts from "@/pages/admin/sample-prompts";

function Router() {
  return (
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
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
