import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { format } from "date-fns";
import Navigation from "@/components/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { clearCart } from "@/lib/cartUtils";
import { type Purchase, type Storybook } from "@shared/schema";
import { Download, Package, Mail, BookOpen } from "lucide-react";

interface PurchaseWithStorybook extends Purchase {
  storybook?: Storybook;
}

export default function Purchases() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [downloadingPurchaseId, setDownloadingPurchaseId] = useState<string | null>(null);

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

  // Handle success redirect from Stripe
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    
    if (success === 'true') {
      toast({
        title: "Payment successful!",
        description: "Your purchases are ready.",
      });
      
      // Clear cart
      clearCart();
      window.dispatchEvent(new Event('cartUpdated'));
      
      // Clean up URL
      window.history.replaceState({}, '', '/purchases');
    }
  }, [toast]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      window.location.href = '/api/login';
    }
  }, [authLoading, isAuthenticated]);

  const downloadEpub = async (purchaseId: string, storybookId: string, title: string) => {
    setDownloadingPurchaseId(purchaseId);
    
    toast({
      title: "Preparing your e-book...",
      description: "This may take a few seconds for large files",
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
        title: "E-book downloaded!",
        description: "Your storybook has been downloaded as an EPUB file",
      });
    } catch (error) {
      toast({
        title: "Failed to download e-book",
        description: "Please try again later",
        variant: "destructive",
      });
    } finally {
      setDownloadingPurchaseId(null);
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

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-muted/30">
        <Navigation />
        <section className="py-12">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold mb-8">My Purchases</h1>
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
              <h1 className="text-3xl font-bold mb-4">My Purchases</h1>
              <p className="text-lg text-muted-foreground mb-8">
                You haven't purchased any books yet
              </p>
              <Button onClick={() => setLocation('/library')} size="lg" data-testid="button-browse-library">
                <BookOpen className="h-4 w-4 mr-2" />
                Browse Library
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
            <h1 className="text-3xl font-bold mb-2">My Purchases</h1>
            <p className="text-muted-foreground">
              View and download your purchased storybooks
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
                        View Book
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
                                {purchase.type === 'digital' ? 'Digital Edition' : 'Print Edition'}
                              </Badge>
                              <Badge variant={getStatusBadgeVariant(purchase.status)}>
                                {purchase.status.charAt(0).toUpperCase() + purchase.status.slice(1)}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground space-y-1">
                              <p>
                                Purchased on {purchase.createdAt ? format(new Date(purchase.createdAt), 'MMM dd, yyyy') : 'Unknown date'}
                              </p>
                              <p className="font-semibold text-foreground">
                                ${(Number(purchase.price) / 100).toFixed(2)}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            {purchase.type === 'digital' && purchase.status === 'completed' && (
                              <Button
                                onClick={() => downloadEpub(purchase.id, purchase.storybookId, storybook?.title || 'storybook')}
                                disabled={downloadingPurchaseId === purchase.id}
                                variant="default"
                                data-testid={`button-download-purchase-${purchase.id}`}
                              >
                                {downloadingPurchaseId === purchase.id ? (
                                  <>
                                    <i className="fas fa-spinner fa-spin mr-2"></i>
                                    Preparing...
                                  </>
                                ) : (
                                  <>
                                    <Download className="h-4 w-4 mr-2" />
                                    Download E-book
                                  </>
                                )}
                              </Button>
                            )}
                            {purchase.type === 'print' && purchase.status === 'completed' && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted px-4 py-2 rounded-lg">
                                <Mail className="h-4 w-4" />
                                <span>Print order sent to email</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
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
