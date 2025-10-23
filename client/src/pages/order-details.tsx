import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import Navigation from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Package, ArrowLeft, Truck, MapPin, Calendar, DollarSign, FileText, Download, ExternalLink } from "lucide-react";
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
    return format(new Date(dateString), 'EEEE, MMMM d, yyyy');
  } catch {
    return 'Invalid Date';
  }
}

function formatPrice(priceStr: string): string {
  const price = parseFloat(priceStr);
  return (price / 100).toFixed(2);
}

export default function OrderDetails() {
  const { orderId } = useParams();
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading } = useAuth();

  const { data: ordersData, isLoading } = useQuery<OrdersResponse>({
    queryKey: ["/api/print-orders/user"],
    enabled: !!user && !authLoading,
  });

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="h-8 w-48 mb-6" />
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-1/3" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-40 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!user) {
    setLocation("/auth");
    return null;
  }

  const order = ordersData?.orders.find(o => o.orderId === orderId);

  if (!order) {
    return (
      <div className="min-h-screen bg-background">
        <SEO
          title="Order Not Found | AI Storybook Builder"
          description="Order details"
        />
        <Navigation />
        <div className="container mx-auto px-4 py-16 text-center">
          <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-2xl font-bold mb-2">Order Not Found</h1>
          <p className="text-muted-foreground mb-6">
            We couldn't find the order you're looking for.
          </p>
          <Button onClick={() => setLocation("/orders")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Orders
          </Button>
        </div>
      </div>
    );
  }

  const shortOrderId = order.orderId.slice(-8);
  const hasTracking = order.items.some(item => item.trackingUrl || item.trackingNumber);

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={`Order ${shortOrderId} | AI Storybook Builder`}
        description="View your order details and tracking information."
      />
      <Navigation />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Back Button */}
          <Button
            variant="ghost"
            onClick={() => setLocation("/orders")}
            className="mb-6"
            data-testid="button-back-to-orders"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Orders
          </Button>

          {/* Order Header */}
          <div className="mb-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-3xl font-bold mb-2" data-testid="heading-order-details">
                  Order Details
                </h1>
                <p className="text-muted-foreground">
                  Order #{shortOrderId} • Placed on {formatDate(order.createdAt)}
                </p>
              </div>
              <Badge className={getStatusBadgeClasses(order.status)}>
                {formatStatus(order.status)}
              </Badge>
            </div>
          </div>

          <div className="grid gap-6">
            {/* Items Ordered */}
            <Card>
              <CardHeader>
                <CardTitle>Items Ordered</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {order.items.map((item, index) => (
                  <div key={item.id}>
                    {index > 0 && <Separator className="my-4" />}
                    <div className="flex gap-4" data-testid={`order-item-detail-${item.id}`}>
                      <div className="flex-shrink-0">
                        {item.storybook.coverImageUrl ? (
                          <img
                            src={item.storybook.coverImageUrl}
                            alt={item.storybook.title}
                            className="w-24 h-32 object-cover rounded border"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-24 h-32 bg-muted rounded border flex items-center justify-center">
                            <Package className="h-10 w-10 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <Link href={`/view/${item.storybook.id}`}>
                          <h3 className="font-semibold text-lg hover:text-primary cursor-pointer mb-2">
                            {item.storybook.title}
                          </h3>
                        </Link>
                        <div className="space-y-1 text-sm text-muted-foreground">
                          <p>Format: {item.purchase.bookSize?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
                          <p>Hardcover Book</p>
                          <p className="font-medium text-foreground">${formatPrice(item.purchase.price)}</p>
                        </div>
                        {item.trackingNumber && (
                          <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                            <div className="flex items-start gap-2">
                              <Truck className="h-4 w-4 mt-0.5 text-primary" />
                              <div className="flex-1 text-sm">
                                <p className="font-medium mb-1">Tracking Information</p>
                                {item.carrier && (
                                  <p className="text-muted-foreground">
                                    Carrier: {item.carrier} {item.carrierService}
                                  </p>
                                )}
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-muted-foreground">Tracking:</span>
                                  {item.trackingUrl ? (
                                    <a
                                      href={item.trackingUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-primary hover:underline inline-flex items-center gap-1 font-mono"
                                    >
                                      {item.trackingNumber}
                                      <ExternalLink className="h-3 w-3" />
                                    </a>
                                  ) : (
                                    <span className="font-mono">{item.trackingNumber}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Payment Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Payment Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Payment Method</span>
                    <span className="font-medium">Card</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Items ({order.itemCount})</span>
                    <span>${formatPrice(order.totalAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Shipping & Handling</span>
                    <span>Included</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-semibold text-base">
                    <span>Order Total</span>
                    <span>${formatPrice(order.totalAmount)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Shipping Address */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Shipping Address</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  <p className="font-medium">Your Shipping Address</p>
                  <p className="text-muted-foreground">
                    The address you provided at checkout
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Order Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Order Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Calendar className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 pt-1">
                      <p className="font-medium">Order Placed</p>
                      <p className="text-sm text-muted-foreground">{formatDate(order.createdAt)}</p>
                    </div>
                  </div>

                  {order.status.toLowerCase() !== 'pending' && (
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Package className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 pt-1">
                        <p className="font-medium">Processing</p>
                        <p className="text-sm text-muted-foreground">Your order is being prepared</p>
                      </div>
                    </div>
                  )}

                  {hasTracking && (
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Truck className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 pt-1">
                        <p className="font-medium">Shipped</p>
                        <p className="text-sm text-muted-foreground">
                          {order.items[0]?.dispatchDate ? formatDate(order.items[0].dispatchDate) : 'In transit'}
                        </p>
                      </div>
                    </div>
                  )}

                  {order.status.toLowerCase() === 'complete' && (
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
                        <MapPin className="h-4 w-4 text-green-600" />
                      </div>
                      <div className="flex-1 pt-1">
                        <p className="font-medium text-green-600">Delivered</p>
                        <p className="text-sm text-muted-foreground">
                          {order.items[0]?.dispatchDate ? formatDate(order.items[0].dispatchDate) : 'Completed'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex flex-wrap gap-3">
              {hasTracking && order.items.find(item => item.trackingUrl) && (
                <Button
                  variant="default"
                  onClick={() => window.open(order.items.find(item => item.trackingUrl)?.trackingUrl!, '_blank')}
                  data-testid="button-track-package"
                >
                  <Truck className="h-4 w-4 mr-2" />
                  Track Package
                </Button>
              )}
              <Button
                variant="outline"
                data-testid="button-download-invoice"
              >
                <Download className="h-4 w-4 mr-2" />
                Download Invoice
              </Button>
              <Button
                variant="outline"
                data-testid="button-print-order"
              >
                <FileText className="h-4 w-4 mr-2" />
                Print Order Summary
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
