import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import Navigation from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Package, ShoppingBag, ExternalLink, Calendar, Truck, MapPin, DollarSign, PackageOpen } from "lucide-react";
import { format } from "date-fns";
import { SEO } from "@/components/SEO";

interface PrintOrder {
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
    totalAmount: string;
    stripePaymentIntentId: string;
  };
  storybook: {
    id: string;
    title: string;
    coverImageUrl: string | null;
  };
}

interface OrdersResponse {
  orders: PrintOrder[];
}

function getStatusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status.toLowerCase()) {
    case 'complete':
      return 'default'; // Green success color
    case 'inprogress':
    case 'in progress':
      return 'secondary'; // Blue info color
    case 'cancelled':
      return 'destructive'; // Red error color
    case 'pending':
    default:
      return 'outline'; // Gray/neutral color
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
      return 'Complete';
    case 'cancelled':
      return 'Cancelled';
    case 'pending':
    default:
      return 'Pending';
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

function OrderCard({ order }: { order: PrintOrder }) {
  const { t } = useTranslation();
  const coverImageUrl = order.storybook.coverImageUrl;
  // Use Stripe Payment Intent ID as unified reference across app, Stripe, and Prodigi
  const orderId = order.purchase.stripePaymentIntentId;
  const hasTracking = order.trackingNumber || order.trackingUrl;

  return (
    <Card className="overflow-hidden" data-testid={`order-card-${order.id}`}>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Cover Image */}
          <div className="flex-shrink-0">
            {coverImageUrl ? (
              <img
                src={coverImageUrl}
                alt={`${order.storybook.title} cover`}
                className="w-full sm:w-24 h-32 sm:h-36 object-cover rounded-lg"
                data-testid={`order-cover-${order.id}`}
                loading="lazy"
              />
            ) : (
              <div className="w-full sm:w-24 h-32 sm:h-36 bg-muted rounded-lg flex items-center justify-center">
                <Package className="h-10 w-10 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Order Info */}
          <div className="flex-1 min-w-0">
            <CardTitle className="text-xl mb-2" data-testid={`order-title-${order.id}`}>
              {order.storybook.title}
            </CardTitle>
            
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">Order #:</span>
                <code className="text-sm font-mono bg-muted px-2 py-0.5 rounded" data-testid={`order-id-${order.id}`}>
                  {orderId}
                </code>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">Status:</span>
                <Badge 
                  variant={getStatusBadgeVariant(order.status)}
                  className={getStatusBadgeClasses(order.status)}
                  data-testid={`order-status-${order.id}`}
                >
                  {formatStatus(order.status)}
                </Badge>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Ordered: {formatDate(order.createdAt)}</span>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Tracking Information */}
        {hasTracking && (
          <>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Truck className="h-4 w-4" />
                <span>Tracking Information</span>
              </div>

              {order.carrier && order.carrierService && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                  <div>
                    <span className="font-medium">Carrier:</span>{' '}
                    <span data-testid={`order-carrier-${order.id}`}>
                      {order.carrier} {order.carrierService}
                    </span>
                  </div>
                </div>
              )}

              {order.trackingNumber && (
                <div className="flex items-start gap-2 text-sm">
                  <Package className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">Tracking Number:</span>{' '}
                    {order.trackingUrl ? (
                      <a
                        href={order.trackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-1"
                        data-testid={`order-tracking-link-${order.id}`}
                      >
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          {order.trackingNumber}
                        </code>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {order.trackingNumber}
                      </code>
                    )}
                  </div>
                </div>
              )}

              {order.dispatchDate && (
                <div className="flex items-start gap-2 text-sm">
                  <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                  <div>
                    <span className="font-medium">Shipped:</span>{' '}
                    <span data-testid={`order-dispatch-date-${order.id}`}>
                      {formatDate(order.dispatchDate)}
                    </span>
                  </div>
                </div>
              )}

              {order.estimatedDelivery && (
                <div className="flex items-start gap-2 text-sm">
                  <PackageOpen className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                  <div>
                    <span className="font-medium">Est. Delivery:</span>{' '}
                    <span data-testid={`order-estimated-delivery-${order.id}`}>
                      {formatDate(order.estimatedDelivery)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Total Amount */}
        <Separator />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <DollarSign className="h-4 w-4" />
            <span>Total Paid</span>
          </div>
          <span className="text-xl font-bold gradient-text" data-testid={`order-total-${order.id}`}>
            ${formatPrice(order.purchase.totalAmount)}
          </span>
        </div>

        {/* View Storybook Link */}
        <Link href={`/view/${order.storybook.id}`}>
          <Button variant="outline" className="w-full" data-testid={`button-view-storybook-${order.id}`}>
            <ShoppingBag className="h-4 w-4 mr-2" />
            View Storybook
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

function OrdersSkeleton() {
  return (
    <div className="space-y-6">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="overflow-hidden">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <Skeleton className="w-full sm:w-24 h-32 sm:h-36 rounded-lg" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-px w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EmptyState() {
  const { t } = useTranslation();
  
  return (
    <Card className="text-center py-12">
      <CardContent className="space-y-4">
        <div className="flex justify-center">
          <div className="rounded-full bg-muted p-6">
            <Package className="h-12 w-12 text-muted-foreground" />
          </div>
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-semibold">No Print Orders Yet</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            You haven't ordered any printed storybooks yet. Browse your library to order your first printed book!
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
          <Link href="/library">
            <Button className="gradient-bg hover:opacity-90 !text-[hsl(258,90%,20%)]" data-testid="button-go-to-library">
              <ShoppingBag className="h-4 w-4 mr-2" />
              Go to Library
            </Button>
          </Link>
          <Link href="/create">
            <Button variant="outline" data-testid="button-create-storybook">
              Create New Storybook
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Orders() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { user, isLoading: isAuthLoading } = useAuth();

  // Redirect to login if not authenticated
  if (!isAuthLoading && !user) {
    setLocation("/login");
    return null;
  }

  // Fetch user's print orders
  const { data, isLoading, error } = useQuery<OrdersResponse>({
    queryKey: ['/api/print-orders/user'],
    enabled: !!user,
  });

  const orders = data?.orders || [];
  
  // Sort orders by creation date (newest first)
  const sortedOrders = [...orders].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title="My Print Orders - StoryForge"
        description="Track your print storybook orders and shipping status"
      />
      <Navigation />
      
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold mb-2 gradient-text">
            My Print Orders
          </h1>
          <p className="text-muted-foreground">
            Track your print storybook orders and shipping status
          </p>
        </div>

        {/* Loading State */}
        {(isLoading || isAuthLoading) && <OrdersSkeleton />}

        {/* Error State */}
        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <p className="text-destructive text-center">
                Failed to load orders. Please try again later.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {!isLoading && !error && sortedOrders.length === 0 && <EmptyState />}

        {/* Orders List */}
        {!isLoading && !error && sortedOrders.length > 0 && (
          <div className="space-y-6" data-testid="orders-list">
            {sortedOrders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
