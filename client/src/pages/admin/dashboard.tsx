import { useQuery } from "@tanstack/react-query";
import ProtectedAdminRoute from "@/components/admin/ProtectedAdminRoute";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Users, Settings } from "lucide-react";
import { Storybook, SiteSetting } from "@shared/schema";

interface Metrics {
  storiesCreated: number;
  activeUsers: number;
}

export default function AdminDashboard() {
  const { data: storybooks, isLoading: storybooksLoading } = useQuery<Storybook[]>({
    queryKey: ["/api/storybooks"],
  });

  const { data: metrics, isLoading: metricsLoading } = useQuery<Metrics>({
    queryKey: ["/api/metrics"],
  });

  const { data: settings, isLoading: settingsLoading } = useQuery<SiteSetting[]>({
    queryKey: ["/api/admin/settings"],
  });

  const totalStories = storybooks?.length || 0;
  const totalUsers = metrics?.activeUsers || 0;
  const settingsCount = settings?.length || 0;

  return (
    <ProtectedAdminRoute>
      <AdminLayout>
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-100 mb-2">Dashboard</h1>
            <p className="text-slate-400">Overview of your admin panel</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Total Stories Card */}
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">Total Stories</CardTitle>
                <BookOpen className="w-5 h-5 text-purple-500" />
              </CardHeader>
              <CardContent>
                {storybooksLoading ? (
                  <Skeleton className="h-10 w-24 bg-slate-800" />
                ) : (
                  <div className="text-3xl font-bold text-slate-100" data-testid="stat-total-stories">
                    {totalStories}
                  </div>
                )}
                <p className="text-xs text-slate-500 mt-1">Total storybooks created</p>
              </CardContent>
            </Card>

            {/* Total Users Card */}
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">Active Users</CardTitle>
                <Users className="w-5 h-5 text-purple-500" />
              </CardHeader>
              <CardContent>
                {metricsLoading ? (
                  <Skeleton className="h-10 w-24 bg-slate-800" />
                ) : (
                  <div className="text-3xl font-bold text-slate-100" data-testid="stat-total-users">
                    {totalUsers}
                  </div>
                )}
                <p className="text-xs text-slate-500 mt-1">Registered users</p>
              </CardContent>
            </Card>

            {/* Settings Count Card */}
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">Site Settings</CardTitle>
                <Settings className="w-5 h-5 text-purple-500" />
              </CardHeader>
              <CardContent>
                {settingsLoading ? (
                  <Skeleton className="h-10 w-24 bg-slate-800" />
                ) : (
                  <div className="text-3xl font-bold text-slate-100">
                    {settingsCount}
                  </div>
                )}
                <p className="text-xs text-slate-500 mt-1">Configuration settings</p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity Section */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-slate-100">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <a
                  href="/admin/settings"
                  className="p-4 rounded-lg border border-slate-800 bg-slate-950 hover:bg-slate-800 transition-colors"
                >
                  <h3 className="font-semibold text-slate-100 mb-1">Manage Settings</h3>
                  <p className="text-sm text-slate-400">Update site configuration</p>
                </a>
                <a
                  href="/admin/hero"
                  className="p-4 rounded-lg border border-slate-800 bg-slate-950 hover:bg-slate-800 transition-colors"
                >
                  <h3 className="font-semibold text-slate-100 mb-1">Hero Management</h3>
                  <p className="text-sm text-slate-400">Manage featured hero slots</p>
                </a>
                <a
                  href="/admin/featured"
                  className="p-4 rounded-lg border border-slate-800 bg-slate-950 hover:bg-slate-800 transition-colors"
                >
                  <h3 className="font-semibold text-slate-100 mb-1">Featured Content</h3>
                  <p className="text-sm text-slate-400">Curate featured storybooks</p>
                </a>
                <a
                  href="/admin/audit-logs"
                  className="p-4 rounded-lg border border-slate-800 bg-slate-950 hover:bg-slate-800 transition-colors"
                >
                  <h3 className="font-semibold text-slate-100 mb-1">Audit Logs</h3>
                  <p className="text-sm text-slate-400">View admin activity logs</p>
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    </ProtectedAdminRoute>
  );
}
