import { useQuery } from "@tanstack/react-query";
import ProtectedAdminRoute from "@/components/admin/ProtectedAdminRoute";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, ResponsiveTable, ResponsiveRow, ResponsiveHeader, ResponsiveBody } from "@/components/ui/table";
import { DollarSign, BookOpen, Users, Star, TrendingUp, RefreshCw } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Storybook } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";
import { useIsMobile } from "@/hooks/use-mobile";

interface OverviewMetrics {
  totalRevenue: number;
  revenueByType: {
    digital: number;
    print: number;
  };
  totalStories: number;
  activeUsers: number;
  completionRate: number;
  averageRating: number | null;
}

interface RevenueTrend {
  date: string;
  type: string;
  revenue: string;
}

interface Theme {
  theme: string;
  count: number;
}

interface UserRetention {
  newUsersTrend: Array<{
    date: string;
    new_users: string;
  }>;
  returningUsers: number;
  totalUsers: number;
  retentionRate: number;
}

export default function AdminAnalytics() {
  const { data: overview, isLoading: overviewLoading } = useQuery<OverviewMetrics>({
    queryKey: ["/api/admin/analytics/overview"],
  });

  const { data: revenueTrends, isLoading: trendsLoading } = useQuery<RevenueTrend[]>({
    queryKey: ["/api/admin/analytics/revenue-trends"],
  });

  const { data: themes, isLoading: themesLoading } = useQuery<Theme[]>({
    queryKey: ["/api/admin/analytics/popular-themes"],
  });

  const { data: retention, isLoading: retentionLoading } = useQuery<UserRetention>({
    queryKey: ["/api/admin/analytics/user-retention"],
  });

  const { data: storybooks } = useQuery<Storybook[]>({
    queryKey: ["/api/storybooks"],
  });

  const isMobile = useIsMobile();

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/analytics/overview"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/analytics/revenue-trends"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/analytics/popular-themes"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/analytics/user-retention"] });
    queryClient.invalidateQueries({ queryKey: ["/api/storybooks"] });
  };

  // Transform revenue trends data for chart
  const revenueChartData = revenueTrends?.reduce((acc, item) => {
    const date = new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const existing = acc.find(d => d.date === date);
    const revenue = Number(item.revenue) / 100;
    
    if (existing) {
      if (item.type === 'digital') {
        existing.digital = revenue;
      } else {
        existing.print = revenue;
      }
    } else {
      acc.push({
        date,
        digital: item.type === 'digital' ? revenue : 0,
        print: item.type === 'print' ? revenue : 0,
      });
    }
    return acc;
  }, [] as Array<{ date: string; digital: number; print: number }>) || [];

  // Transform user growth data for chart
  const userGrowthData = retention?.newUsersTrend.map(item => ({
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    users: Number(item.new_users),
  })) || [];

  // Get top rated stories (simplified - using shareCount + viewCount as proxy for popularity)
  const topRatedStories = storybooks
    ?.filter(s => !s.deletedAt)
    ?.sort((a, b) => (Number(b.shareCount) + Number(b.viewCount)) - (Number(a.shareCount) + Number(a.viewCount)))
    ?.slice(0, 5) || [];

  const tableHeaders = ["Title", "Author", "Views", "Shares", "Created"];

  return (
    <ProtectedAdminRoute>
      <AdminLayout>
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-100 mb-2">Analytics Dashboard</h1>
              <p className="text-slate-400">Comprehensive insights and metrics</p>
            </div>
            <Button
              onClick={handleRefresh}
              variant="outline"
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
              data-testid="button-refresh"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh Data
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">Total Revenue</CardTitle>
                <DollarSign className="w-5 h-5 text-green-500" />
              </CardHeader>
              <CardContent>
                {overviewLoading ? (
                  <Skeleton className="h-10 w-24 bg-slate-800" />
                ) : (
                  <div>
                    <div className="text-3xl font-bold text-slate-100" data-testid="stat-total-revenue">
                      ${overview?.totalRevenue.toFixed(2) || '0.00'}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Digital: ${overview?.revenueByType.digital.toFixed(2)} | Print: ${overview?.revenueByType.print.toFixed(2)}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-800">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">Total Stories</CardTitle>
                <BookOpen className="w-5 h-5 text-purple-500" />
              </CardHeader>
              <CardContent>
                {overviewLoading ? (
                  <Skeleton className="h-10 w-24 bg-slate-800" />
                ) : (
                  <div className="text-3xl font-bold text-slate-100" data-testid="stat-total-stories">
                    {overview?.totalStories || 0}
                  </div>
                )}
                <p className="text-xs text-slate-500 mt-1">Stories created</p>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-800">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">Active Users</CardTitle>
                <Users className="w-5 h-5 text-blue-500" />
              </CardHeader>
              <CardContent>
                {overviewLoading ? (
                  <Skeleton className="h-10 w-24 bg-slate-800" />
                ) : (
                  <div className="text-3xl font-bold text-slate-100" data-testid="stat-active-users">
                    {overview?.activeUsers || 0}
                  </div>
                )}
                <p className="text-xs text-slate-500 mt-1">Users with stories</p>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-800">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">Avg Rating</CardTitle>
                <Star className="w-5 h-5 text-yellow-500" />
              </CardHeader>
              <CardContent>
                {overviewLoading ? (
                  <Skeleton className="h-10 w-24 bg-slate-800" />
                ) : (
                  <div className="text-3xl font-bold text-slate-100" data-testid="stat-avg-rating">
                    {overview?.averageRating?.toFixed(1) || 'N/A'}
                  </div>
                )}
                <p className="text-xs text-slate-500 mt-1">Out of 5 stars</p>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-800">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">Completion Rate</CardTitle>
                <TrendingUp className="w-5 h-5 text-orange-500" />
              </CardHeader>
              <CardContent>
                {overviewLoading ? (
                  <Skeleton className="h-10 w-24 bg-slate-800" />
                ) : (
                  <div className="text-3xl font-bold text-slate-100" data-testid="stat-completion-rate">
                    {overview?.completionRate.toFixed(1) || 0}%
                  </div>
                )}
                <p className="text-xs text-slate-500 mt-1">Stories completed</p>
              </CardContent>
            </Card>
          </div>

          {/* Revenue Chart */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-slate-100">Revenue Trends (Last 30 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              {trendsLoading ? (
                <Skeleton className="h-[300px] w-full bg-slate-800" />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={revenueChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                      labelStyle={{ color: '#e2e8f0' }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="digital" stroke="#8b5cf6" name="Digital" strokeWidth={2} />
                    <Line type="monotone" dataKey="print" stroke="#10b981" name="Print" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Popular Themes */}
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-slate-100">Popular Themes</CardTitle>
              </CardHeader>
              <CardContent>
                {themesLoading ? (
                  <Skeleton className="h-[300px] w-full bg-slate-800" />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={themes}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="theme" stroke="#94a3b8" angle={-45} textAnchor="end" height={80} />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                        labelStyle={{ color: '#e2e8f0' }}
                      />
                      <Bar dataKey="count" fill="#8b5cf6" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* User Growth */}
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-slate-100">User Growth (Last 30 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                {retentionLoading ? (
                  <Skeleton className="h-[300px] w-full bg-slate-800" />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={userGrowthData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="date" stroke="#94a3b8" angle={-45} textAnchor="end" height={80} />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                        labelStyle={{ color: '#e2e8f0' }}
                      />
                      <Line type="monotone" dataKey="users" stroke="#3b82f6" name="New Users" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* User Retention Stats */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-slate-100">User Retention</CardTitle>
            </CardHeader>
            <CardContent>
              {retentionLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Skeleton className="h-20 bg-slate-800" />
                  <Skeleton className="h-20 bg-slate-800" />
                  <Skeleton className="h-20 bg-slate-800" />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-slate-950 rounded-lg">
                    <div className="text-2xl font-bold text-slate-100">{retention?.totalUsers || 0}</div>
                    <div className="text-sm text-slate-400">Total Users</div>
                  </div>
                  <div className="p-4 bg-slate-950 rounded-lg">
                    <div className="text-2xl font-bold text-slate-100">{retention?.returningUsers || 0}</div>
                    <div className="text-sm text-slate-400">Returning Users</div>
                  </div>
                  <div className="p-4 bg-slate-950 rounded-lg">
                    <div className="text-2xl font-bold text-slate-100">{retention?.retentionRate.toFixed(1)}%</div>
                    <div className="text-sm text-slate-400">Retention Rate</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Rated Stories */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-slate-100">Top Popular Stories</CardTitle>
            </CardHeader>
            <CardContent>
              {topRatedStories.length === 0 ? (
                <div className="text-center text-slate-500 py-8">
                  No stories available
                </div>
              ) : (
                <div className={isMobile ? "" : "rounded-lg border border-slate-800 bg-slate-950"}>
                  <ResponsiveTable>
                    <ResponsiveHeader>
                      <TableRow className="border-slate-800 hover:bg-slate-800/50">
                        <TableHead className="text-slate-400">Title</TableHead>
                        <TableHead className="text-slate-400">Author</TableHead>
                        <TableHead className="text-slate-400 text-right">Views</TableHead>
                        <TableHead className="text-slate-400 text-right">Shares</TableHead>
                        <TableHead className="text-slate-400 text-right">Created</TableHead>
                      </TableRow>
                    </ResponsiveHeader>
                    <ResponsiveBody>
                      {topRatedStories.map((story) => (
                        <ResponsiveRow 
                          key={story.id} 
                          headers={tableHeaders} 
                          className={isMobile ? "" : "border-slate-800 hover:bg-slate-800/50"} 
                          data-testid={`story-row-${story.id}`}
                        >
                          <TableCell className="text-slate-300 font-medium">{story.title}</TableCell>
                          <TableCell className="text-slate-400">{story.author || 'Anonymous'}</TableCell>
                          <TableCell className={isMobile ? "" : "text-right"}>{Number(story.viewCount)}</TableCell>
                          <TableCell className={isMobile ? "" : "text-right"}>{Number(story.shareCount)}</TableCell>
                          <TableCell className={isMobile ? "" : "text-right"}>
                            {story.createdAt ? new Date(story.createdAt).toLocaleDateString() : 'N/A'}
                          </TableCell>
                        </ResponsiveRow>
                      ))}
                    </ResponsiveBody>
                  </ResponsiveTable>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    </ProtectedAdminRoute>
  );
}
