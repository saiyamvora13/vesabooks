import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import ProtectedAdminRoute from "@/components/admin/ProtectedAdminRoute";
import AdminLayout from "@/components/admin/AdminLayout";
import OrderDetailsDialog from "@/components/admin/OrderDetailsDialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, Search, Package, ChevronLeft, ChevronRight } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useIsMobile } from "@/hooks/use-mobile";
import { CheckCircle2, Clock, XCircle, AlertCircle } from "lucide-react";

interface Order {
  orderReference: string;
  customerEmail: string;
  storybookTitle: string;
  productType: string;
  amount: number;
  status: string;
  createdAt: string;
}

interface OrderSearchResult {
  orders: Order[];
  total: number;
  limit: number;
  offset: number;
}

export default function AdminOrders() {
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [productTypeFilter, setProductTypeFilter] = useState("all");
  const [dateRangeFilter, setDateRangeFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedOrderReference, setSelectedOrderReference] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const limit = 50;
  const offset = (currentPage - 1) * limit;

  const getDateRange = () => {
    const now = new Date();
    const ranges: Record<string, { dateFrom?: Date; dateTo?: Date }> = {
      "7days": { dateFrom: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), dateTo: now },
      "30days": { dateFrom: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), dateTo: now },
      "90days": { dateFrom: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000), dateTo: now },
      all: {},
    };
    return ranges[dateRangeFilter] || {};
  };

  const buildQueryParams = () => {
    const params: Record<string, string> = {
      limit: limit.toString(),
      offset: offset.toString(),
    };

    if (searchQuery.trim()) {
      if (searchQuery.startsWith("ORDER-")) {
        params.orderReference = searchQuery;
      } else if (searchQuery.includes("@")) {
        params.email = searchQuery;
      } else {
        params.storybookTitle = searchQuery;
      }
    }

    if (statusFilter !== "all") {
      params.status = statusFilter;
    }

    if (productTypeFilter !== "all") {
      params.productType = productTypeFilter;
    }

    const dateRange = getDateRange();
    if (dateRange.dateFrom) {
      params.dateFrom = dateRange.dateFrom.toISOString();
    }
    if (dateRange.dateTo) {
      params.dateTo = dateRange.dateTo.toISOString();
    }

    return params;
  };

  const queryParams = buildQueryParams();
  const queryString = new URLSearchParams(queryParams).toString();

  const { data: ordersData, isLoading } = useQuery<OrderSearchResult>({
    queryKey: ["/api/admin/orders", queryString],
    queryFn: async () => {
      const response = await fetch(`/api/admin/orders?${queryString}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      if (!response.ok) throw new Error("Failed to fetch orders");
      return response.json();
    },
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, productTypeFilter, dateRangeFilter]);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/orders"] });
  };

  const handleOrderClick = (orderReference: string) => {
    setSelectedOrderReference(orderReference);
    setDialogOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setSelectedOrderReference(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orders"] });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { className: string; icon: any }> = {
      completed: { className: "bg-green-500/20 text-green-400 border-green-500/50", icon: CheckCircle2 },
      pending: { className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50", icon: Clock },
      failed: { className: "bg-red-500/20 text-red-400 border-red-500/50", icon: XCircle },
      refunded: { className: "bg-slate-500/20 text-slate-400 border-slate-500/50", icon: AlertCircle },
    };

    const variant = variants[status] || variants.pending;
    const Icon = variant.icon;

    return (
      <Badge className={variant.className}>
        <Icon className="w-3 h-3 mr-1" />
        {status}
      </Badge>
    );
  };

  const getTypeBadge = (type: string) => {
    const isDigital = type === "digital";
    return (
      <Badge className={isDigital ? "bg-blue-500/20 text-blue-400 border-blue-500/50" : "bg-purple-500/20 text-purple-400 border-purple-500/50"}>
        {isDigital ? "Digital" : "Print"}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const totalPages = ordersData ? Math.ceil(ordersData.total / limit) : 1;

  return (
    <ProtectedAdminRoute>
      <AdminLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Order Management</h1>
              <p className="text-sm sm:text-base text-slate-200">
                Search, filter, and manage customer orders
              </p>
            </div>
            <Button
              onClick={handleRefresh}
              variant="outline"
              className="border-slate-600 text-slate-100 hover:bg-slate-700 hover:text-white w-full sm:w-auto"
              data-testid="button-refresh"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>

          {/* Filters */}
          <Card className="bg-slate-800 border-slate-700 p-4 sm:p-6">
            <div className="space-y-4">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search by order ID, email, or storybook title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-slate-800 border-slate-600 text-white placeholder:text-slate-400"
                  data-testid="input-search"
                />
              </div>

              {/* Filter Dropdowns */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Status Filter */}
                <div className="space-y-2">
                  <label className="text-xs text-slate-200 font-medium">Status</label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger 
                      className="bg-slate-800 border-slate-600 text-white"
                      data-testid="select-status-filter"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-600 text-white">
                      <SelectItem value="all" className="text-white hover:bg-slate-700 focus:bg-slate-700 focus:text-white">All</SelectItem>
                      <SelectItem value="completed" className="text-white hover:bg-slate-700 focus:bg-slate-700 focus:text-white">Completed</SelectItem>
                      <SelectItem value="pending" className="text-white hover:bg-slate-700 focus:bg-slate-700 focus:text-white">Pending</SelectItem>
                      <SelectItem value="failed" className="text-white hover:bg-slate-700 focus:bg-slate-700 focus:text-white">Failed</SelectItem>
                      <SelectItem value="refunded" className="text-white hover:bg-slate-700 focus:bg-slate-700 focus:text-white">Refunded</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Product Type Filter */}
                <div className="space-y-2">
                  <label className="text-xs text-slate-200 font-medium">Product Type</label>
                  <Select value={productTypeFilter} onValueChange={setProductTypeFilter}>
                    <SelectTrigger 
                      className="bg-slate-800 border-slate-600 text-white"
                      data-testid="select-product-type-filter"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-600 text-white">
                      <SelectItem value="all" className="text-white hover:bg-slate-700 focus:bg-slate-700 focus:text-white">All</SelectItem>
                      <SelectItem value="digital" className="text-white hover:bg-slate-700 focus:bg-slate-700 focus:text-white">Digital</SelectItem>
                      <SelectItem value="print" className="text-white hover:bg-slate-700 focus:bg-slate-700 focus:text-white">Print</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Date Range Filter */}
                <div className="space-y-2">
                  <label className="text-xs text-slate-200 font-medium">Date Range</label>
                  <Select value={dateRangeFilter} onValueChange={setDateRangeFilter}>
                    <SelectTrigger 
                      className="bg-slate-800 border-slate-600 text-white"
                      data-testid="select-date-range-filter"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-600 text-white">
                      <SelectItem value="all" className="text-white hover:bg-slate-700 focus:bg-slate-700 focus:text-white">All time</SelectItem>
                      <SelectItem value="7days" className="text-white hover:bg-slate-700 focus:bg-slate-700 focus:text-white">Last 7 days</SelectItem>
                      <SelectItem value="30days" className="text-white hover:bg-slate-700 focus:bg-slate-700 focus:text-white">Last 30 days</SelectItem>
                      <SelectItem value="90days" className="text-white hover:bg-slate-700 focus:bg-slate-700 focus:text-white">Last 90 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </Card>

          {/* Orders Table */}
          <Card className="bg-slate-800 border-slate-700">
            <div className="overflow-x-auto">
              {isLoading ? (
                <div className="p-6 space-y-4">
                  {[...Array(10)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full bg-slate-800" />
                  ))}
                </div>
              ) : ordersData && ordersData.orders.length > 0 ? (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-600 hover:bg-slate-700/50">
                        <TableHead className="text-white font-semibold">Order Reference</TableHead>
                        <TableHead className="text-white font-semibold">Customer Email</TableHead>
                        <TableHead className="text-white font-semibold">Storybook Title</TableHead>
                        <TableHead className="text-white font-semibold">Type</TableHead>
                        <TableHead className="text-white font-semibold">Amount</TableHead>
                        <TableHead className="text-white font-semibold">Status</TableHead>
                        <TableHead className="text-white font-semibold">Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ordersData.orders.map((order) => (
                        <TableRow
                          key={order.orderReference}
                          className="border-slate-600 hover:bg-slate-700/70 cursor-pointer transition-colors"
                          onClick={() => handleOrderClick(order.orderReference)}
                          data-testid={`row-order-${order.orderReference}`}
                        >
                          <TableCell className="font-mono text-purple-300 hover:text-purple-200 font-medium">
                            {order.orderReference}
                          </TableCell>
                          <TableCell className="text-slate-50">{order.customerEmail}</TableCell>
                          <TableCell className="text-slate-50 max-w-xs truncate">
                            {order.storybookTitle}
                          </TableCell>
                          <TableCell>{getTypeBadge(order.productType)}</TableCell>
                          <TableCell className="text-white font-semibold">
                            {formatCurrency(order.amount)}
                          </TableCell>
                          <TableCell>{getStatusBadge(order.status)}</TableCell>
                          <TableCell className="text-slate-200 text-sm">
                            {formatDate(order.createdAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  <div className="p-4 border-t border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-sm text-slate-300">
                      Showing {offset + 1} to {Math.min(offset + limit, ordersData.total)} of {ordersData.total} orders
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        variant="outline"
                        size="sm"
                        className="border-slate-600 text-slate-200 hover:bg-slate-700 disabled:opacity-50"
                        data-testid="button-prev-page"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        {!isMobile && <span className="ml-1">Previous</span>}
                      </Button>
                      <span className="text-sm text-slate-300">
                        Page {currentPage} of {totalPages}
                      </span>
                      <Button
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        variant="outline"
                        size="sm"
                        className="border-slate-600 text-slate-200 hover:bg-slate-700 disabled:opacity-50"
                        data-testid="button-next-page"
                      >
                        {!isMobile && <span className="mr-1">Next</span>}
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-slate-300">
                  <Package className="w-16 h-16 mb-4 text-slate-500" />
                  <h3 className="text-lg font-semibold mb-2">No Orders Found</h3>
                  <p className="text-sm text-center max-w-md">
                    {searchQuery || statusFilter !== "all" || productTypeFilter !== "all" || dateRangeFilter !== "all"
                      ? "Try adjusting your search filters to find what you're looking for."
                      : "Orders will appear here once customers make purchases."}
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Order Details Dialog */}
        {selectedOrderReference && (
          <OrderDetailsDialog
            orderReference={selectedOrderReference}
            open={dialogOpen}
            onOpenChange={handleDialogClose}
          />
        )}
      </AdminLayout>
    </ProtectedAdminRoute>
  );
}
