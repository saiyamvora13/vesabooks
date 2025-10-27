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
import { Package, ShoppingBag, ExternalLink, Calendar, Truck, MapPin, Copy, Check, ChevronRight, FileText, Download, Filter, BookOpen } from "lucide-react";
import { format, subMonths, subYears, subDays, isWithinInterval, startOfYear, endOfYear, startOfDay, endOfDay } from "date-fns";
import { SEO } from "@/components/SEO";
import { type Purchase, type Storybook } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { addToCart } from "@/lib/cartUtils";

interface PrintOrderItem {
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
    orderReference: string;
  };
  storybook: {
    id: string;
    title: string;
    coverImageUrl: string | null;
  };
}

interface GroupedPrintOrder {
  orderId: string;
  itemCount: number;
  totalAmount: string;
  status: string;
  createdAt: string;
  items: PrintOrderItem[];
}

interface PrintOrdersResponse {
  orders: GroupedPrintOrder[];
}

interface PurchaseWithStorybook extends Purchase {
  storybook?: Storybook;
}

function getStatusBadgeClasses(status: string): string {
  switch (status.toLowerCase()) {
    case 'complete':
    case 'completed':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-200 dark:border-green-800';
    case 'inprogress':
    case 'in progress':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-800';
    case 'refunded':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 border-orange-200 dark:border-orange-800';
    case 'partially_refunded':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800';
    case 'cancelled':
    case 'failed':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-200 dark:border-red-800';
    case 'pending':
    case 'creating':
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
    case 'completed':
      return 'Completed';
    case 'refunded':
      return 'Refunded';
    case 'partially_refunded':
      return 'Partially Refunded';
    case 'cancelled':
      return 'Cancelled';
    case 'creating':
      return 'Processing';
    case 'pending':
    default:
      return 'Processing';
  }
}

function formatDate(dateString: string | Date | null): string {
  if (!dateString) return 'N/A';
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    return format(date, 'MMMM d, yyyy');
  } catch {
    return 'Invalid Date';
  }
}

function formatPrice(priceStr: string): string {
  const price = parseFloat(priceStr);
  return (price / 100).toFixed(2);
}

