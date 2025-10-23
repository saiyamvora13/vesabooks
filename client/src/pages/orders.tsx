import { useState } from "react";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Package, ShoppingBag, ExternalLink, Calendar, Truck, MapPin, DollarSign, PackageOpen, Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
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

function OrderItemCard({ item }: { item: OrderItem }) {
  const coverImageUrl = item.storybook.coverImageUrl;
  const hasTracking = item.trackingNumber || item.trackingUrl;

  return (
    <div className="border rounded-lg p-4 bg-muted/30 dark:bg-muted/10" data-testid={`order-item-${item.id}`}>
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Cover Image */}
        <div className="flex-shrink-0">
          {coverImageUrl ? (
            <img
              src={coverImageUrl}
              alt={`${item.storybook.title} cover`}
              className="w-full sm:w-20 h-28 sm:h-30 object-cover rounded-lg"
              data-testid={`item-cover-${item.id}`}
              loading="lazy"
            />
          ) : (
            <div className="w-full sm:w-20 h-28 sm:h-30 bg-muted rounded-lg flex items-center justify-center">
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Item Details */}
        <div className="flex-1 min-w-0 space-y-2">
          <h4 className="font-semibold text-base" data-testid={`item-title-${item.id}`}>
            {item.storybook.title}
          </h4>
          
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span data-testid={`item-size-${item.id}`}>
              {item.purchase.bookSize?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </span>
            <span>•</span>
            <span data-testid={`item-price-${item.id}`}>
              ${formatPrice(item.purchase.price)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Badge 
              variant={getStatusBadgeVariant(item.status)}
              className={`${getStatusBadgeClasses(item.status)} text-xs`}
              data-testid={`item-status-${item.id}`}
            >
              {formatStatus(item.status)}
            </Badge>
          </div>

          {/* Tracking Information */}
          {hasTracking && (
            <div className="space-y-1.5 text-sm pt-2 border-t">
              {item.carrier && item.carrierService && (
                <div className="flex items-center gap-2">
                  <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                  <span data-testid={`item-carrier-${item.id}`}>
                    {item.carrier} {item.carrierService}
                  </span>
                </div>
              )}

              {item.trackingNumber && (
                <div className="flex items-center gap-2">
                  <Package className="h-3.5 w-3.5 text-muted-foreground" />
                  {item.trackingUrl ? (
                    <a
                      href={item.trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1"
                      data-testid={`item-tracking-link-${item.id}`}
                    >
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {item.trackingNumber}
                      </code>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                      {item.trackingNumber}
                    </code>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function OrderCard({ order }: { order: GroupedOrder }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  
  // Use Stripe Payment Intent ID as unified reference across app, Stripe, and Prodigi
  const fullOrderId = order.orderId;
  const shortOrderId = fullOrderId.slice(-8);

  const copyFullId = () => {
    navigator.clipboard.writeText(fullOrderId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Get first item's cover for preview (when collapsed)
  const previewCover = order.items[0]?.storybook.coverImageUrl;

  return (
    <Card className="overflow-hidden" data-testid={`order-card-${order.orderId}`}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Preview Cover (only when collapsed and single item) */}
            {!isOpen && order.itemCount === 1 && previewCover && (
              <div className="flex-shrink-0">
                <img
                  src={previewCover}
                  alt="Order preview"
                  className="w-full sm:w-24 h-32 sm:h-36 object-cover rounded-lg"
                  loading="lazy"
                />
              </div>
            )}

            {/* Order Summary */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4 mb-2">
                <CardTitle className="text-xl" data-testid={`order-title-${order.orderId}`}>
                  Order {order.itemCount > 1 ? `(${order.itemCount} books)` : ''}
                </CardTitle>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    data-testid={`toggle-order-${order.orderId}`}
                  >
                    {isOpen ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
              </div>
              
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-muted-foreground">Order #:</span>
                  <code className="text-sm font-mono bg-muted px-2 py-0.5 rounded" data-testid={`order-id-${order.orderId}`}>
                    {shortOrderId}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copyFullId}
                    className="h-7 px-2"
                    data-testid={`copy-order-id-${order.orderId}`}
                    title={`Copy full ID: ${fullOrderId}`}
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-green-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  <Badge 
                    variant={getStatusBadgeVariant(order.status)}
                    className={getStatusBadgeClasses(order.status)}
                    data-testid={`order-status-${order.orderId}`}
                  >
                    {formatStatus(order.status)}
                  </Badge>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Ordered: {formatDate(order.createdAt)}</span>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium" data-testid={`order-total-${order.orderId}`}>
                    ${formatPrice(order.totalAmount)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>

        {/* Expandable Items Section */}
        <CollapsibleContent>
          <CardContent className="space-y-3 pt-0">
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <PackageOpen className="h-4 w-4" />
                <span>Books in this order:</span>
              </div>
              {order.items.map((item) => (
                <OrderItemCard key={item.id} item={item} />
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function OrdersSkeleton() {
  return (
    <div className="space-y-6">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="overflow-hidden">
          <CardHeader className="pb-4">
            <div className="flex gap-4">
              <Skeleton className="w-24 h-36 rounded-lg" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </div>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

export default function Orders() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading } = useAuth();

  const { data: ordersData, isLoading, error } = useQuery<OrdersResponse>({
    queryKey: ["/api/print-orders/user"],
    enabled: !!user && !authLoading,
  });

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

  const orders = ordersData?.orders || [];

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="My Orders | AI Storybook Builder"
        description="Track your print book orders and shipping status."
      />
      <Navigation />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2" data-testid="heading-orders">
              {t('orders.title', 'My Orders')}
            </h1>
            <p className="text-muted-foreground">
              {t('orders.description', 'Track your print book orders and shipping status')}
            </p>
          </div>

          {/* Orders List */}
          {isLoading ? (
            <OrdersSkeleton />
          ) : error ? (
            <Card>
              <CardContent className="py-12 text-center">
                <PackageOpen className="h-12 w-12 mx-auto mb-4 text-destructive" />
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
            <div className="space-y-6" data-testid="orders-list">
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
