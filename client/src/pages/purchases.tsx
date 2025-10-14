import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import Navigation from "@/components/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { clearCart, addToCart, isInCart } from "@/lib/cartUtils";
import { type Purchase, type Storybook } from "@shared/schema";
import { Download, Package, Mail, BookOpen, ShoppingCart, Sparkles } from "lucide-react";

interface PurchaseWithStorybook extends Purchase {
  storybook?: Storybook;
}

export default function Purchases() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [downloadingPurchaseId, setDownloadingPurchaseId] = useState<string | null>(null);
  const [downloadingPdfPurchaseId, setDownloadingPdfPurchaseId] = useState<string | null>(null);

  const { data: purchases, isLoading } = useQuery<Purchase[]>({
    queryKey: ['/api/purchases'],
    enabled: isAuthenticated,
  });

  // Fetch storybook details for each purchase
  const purchasesWithStorybooks = useQuery<PurchaseWithStorybook[]>({
    queryKey: ['/api/purchases/with-storybooks', purchases],
    queryFn: async () => {
      if (!purchases || purchases.length === 0) return [];
      
      const purchasesWithDetails = await Promise.all(
        purchases.map(async (purchase) => {
          try {
            const response = await fetch(`/api/storybooks/${purchase.storybookId}`);
            if (response.ok) {
              const storybook = await response.json();
              return { ...purchase, storybook };
            }
            return purchase;
          } catch (error) {
            return purchase;
          }
        })
      );
      
      return purchasesWithDetails;
    },
    enabled: !!purchases && purchases.length > 0,
  });

  // Fetch site settings for pricing
  const { data: settings } = useQuery<any>({
    queryKey: ['/api/admin/settings'],
    enabled: isAuthenticated,
  });

  // Get prices from settings with fallback defaults
  const digitalPrice = settings?.find((s: any) => s.key === 'digital_price')?.value 
    ? parseInt(settings.find((s: any) => s.key === 'digital_price').value) 
    : 399;
  const printPrice = settings?.find((s: any) => s.key === 'print_price')?.value 
    ? parseInt(settings.find((s: any) => s.key === 'print_price').value) 
    : 2499;

  // Handle success redirect from Stripe
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    
    if (success === 'true') {
      toast({
        title: t('purchases.toast.paymentSuccess.title'),
        description: t('purchases.toast.paymentSuccess.description'),
      });
      
      // Clear cart
      clearCart();
      window.dispatchEvent(new Event('cartUpdated'));
      
      // Clean up URL
      window.history.replaceState({}, '', '/purchases');
    }
  }, [toast, t]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      window.location.href = '/api/login';
    }
  }, [authLoading, isAuthenticated]);

  const downloadEpub = async (purchaseId: string, storybookId: string, title: string) => {
    setDownloadingPurchaseId(purchaseId);
    
    toast({
      title: t('purchases.toast.preparingEbook.title'),
      description: t('purchases.toast.preparingEbook.description'),
    });
    
    try {
      const response = await fetch(`/api/storybooks/${storybookId}/epub`);
      
      if (!response.ok) {
        throw new Error('Failed to download EPUB');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.epub`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: t('purchases.toast.ebookDownloaded.title'),
        description: t('purchases.toast.ebookDownloaded.description'),
      });
    } catch (error) {
      toast({
        title: t('purchases.toast.downloadFailed.title'),
        description: t('purchases.toast.downloadFailed.description'),
        variant: "destructive",
      });
    } finally {
      setDownloadingPurchaseId(null);
    }
  };

  const downloadPrintPdf = async (purchaseId: string, storybookId: string, title: string) => {
    setDownloadingPdfPurchaseId(purchaseId);
    
    toast({
      title: t('purchases.toast.preparingPrintPdf.title'),
      description: t('purchases.toast.preparingPrintPdf.description'),
    });
    
    try {
      const response = await fetch(`/api/storybooks/${storybookId}/download-print-pdf`);
      
      if (!response.ok) {
        throw new Error('Failed to download print PDF');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_print.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: t('purchases.toast.printPdfDownloaded.title'),
        description: t('purchases.toast.printPdfDownloaded.description'),
      });
    } catch (error) {
      toast({
        title: t('purchases.toast.downloadFailed.title'),
        description: t('purchases.toast.downloadFailed.description'),
        variant: "destructive",
      });
    } finally {
      setDownloadingPdfPurchaseId(null);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'pending':
        return 'secondary';
      case 'failed':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getPurchaseTypeIcon = (type: string) => {
    return type === 'digital' ? <Download className="h-4 w-4" /> : <Package className="h-4 w-4" />;
  };

  const handleUpgradeToPrint = (storybookId: string, title: string) => {
    const upgradedPrice = Math.max(0, printPrice - digitalPrice);
    
    addToCart({
      storybookId,
      type: 'print',
      title,
      price: upgradedPrice,
    });
    
    window.dispatchEvent(new Event('cartUpdated'));
    
    toast({
      title: t('purchases.upgrade.addedToCart'),
      description: t('purchases.upgrade.discountedPrice', { price: (upgradedPrice / 100).toFixed(2) }),
    });
    
    setLocation('/cart');
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-muted/30">
        <Navigation />
        <section className="py-12">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold mb-8">{t('purchases.title')}</h1>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-6 w-3/4" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-4 w-2/3" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </div>
    );
  }

  const purchasesList = purchasesWithStorybooks.data || [];

  if (purchasesList.length === 0) {
    return (
      <div className="min-h-screen bg-muted/30">
        <Navigation />
        <section className="py-20">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h1 className="text-3xl font-bold mb-4">{t('purchases.empty.title')}</h1>
              <p className="text-lg text-muted-foreground mb-8">
                {t('purchases.empty.description')}
              </p>
              <Button onClick={() => setLocation('/library')} size="lg" data-testid="button-browse-library">
                <BookOpen className="h-4 w-4 mr-2" />
                {t('purchases.empty.button')}
              </Button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  // Group purchases by storybook
  const groupedPurchases = purchasesList.reduce((acc, purchase) => {
    const key = purchase.storybookId;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(purchase);
    return acc;
  }, {} as Record<string, PurchaseWithStorybook[]>);

  return (
    <div className="min-h-screen bg-muted/30">
      <Navigation />
      <section className="py-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">{t('purchases.title')}</h1>
            <p className="text-muted-foreground">
              {t('purchases.subtitle')}
            </p>
          </div>

          <div className="space-y-6">
            {Object.entries(groupedPurchases).map(([storybookId, storybookPurchases]) => {
              const firstPurchase = storybookPurchases[0];
              const storybook = firstPurchase.storybook;
              
              return (
                <Card key={storybookId} className="overflow-hidden">
                  <CardHeader className="bg-muted/50">
                    <CardTitle className="flex items-center justify-between flex-wrap gap-4">
                      <button
                        onClick={() => setLocation(`/view/${storybookId}`)}
                        className="text-left hover:text-primary transition-colors"
                        data-testid={`link-view-storybook-${storybookId}`}
                      >
                        <h3 className="text-xl font-bold flex items-center gap-2">
                          <BookOpen className="h-5 w-5" />
                          {storybook?.title || 'Untitled Storybook'}
                        </h3>
                      </button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setLocation(`/view/${storybookId}`)}
                        data-testid={`button-view-storybook-${storybookId}`}
                      >
                        {t('purchases.viewBook')}
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      {storybookPurchases.map((purchase) => (
                        <div
                          key={purchase.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-card border"
                          data-testid={`purchase-card-${purchase.id}`}
                        >
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant={purchase.type === 'digital' ? 'default' : 'secondary'} className="gap-1">
                                {getPurchaseTypeIcon(purchase.type)}
                                {purchase.type === 'digital' ? t('purchases.item.digitalEdition') : t('purchases.item.printEdition')}
                              </Badge>
                              <Badge variant={getStatusBadgeVariant(purchase.status)}>
                                {t(`purchases.status.${purchase.status}`)}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground space-y-1">
                              <p>
                                {t('purchases.item.purchasedOn', { date: purchase.createdAt ? format(new Date(purchase.createdAt), 'MMM dd, yyyy') : 'Unknown date' })}
                              </p>
                              <p className="font-semibold text-foreground">
                                ${(Number(purchase.price) / 100).toFixed(2)}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 flex-wrap">
                            {purchase.type === 'digital' && purchase.status === 'completed' && (
                              <>
                                <Button
                                  onClick={() => downloadEpub(purchase.id, purchase.storybookId, storybook?.title || 'storybook')}
                                  disabled={downloadingPurchaseId === purchase.id}
                                  variant="default"
                                  data-testid={`button-download-epub-${purchase.id}`}
                                >
                                  {downloadingPurchaseId === purchase.id ? (
                                    <>
                                      <i className="fas fa-spinner fa-spin mr-2"></i>
                                      {t('purchases.item.preparing')}
                                    </>
                                  ) : (
                                    <>
                                      <Download className="h-4 w-4 mr-2" />
                                      {t('purchases.item.downloadEbook')}
                                    </>
                                  )}
                                </Button>
                                <Button
                                  onClick={() => downloadPrintPdf(purchase.id, purchase.storybookId, storybook?.title || 'storybook')}
                                  disabled={downloadingPdfPurchaseId === purchase.id}
                                  variant="outline"
                                  data-testid={`button-download-print-pdf-${purchase.id}`}
                                >
                                  {downloadingPdfPurchaseId === purchase.id ? (
                                    <>
                                      <i className="fas fa-spinner fa-spin mr-2"></i>
                                      {t('purchases.item.preparing')}
                                    </>
                                  ) : (
                                    <>
                                      <Download className="h-4 w-4 mr-2" />
                                      {t('purchases.item.downloadPrintPdf')}
                                    </>
                                  )}
                                </Button>
                              </>
                            )}
                            {purchase.type === 'print' && purchase.status === 'completed' && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted px-4 py-2 rounded-lg">
                                <Mail className="h-4 w-4" />
                                <span>{t('purchases.item.printOrderSent')}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}

                      {/* Upgrade to Print option for digital purchases */}
                      {storybookPurchases.some(p => p.type === 'digital' && p.status === 'completed') && 
                       !storybookPurchases.some(p => p.type === 'print') && (
                        <div className="p-6 rounded-lg bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 border-2 border-purple-200 dark:border-purple-800" data-testid={`upgrade-card-${storybookId}`}>
                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-2">
                                <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                                <h4 className="text-lg font-semibold text-purple-900 dark:text-purple-100">
                                  {t('purchases.upgrade.title')}
                                </h4>
                                <Badge className="bg-purple-600 hover:bg-purple-700 text-white">
                                  {t('purchases.upgrade.badge')}
                                </Badge>
                              </div>
                              <p className="text-sm text-purple-700 dark:text-purple-300">
                                {t('purchases.upgrade.description')}
                              </p>
                              <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm">
                                <span className="font-semibold text-green-700 dark:text-green-400">
                                  {t('purchases.upgrade.discountedPrice', { price: (Math.max(0, printPrice - digitalPrice) / 100).toFixed(2) })}
                                </span>
                                <span className="text-muted-foreground line-through">
                                  {t('purchases.upgrade.originalPrice', { price: (printPrice / 100).toFixed(2) })}
                                </span>
                                <Badge variant="outline" className="w-fit border-green-600 text-green-700 dark:text-green-400">
                                  {t('purchases.upgrade.savings', { amount: (digitalPrice / 100).toFixed(2) })}
                                </Badge>
                              </div>
                            </div>
                            <Button
                              onClick={() => handleUpgradeToPrint(storybookId, storybook?.title || 'Untitled Storybook')}
                              disabled={isInCart(storybookId, 'print')}
                              size="lg"
                              className="gradient-bg !text-[hsl(258,90%,20%)] shadow-lg hover:scale-105 transition-all"
                              data-testid={`button-upgrade-${storybookId}`}
                            >
                              {isInCart(storybookId, 'print') ? (
                                <>
                                  <ShoppingCart className="h-5 w-5 mr-2" />
                                  In Cart
                                </>
                              ) : (
                                <>
                                  <ShoppingCart className="h-5 w-5 mr-2" />
                                  {t('purchases.upgrade.button')}
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
