import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import Navigation from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Package, ShoppingBag, ExternalLink, Calendar, Truck, MapPin, Copy, Check, ChevronRight, FileText, Download, Filter } from "lucide-react";
import { format, subMonths, subYears, subDays, isWithinInterval, startOfYear, endOfYear, startOfDay, endOfDay } from "date-fns";
import { SEO } from "@/components/SEO";

interface OrderItem {
  id: string;
  purchaseId: string;
  prodigiOrderId: string | null;
  status: string;
  trackingNumber: string | null;
  trackingUrl: string | null;
  carrier: string | null;
  carrierService: string | null;
  shipmentStatus: string | null;
  dispatchDate: string | null;
  estimatedDelivery: string | null;
  createdAt: string;
  updatedAt: string;
  purchase: {
    id: string;
    type: string;
    price: string;
    bookSize: string;
  };
  storybook: {
    id: string;
    title: string;
    coverImageUrl: string | null;
  };
}

interface GroupedOrder {
  orderId: string;
  itemCount: number;
  totalAmount: string;
  status: string;
  createdAt: string;
  items: OrderItem[];
}

interface OrdersResponse {
  orders: GroupedOrder[];
}

function getStatusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status.toLowerCase()) {
    case 'complete':
      return 'default';
    case 'inprogress':
    case 'in progress':
      return 'secondary';
    case 'cancelled':
      return 'destructive';
    case 'pending':
    default:
      return 'outline';
  }
}

function getStatusBadgeClasses(status: string): string {
  switch (status.toLowerCase()) {
    case 'complete':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-200 dark:border-green-800';
    case 'inprogress':
    case 'in progress':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-800';
    case 'cancelled':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-200 dark:border-red-800';
    case 'pending':
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700';
  }
}

function formatStatus(status: string): string {
  switch (status.toLowerCase()) {
    case 'inprogress':
      return 'In Progress';
    case 'complete':
      return 'Delivered';
    case 'cancelled':
      return 'Cancelled';
    case 'pending':
    default:
      return 'Processing';
  }
}

function formatDate(dateString: string | null): string {
  if (!dateString) return 'N/A';
  try {
    return format(new Date(dateString), 'MMMM d, yyyy');
  } catch {
    return 'Invalid Date';
  }
}

function formatPrice(priceStr: string): string {
  const price = parseFloat(priceStr);
  return (price / 100).toFixed(2);
}