function PrintOrderCard({ order }: { order: GroupedPrintOrder }) {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [copied, setCopied] = useState(false);
  
  const fullOrderId = order.orderId;
  const shortOrderId = fullOrderId.slice(-8).toUpperCase();
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
              <span className="text-muted-foreground">TYPE</span>
              <p className="font-medium">Print Book</p>
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

        {/* Tracking Info */}
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

function DigitalPurchaseCard({ purchase }: { purchase: PurchaseWithStorybook }) {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [downloadingEpub, setDownloadingEpub] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fetch pricing settings
  const { data: pricingSettings } = useQuery<{ digital_price: string; print_price: string }>({
    queryKey: ['/api/settings/pricing'],
    staleTime: 5 * 60 * 1000,
  });

  const digitalPrice = pricingSettings?.digital_price ? parseInt(pricingSettings.digital_price) : 399;
  const printPrice = pricingSettings?.print_price ? parseInt(pricingSettings.print_price) : 2499;

  const downloadEpub = async () => {
    if (!purchase.storybook) return;
    
    setDownloadingEpub(true);
    toast({
      title: "Preparing your e-book...",
      description: "Your EPUB file will download shortly.",
    });
    
    try {
      const response = await fetch(`/api/storybooks/${purchase.storybookId}/epub`);
      
      if (!response.ok) {
        throw new Error('Failed to download EPUB');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${purchase.storybook.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.epub`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Download complete!",
        description: "Your e-book has been downloaded successfully.",
      });
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Please try again or contact support if the issue persists.",
        variant: "destructive",
      });
    } finally {
      setDownloadingEpub(false);
    }
  };

  const downloadPrintPdf = async () => {
    if (!purchase.storybook) return;
    
    setDownloadingPdf(true);
    toast({
      title: "Preparing your print PDF...",
      description: "Your PDF file will download shortly.",
    });
    
    try {
      const response = await fetch(`/api/storybooks/${purchase.storybookId}/download-print-pdf`);
      
      if (!response.ok) {
        throw new Error('Failed to download PDF');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${purchase.storybook.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_print.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Download complete!",
        description: "Your print PDF has been downloaded successfully.",
      });
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Please try again or contact support if the issue persists.",
        variant: "destructive",
      });
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleUpgradeToPrint = () => {
    if (!purchase.storybook) return;
    
    const upgradedPrice = Math.max(0, printPrice - digitalPrice);
    
    addToCart({
      storybookId: purchase.storybookId,
      type: 'print',
      title: purchase.storybook.title,
      price: upgradedPrice,
    });
    
    window.dispatchEvent(new Event('cartUpdated'));
    
    toast({
      title: "Added to cart",
      description: `Discounted price: $${(upgradedPrice / 100).toFixed(2)}`,
    });
    
    setLocation('/cart');
  };

  const copyOrderId = () => {
    const orderId = purchase.orderReference || purchase.stripePaymentIntentId || purchase.id;
    navigator.clipboard.writeText(orderId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const orderId = purchase.orderReference || purchase.stripePaymentIntentId || purchase.id;
  const shortOrderId = orderId.slice(-8).toUpperCase();

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow" data-testid={`digital-purchase-card-${purchase.id}`}>
      <CardHeader className="bg-muted/30 dark:bg-muted/10 py-3 px-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">PURCHASED</span>
              <p className="font-medium">{formatDate(purchase.createdAt)}</p>
            </div>
            <Separator orientation="vertical" className="hidden sm:block h-8" />
            <div>
              <span className="text-muted-foreground">PRICE</span>
              <p className="font-medium" data-testid={`purchase-price-${purchase.id}`}>
                ${formatPrice(purchase.price)}
              </p>
            </div>
            <Separator orientation="vertical" className="hidden sm:block h-8" />
            <div>
              <span className="text-muted-foreground">TYPE</span>
              <p className="font-medium">Digital Book</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-sm text-right">
              <span className="text-muted-foreground block">ORDER # </span>
              <button
                onClick={copyOrderId}
                className="font-mono text-primary hover:underline inline-flex items-center gap-1"
                data-testid={`purchase-id-${purchase.id}`}
                title={`Copy full ID: ${orderId}`}
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
          <Badge 
            className={getStatusBadgeClasses(purchase.status)}
            data-testid={`purchase-status-${purchase.id}`}
          >
            {formatStatus(purchase.status)}
          </Badge>
        </div>

        {/* Refund Information */}
        {(purchase.status === 'refunded' || purchase.status === 'partially_refunded') && purchase.refundedAt && (
          <div className="mb-4 p-3 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-md">
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <p className="text-sm font-medium text-orange-900 dark:text-orange-100">
                  {purchase.status === 'refunded' ? 'Full Refund Processed' : 'Partial Refund Processed'}
                </p>
                <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                  Amount: ${formatPrice(purchase.refundAmount || '0')} • {formatDate(purchase.refundedAt)}
                </p>
                {purchase.refundReason && (
                  <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                    Reason: {purchase.refundReason === 'requested_by_customer' ? 'Customer request' : 
                            purchase.refundReason === 'duplicate' ? 'Duplicate charge' : 
                            purchase.refundReason === 'fraudulent' ? 'Fraudulent transaction' : 
                            purchase.refundReason}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Product Display */}
        <div className="flex gap-4 mb-4">
          <div className="flex-shrink-0">
            {purchase.storybook?.coverImageUrl ? (
              <img
                src={purchase.storybook.coverImageUrl}
                alt={purchase.storybook.title}
                className="w-24 h-32 object-cover rounded border"
                data-testid={`purchase-cover-${purchase.id}`}
                loading="lazy"
              />
            ) : (
              <div className="w-24 h-32 bg-muted rounded border flex items-center justify-center">
                <BookOpen className="h-10 w-10 text-muted-foreground" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <Link href={`/view/${purchase.storybookId}`}>
              <h4 className="font-medium text-lg hover:text-primary cursor-pointer mb-2" data-testid={`purchase-title-${purchase.id}`}>
                {purchase.storybook?.title || 'Untitled'}
              </h4>
            </Link>
            <p className="text-sm text-muted-foreground mb-3">
              Digital e-book (EPUB format)
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 pt-4 border-t">
          <Button
            variant="default"
            size="sm"
            onClick={() => setLocation(`/view/${purchase.storybookId}`)}
            data-testid={`view-book-${purchase.id}`}
          >
            <BookOpen className="h-4 w-4 mr-2" />
            Read Book
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={downloadEpub}
            disabled={downloadingEpub}
            data-testid={`download-epub-${purchase.id}`}
          >
            <Download className="h-4 w-4 mr-2" />
            {downloadingEpub ? 'Downloading...' : 'Download EPUB'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={downloadPrintPdf}
            disabled={downloadingPdf}
            data-testid={`download-pdf-${purchase.id}`}
          >
            <Download className="h-4 w-4 mr-2" />
            {downloadingPdf ? 'Downloading...' : 'Download PDF'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleUpgradeToPrint}
            data-testid={`upgrade-print-${purchase.id}`}
          >
            <Package className="h-4 w-4 mr-2" />
            Order Print Book
          </Button>
        </div>
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
type TypeFilter = 'all' | 'digital' | 'print';

export default function Orders() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  // Fetch print orders
  const { data: printOrdersData, isLoading: printLoading } = useQuery<PrintOrdersResponse>({
    queryKey: ["/api/print-orders/user"],
    enabled: !!user && !authLoading,
  });

  // Fetch all purchases
  const { data: purchases, isLoading: purchasesLoading } = useQuery<Purchase[]>({
    queryKey: ['/api/purchases'],
    enabled: !!user && !authLoading,
  });

  // Fetch storybook details for digital purchases
  const digitalPurchases = useMemo(() => 
    purchases?.filter(p => p.type === 'digital' && p.status === 'completed') || [],
    [purchases]
  );

  const purchasesWithStorybooks = useQuery<PurchaseWithStorybook[]>({
    queryKey: ['/api/purchases/with-storybooks', digitalPurchases],
    queryFn: async () => {
      if (!digitalPurchases || digitalPurchases.length === 0) return [];
      
      const storybookIds = Array.from(new Set(digitalPurchases.map(p => p.storybookId)));
      
      const chunkSize = 100;
      const chunks: string[][] = [];
      for (let i = 0; i < storybookIds.length; i += chunkSize) {
        chunks.push(storybookIds.slice(i, i + chunkSize));
      }
      
      const chunkResults = await Promise.all(
        chunks.map(async (chunk) => {
          const response = await fetch('/api/storybooks/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: chunk }),
          });
          
          if (!response.ok) {
            throw new Error('Failed to fetch storybooks');
          }
          
          return response.json() as Promise<Storybook[]>;
        })
      );
      
      const storybooks = chunkResults.flat();
      const storybookMap = new Map(storybooks.map(s => [s.id, s]));
      
      return digitalPurchases.map(purchase => ({
        ...purchase,
        storybook: storybookMap.get(purchase.storybookId),
      }));
    },
    enabled: digitalPurchases.length > 0,
  });

  // Filter by date
  const filteredByDate = useMemo(() => {
    const digitalOrders = purchasesWithStorybooks.data || [];
    const printOrders = printOrdersData?.orders || [];
    
    const now = new Date();
    
    const filterByDateRange = (createdAt: string | Date | null) => {
      if (!createdAt) return false;
      const date = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
      
      switch (dateFilter) {
        case 'last-30-days': {
          const start = startOfDay(subDays(now, 30));
          const end = endOfDay(now);
          return isWithinInterval(date, { start, end });
        }
        case 'last-3-months': {
          const start = startOfDay(subMonths(now, 3));
          const end = endOfDay(now);
          return isWithinInterval(date, { start, end });
        }
        case 'this-year': {
          const start = startOfYear(now);
          const end = endOfDay(now);
          return isWithinInterval(date, { start, end });
        }
        case 'last-year': {
          const lastYear = subYears(now, 1);
          const start = startOfYear(lastYear);
          const end = endOfYear(lastYear);
          return isWithinInterval(date, { start, end });
        }
        case 'all':
        default:
          return true;
      }
    };

    return {
      digital: digitalOrders.filter(order => filterByDateRange(order.createdAt)),
      print: printOrders.filter(order => filterByDateRange(order.createdAt)),
    };
  }, [purchasesWithStorybooks.data, printOrdersData, dateFilter]);

  // Filter by type
  const filteredOrders = useMemo(() => {
    switch (typeFilter) {
      case 'digital':
        return { digital: filteredByDate.digital, print: [] };
      case 'print':
        return { digital: [], print: filteredByDate.print };
      case 'all':
      default:
        return filteredByDate;
    }
  }, [filteredByDate, typeFilter]);

  // Combine and sort all orders by date
  const allOrders = useMemo(() => {
    const digital = filteredOrders.digital.map(p => ({ 
      type: 'digital' as const, 
      data: p, 
      date: p.createdAt ? (typeof p.createdAt === 'string' ? new Date(p.createdAt) : p.createdAt) : new Date()
    }));
    const print = filteredOrders.print.map(p => ({ 
      type: 'print' as const, 
      data: p, 
      date: new Date(p.createdAt) 
    }));
    
    return [...digital, ...print].sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [filteredOrders]);

  const isLoading = authLoading || printLoading || purchasesLoading || purchasesWithStorybooks.isLoading;
  const totalOrders = allOrders.length;

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
          description="View your digital books and track print orders."
        />
        <Navigation />
        <div className="container mx-auto px-4 py-16 text-center">
          <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-2xl font-bold mb-2">Sign in to view your orders</h1>
          <p className="text-muted-foreground mb-6">
            Please sign in to access your digital books and track your print orders.
          </p>
          <Button onClick={() => setLocation("/auth")} data-testid="button-sign-in">
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="My Orders | AI Storybook Builder"
        description="View your digital books and track print orders."
      />
      <Navigation />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2">
              <h1 className="text-3xl font-bold" data-testid="heading-orders">
                My Orders
              </h1>
              {totalOrders > 0 && (
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as TypeFilter)}>
                    <SelectTrigger className="w-40" data-testid="select-type-filter">
                      <SelectValue placeholder="Filter by type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Orders</SelectItem>
                      <SelectItem value="digital">Digital Books</SelectItem>
                      <SelectItem value="print">Print Orders</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={dateFilter} onValueChange={(value) => setDateFilter(value as DateFilter)}>
                    <SelectTrigger className="w-48" data-testid="select-date-filter">
                      <SelectValue placeholder="Filter by date" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="last-30-days">Last 30 Days</SelectItem>
                      <SelectItem value="last-3-months">Last 3 Months</SelectItem>
                      <SelectItem value="this-year">This Year</SelectItem>
                      <SelectItem value="last-year">Last Year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            {totalOrders > 0 && (
              <p className="text-sm text-muted-foreground">
                Showing {totalOrders} {totalOrders === 1 ? 'order' : 'orders'}
              </p>
            )}
          </div>

          {/* Orders List */}
          {isLoading ? (
            <OrdersSkeleton />
          ) : totalOrders === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <ShoppingBag className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h2 className="text-xl font-semibold mb-2">No orders yet</h2>
                <p className="text-muted-foreground mb-6">
                  When you purchase books, they'll appear here.
                </p>
                <Button onClick={() => setLocation("/library")} data-testid="button-browse-library">
                  <Package className="mr-2 h-4 w-4" />
                  Browse Library
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4" data-testid="orders-list">
              {allOrders.map((order) => (
                order.type === 'digital' ? (
                  <DigitalPurchaseCard key={order.data.id} purchase={order.data} />
                ) : (
                  <PrintOrderCard key={order.data.orderId} order={order.data} />
                )
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