function OrderCard({ order }: { order: GroupedOrder }) {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [copied, setCopied] = useState(false);
  
  const fullOrderId = order.orderId;
  const shortOrderId = fullOrderId.slice(-8);
  const hasTracking = order.items.some(item => item.trackingUrl || item.trackingNumber);
  const primaryTracking = order.items.find(item => item.trackingUrl)?.trackingUrl;

  const copyFullId = () => {
    navigator.clipboard.writeText(fullOrderId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow" data-testid={`order-card-${order.orderId}`}>
      <CardHeader className="bg-muted/30 dark:bg-muted/10 py-3 px-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">ORDER PLACED</span>
              <p className="font-medium">{formatDate(order.createdAt)}</p>
            </div>
            <Separator orientation="vertical" className="hidden sm:block h-8" />
            <div>
              <span className="text-muted-foreground">TOTAL</span>
              <p className="font-medium" data-testid={`order-total-${order.orderId}`}>
                ${formatPrice(order.totalAmount)}
              </p>
            </div>
            <Separator orientation="vertical" className="hidden sm:block h-8" />
            <div>
              <span className="text-muted-foreground">SHIP TO</span>
              <p className="font-medium">You</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-sm text-right">
              <span className="text-muted-foreground block">ORDER # </span>
              <button
                onClick={copyFullId}
                className="font-mono text-primary hover:underline inline-flex items-center gap-1"
                data-testid={`order-id-${order.orderId}`}
                title={`Copy full ID: ${fullOrderId}`}
              >
                {shortOrderId}
                {copied ? (
                  <Check className="h-3 w-3 text-green-600" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </button>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge 
                variant={getStatusBadgeVariant(order.status)}
                className={getStatusBadgeClasses(order.status)}
                data-testid={`order-status-${order.orderId}`}
              >
                {formatStatus(order.status)}
              </Badge>
              {order.status.toLowerCase() === 'complete' && (
                <span className="text-sm text-muted-foreground">
                  on {formatDate(order.items[0]?.dispatchDate || order.createdAt)}
                </span>
              )}
            </div>
            {order.itemCount > 1 && (
              <p className="text-sm text-muted-foreground">
                {order.itemCount} items in this order
              </p>
            )}
          </div>
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          {order.items.map((item) => (
            <div key={item.id} className="flex gap-3" data-testid={`order-item-${item.id}`}>
              <div className="flex-shrink-0">
                {item.storybook.coverImageUrl ? (
                  <img
                    src={item.storybook.coverImageUrl}
                    alt={item.storybook.title}
                    className="w-20 h-28 object-cover rounded border"
                    data-testid={`item-cover-${item.id}`}
                    loading="lazy"
                  />
                ) : (
                  <div className="w-20 h-28 bg-muted rounded border flex items-center justify-center">
                    <Package className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <Link href={`/view/${item.storybook.id}`}>
                  <h4 className="font-medium text-sm hover:text-primary cursor-pointer line-clamp-2" data-testid={`item-title-${item.id}`}>
                    {item.storybook.title}
                  </h4>
                </Link>
                <p className="text-xs text-muted-foreground mt-1" data-testid={`item-size-${item.id}`}>
                  {item.purchase.bookSize?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </p>
                <p className="text-xs text-muted-foreground" data-testid={`item-price-${item.id}`}>
                  ${formatPrice(item.purchase.price)}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 pt-4 border-t">
          {hasTracking && primaryTracking && (
            <Button
              variant="default"
              size="sm"
              onClick={() => window.open(primaryTracking, '_blank')}
              data-testid={`track-package-${order.orderId}`}
            >
              <Truck className="h-4 w-4 mr-2" />
              Track Package
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLocation(`/orders/${order.orderId}`)}
            data-testid={`view-details-${order.orderId}`}
          >
            <FileText className="h-4 w-4 mr-2" />
            View Order Details
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`/api/print-orders/invoice/${order.orderId}`, '_blank')}
            data-testid={`download-invoice-${order.orderId}`}
          >
            <Download className="h-4 w-4 mr-2" />
            Download Invoice
          </Button>
        </div>

        {/* Tracking Info (if available) */}
        {hasTracking && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-start gap-2 text-sm">
              <Truck className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1">
                {order.items.map((item) => (
                  item.trackingNumber && (
                    <div key={item.id} className="mb-2 last:mb-0">
                      <p className="font-medium">{item.storybook.title}</p>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        {item.carrier && <span>{item.carrier} {item.carrierService}</span>}
                        {item.trackingUrl ? (
                          <a
                            href={item.trackingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline inline-flex items-center gap-1"
                            data-testid={`item-tracking-link-${item.id}`}
                          >
                            {item.trackingNumber}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span>{item.trackingNumber}</span>
                        )}
                      </div>
                    </div>
                  )
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function OrdersSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2].map((i) => (
        <Card key={i} className="overflow-hidden">
          <CardHeader className="bg-muted/30 dark:bg-muted/10 py-3 px-6">
            <div className="flex justify-between">
              <Skeleton className="h-12 w-2/3" />
              <Skeleton className="h-12 w-24" />
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <Skeleton className="h-6 w-32 mb-4" />
            <div className="grid grid-cols-3 gap-4">
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

type DateFilter = 'all' | 'last-30-days' | 'last-3-months' | 'this-year' | 'last-year';

export default function Orders() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');

  const { data: ordersData, isLoading, error } = useQuery<OrdersResponse>({
    queryKey: ["/api/print-orders/user"],
    enabled: !!user && !authLoading,
  });

  // Filter orders by date (using inclusive intervals)
  const filteredOrders = useMemo(() => {
    if (!ordersData?.orders) return [];
    
    const now = new Date();
    const orders = ordersData.orders;
    
    switch (dateFilter) {
      case 'last-30-days': {
        const start = startOfDay(subDays(now, 30));
        const end = endOfDay(now);
        return orders.filter(order => 
          isWithinInterval(new Date(order.createdAt), { start, end })
        );
      }
      case 'last-3-months': {
        const start = startOfDay(subMonths(now, 3));
        const end = endOfDay(now);
        return orders.filter(order => 
          isWithinInterval(new Date(order.createdAt), { start, end })
        );
      }
      case 'this-year': {
        const start = startOfYear(now);
        const end = endOfDay(now);
        return orders.filter(order => 
          isWithinInterval(new Date(order.createdAt), { start, end })
        );
      }
      case 'last-year': {
        const lastYear = subYears(now, 1);
        const start = startOfYear(lastYear);
        const end = endOfYear(lastYear);
        return orders.filter(order => 
          isWithinInterval(new Date(order.createdAt), { start, end })
        );
      }
      case 'all':
      default:
        return orders;
    }
  }, [ordersData, dateFilter]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <OrdersSkeleton />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <SEO
          title="My Orders | AI Storybook Builder"
          description="Track your print book orders and shipping status."
        />
        <Navigation />
        <div className="container mx-auto px-4 py-16 text-center">
          <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-2xl font-bold mb-2">Sign in to view your orders</h1>
          <p className="text-muted-foreground mb-6">
            Please sign in to track your print book orders and shipping status.
          </p>
          <Button onClick={() => setLocation("/auth")} data-testid="button-sign-in">
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  const orders = filteredOrders;

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="My Orders | AI Storybook Builder"
        description="Track your print book orders and shipping status."
      />
      <Navigation />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2">
              <h1 className="text-3xl font-bold" data-testid="heading-orders">
                Your Orders
              </h1>
              {ordersData && ordersData.orders.length > 0 && (
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <Select value={dateFilter} onValueChange={(value) => setDateFilter(value as DateFilter)}>
                    <SelectTrigger className="w-48" data-testid="select-date-filter">
                      <SelectValue placeholder="Filter by date" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Orders</SelectItem>
                      <SelectItem value="last-30-days">Last 30 Days</SelectItem>
                      <SelectItem value="last-3-months">Last 3 Months</SelectItem>
                      <SelectItem value="this-year">This Year</SelectItem>
                      <SelectItem value="last-year">Last Year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            {dateFilter !== 'all' && orders.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Showing {orders.length} {orders.length === 1 ? 'order' : 'orders'}
              </p>
            )}
          </div>

          {/* Orders List */}
          {isLoading ? (
            <OrdersSkeleton />
          ) : error ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Package className="h-12 w-12 mx-auto mb-4 text-destructive" />
                <p className="text-destructive font-medium mb-2">Failed to load orders</p>
                <p className="text-sm text-muted-foreground">
                  {error instanceof Error ? error.message : 'An error occurred'}
                </p>
              </CardContent>
            </Card>
          ) : orders.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <ShoppingBag className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h2 className="text-xl font-semibold mb-2">No orders yet</h2>
                <p className="text-muted-foreground mb-6">
                  When you order print books, they'll appear here.
                </p>
                <Button onClick={() => setLocation("/library")} data-testid="button-browse-library">
                  <Package className="mr-2 h-4 w-4" />
                  Browse Library
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4" data-testid="orders-list">
              {orders.map((order) => (
                <OrderCard key={order.orderId} order={order} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
