import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import Navigation from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { BookOpen, Calendar, Plus, Trash2, ShoppingCart, Check, X, Download, Loader2, CreditCard } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { addToCart, isInCart, removeFromCart, canAddDigitalToCart } from "@/lib/cartUtils";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";

// Validate Stripe public key exists
const stripePublicKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
const stripePromise = stripePublicKey ? loadStripe(stripePublicKey) : null;

interface Storybook {
  id: string;
  title: string;
  prompt: string;
  pages: Array<{ pageNumber: number; text: string; imageUrl: string }>;
  createdAt: string;
  shareUrl: string | null;
}

interface CheckoutPaymentFormProps {
  storybookId: string;
  title: string;
  price: number;
  type: 'digital' | 'print';
  onSuccess: () => void;
}

function CheckoutPaymentForm({ storybookId, title, price, type, onSuccess }: CheckoutPaymentFormProps) {
  const { t } = useTranslation();
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/library?success=true`,
        },
        redirect: 'if_required',
      });

      if (error) {
        setIsProcessing(false);
        toast({
          title: "Payment Failed",
          description: error.message || "An error occurred during payment.",
          variant: "destructive",
        });
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        try {
          const response = await apiRequest('POST', '/api/purchases/create', { 
            paymentIntentId: paymentIntent.id 
          });

          if (!response.ok) {
            throw new Error('Failed to create purchases');
          }

          toast({
            title: "Payment Successful",
            description: `You've successfully purchased ${title}!`,
          });

          onSuccess();
        } catch (purchaseError) {
          setIsProcessing(false);
          toast({
            title: "Processing Order",
            description: "Your payment was successful. Your purchase is being processed.",
          });
          onSuccess();
        }
      }
    } catch (error) {
      setIsProcessing(false);
      toast({
        title: "Payment Error",
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
        variant: "destructive",
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <PaymentElement />
      </div>

      <div className="flex items-center justify-between pt-4 border-t">
        <span className="text-lg font-semibold">Total</span>
        <span className="text-2xl font-bold gradient-text">
          ${(price / 100).toFixed(2)}
        </span>
      </div>

      <Button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full gradient-bg hover:opacity-90 !text-[hsl(258,90%,20%)] h-12"
        data-testid="button-submit-payment"
      >
        {isProcessing ? (
          <>
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <CreditCard className="h-5 w-5 mr-2" />
            Pay ${(price / 100).toFixed(2)}
          </>
        )}
      </Button>
    </form>
  );
}

interface CheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storybook: Storybook;
  type: 'digital' | 'print';
  price: number;
}

function CheckoutDialog({ open, onOpenChange, storybook, type, price }: CheckoutDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [clientSecret, setClientSecret] = useState<string>("");
  const [isCreatingPaymentIntent, setIsCreatingPaymentIntent] = useState(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    // Check if Stripe is configured
    if (!stripePublicKey) {
      setError("Stripe is not configured. Please contact support.");
      return;
    }

    // Reset state when dialog opens
    if (open) {
      setClientSecret("");
      setError("");
      setIsCreatingPaymentIntent(true);

      const createPaymentIntent = async () => {
        try {
          const response = await apiRequest('POST', '/api/create-payment-intent', { 
            items: [{ storybookId: storybook.id, type, price }] 
          });
          
          if (!response.ok) {
            throw new Error('Failed to create payment intent');
          }
          
          const data = await response.json();
          
          if (!data.clientSecret) {
            throw new Error('No client secret received');
          }
          
          setClientSecret(data.clientSecret);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : "Failed to initialize checkout. Please try again.";
          setError(errorMsg);
          toast({
            title: "Error",
            description: errorMsg,
            variant: "destructive",
          });
        } finally {
          setIsCreatingPaymentIntent(false);
        }
      };
      
      createPaymentIntent();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, storybook.id, type, price]);

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/purchases/check'] });
    onOpenChange(false);
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setClientSecret("");
      setError("");
    }
    onOpenChange(isOpen);
  };

  const options = clientSecret ? {
    clientSecret,
    appearance: {
      theme: 'stripe' as const,
    },
  } : undefined;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Complete Purchase
          </DialogTitle>
        </DialogHeader>

        {error ? (
          <div className="flex flex-col items-center justify-center py-8">
            <X className="h-12 w-12 text-destructive mb-4" />
            <p className="text-sm text-destructive text-center">{error}</p>
            <Button 
              variant="outline" 
              onClick={() => handleClose(false)} 
              className="mt-4"
              data-testid="button-close-error"
            >
              Close
            </Button>
          </div>
        ) : isCreatingPaymentIntent || !clientSecret ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-sm text-muted-foreground">Preparing checkout...</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="font-medium text-sm">{storybook.title}</p>
              <Badge variant={type === 'digital' ? 'default' : 'secondary'} className="mt-2">
                {type === 'digital' ? 'E-book' : 'Print Edition'}
              </Badge>
            </div>

            {stripePromise && options ? (
              <Elements stripe={stripePromise} options={options}>
                <CheckoutPaymentForm 
                  storybookId={storybook.id}
                  title={storybook.title}
                  price={price}
                  type={type}
                  onSuccess={handleSuccess}
                />
              </Elements>
            ) : (
              <div className="flex flex-col items-center justify-center py-4">
                <p className="text-sm text-destructive">Unable to load payment system</p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StorybookPurchaseButtons({ storybook }: { storybook: Storybook }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [cartUpdated, setCartUpdated] = useState(0);
  const [checkoutDialog, setCheckoutDialog] = useState<{ open: boolean; type?: 'digital' | 'print' }>({ open: false });

  const { data: digitalPurchase } = useQuery<{ owned: boolean }>({
    queryKey: ['/api/purchases/check', storybook.id, 'digital', cartUpdated],
    queryFn: async () => {
      const response = await fetch('/api/purchases/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storybookId: storybook.id, type: 'digital' }),
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to check purchase');
      return response.json();
    },
  });

  const { data: printPurchase } = useQuery<{ owned: boolean }>({
    queryKey: ['/api/purchases/check', storybook.id, 'print', cartUpdated],
    queryFn: async () => {
      const response = await fetch('/api/purchases/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storybookId: storybook.id, type: 'print' }),
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to check purchase');
      return response.json();
    },
  });

  // Fetch pricing settings from public endpoint
  const { data: pricingSettings } = useQuery<{ digital_price: string; print_price: string }>({
    queryKey: ['/api/settings/pricing'],
  });

  // Get prices from settings with fallback defaults
  const digitalPrice = pricingSettings?.digital_price 
    ? parseInt(pricingSettings.digital_price) 
    : 399;
  const printPrice = pricingSettings?.print_price 
    ? parseInt(pricingSettings.print_price) 
    : 2499;

  const handleAddToCart = (type: 'digital' | 'print') => {
    // Apply discount if user owns digital and is buying print
    let price = type === 'digital' ? digitalPrice : printPrice;
    if (type === 'print' && digitalPurchase?.owned) {
      price = Math.max(0, printPrice - digitalPrice);
    }
    
    addToCart({
      storybookId: storybook.id,
      type,
      title: storybook.title,
      price,
    });
    toast({
      title: t('storybook.library.purchase.addedToCart.title'),
      description: t('storybook.library.purchase.addedToCart.description', { 
        title: storybook.title, 
        type: type === 'digital' ? 'Digital' : 'Print' 
      }),
    });
    window.dispatchEvent(new Event('cartUpdated'));
    setCartUpdated(prev => prev + 1);
  };

  const handleRemoveFromCart = (type: 'digital' | 'print') => {
    removeFromCart(storybook.id, type);
    toast({
      title: t('storybook.library.purchase.removedFromCart.title'),
      description: t('storybook.library.purchase.removedFromCart.description', { 
        title: storybook.title, 
        type: type === 'digital' ? 'Digital' : 'Print' 
      }),
    });
    window.dispatchEvent(new Event('cartUpdated'));
    setCartUpdated(prev => prev + 1);
  };

  const inCartDigital = isInCart(storybook.id, 'digital');
  const inCartPrint = isInCart(storybook.id, 'print');
  const canAddDigital = canAddDigitalToCart(storybook.id);

  // Calculate price with potential discount
  let printPurchasePrice = printPrice;
  if (digitalPurchase?.owned) {
    printPurchasePrice = Math.max(0, printPrice - digitalPrice);
  }

  return (
    <TooltipProvider>
      <div className="space-y-2 mt-3">
        {/* Digital Section */}
        <div className="space-y-1">
          {digitalPurchase?.owned && (
            <Badge variant="secondary" className="w-full justify-center py-1">
              <Check className="h-3 w-3 mr-1" />
              {t('storybook.library.purchase.digitalPurchased')}
            </Badge>
          )}
          
          {inCartDigital ? (
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => handleRemoveFromCart('digital')}
              data-testid={`button-remove-digital-${storybook.id}`}
            >
              <X className="h-4 w-4 mr-1" />
              Remove Ebook from Cart
            </Button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="w-full">
                  <Button
                    size="sm"
                    variant="default"
                    className="w-full gradient-bg hover:opacity-90 !text-[hsl(258,90%,20%)]"
                    onClick={() => handleAddToCart('digital')}
                    disabled={!canAddDigital}
                    data-testid={`button-add-digital-${storybook.id}`}
                  >
                    <ShoppingCart className="h-4 w-4 mr-1" />
                    Add Ebook to Cart (${(digitalPrice / 100).toFixed(2)})
                  </Button>
                </div>
              </TooltipTrigger>
              {!canAddDigital && (
                <TooltipContent>
                  Print copy already in cart (includes ebook)
                </TooltipContent>
              )}
            </Tooltip>
          )}
        </div>

        {/* Print Section */}
        <div className="space-y-1">
          {printPurchase?.owned && (
            <Badge variant="secondary" className="w-full justify-center py-1">
              <Check className="h-3 w-3 mr-1" />
              {t('storybook.library.purchase.printPurchased')}
            </Badge>
          )}
          
          {inCartPrint ? (
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => handleRemoveFromCart('print')}
              data-testid={`button-remove-print-${storybook.id}`}
            >
              <X className="h-4 w-4 mr-1" />
              Remove Print from Cart
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="w-full h-auto py-2"
              onClick={() => handleAddToCart('print')}
              data-testid={`button-add-print-${storybook.id}`}
            >
              <div className="flex flex-col items-center gap-0.5">
                <div className="flex items-center gap-1.5">
                  <ShoppingCart className="h-4 w-4" />
                  {digitalPurchase?.owned ? (
                    <span className="flex items-center gap-1">
                      <span>Add Print to Cart</span>
                      <span className="line-through text-muted-foreground">(${(printPrice / 100).toFixed(2)})</span>
                      <span>-</span>
                      <span className="font-semibold">${(printPurchasePrice / 100).toFixed(2)}</span>
                    </span>
                  ) : (
                    <span>Add Print to Cart (${(printPrice / 100).toFixed(2)})</span>
                  )}
                </div>
                {digitalPurchase?.owned ? (
                  <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                    {t('purchases.upgrade.savings', { amount: (digitalPrice / 100).toFixed(2) })}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">{t('storybook.library.purchase.freeEbookIncluded')}</span>
                )}
              </div>
            </Button>
          )}
        </div>
      </div>

      {checkoutDialog.open && checkoutDialog.type && (
        <CheckoutDialog
          open={checkoutDialog.open}
          onOpenChange={(open) => setCheckoutDialog({ open, type: checkoutDialog.type })}
          storybook={storybook}
          type={checkoutDialog.type}
          price={checkoutDialog.type === 'digital' ? digitalPrice : printPurchasePrice}
        />
      )}
    </TooltipProvider>
  );
}

export default function Library() {
  const { t } = useTranslation();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [deletingBookId, setDeletingBookId] = useState<string | null>(null);

  const { data: storybooks, isLoading, error } = useQuery<Storybook[]>({
    queryKey: ["/api/storybooks"],
    enabled: isAuthenticated,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/storybooks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/storybooks"] });
      toast({
        title: t('storybook.library.delete.toast.success.title'),
        description: t('storybook.library.delete.toast.success.description'),
      });
      setDeletingBookId(null);
    },
    onError: (error: Error) => {
      toast({
        title: t('storybook.library.delete.toast.error.title'),
        description: error.message || t('storybook.library.delete.toast.error.description'),
        variant: "destructive",
      });
    },
  });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-muted-foreground">{t('common.states.loading')}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center py-20">
            <BookOpen className="mx-auto h-16 w-16 text-muted-foreground mb-6" />
            <h2 className="text-3xl font-bold mb-4">{t('storybook.library.pleaseLogin.title')}</h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              {t('storybook.library.pleaseLogin.description')}
            </p>
            <Button onClick={() => window.location.href = '/api/login'} data-testid="button-login">
              {t('storybook.library.pleaseLogin.button')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-6 sm:py-8 lg:py-12">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold font-display gradient-text mb-2" data-testid="text-library-title">
              {t('storybook.library.title')}
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground" data-testid="text-storybook-count">
              {t('storybook.library.count', { count: storybooks?.length || 0 })}
            </p>
          </div>
          
          <Link href="/create">
            <Button className="gradient-bg hover:opacity-90 !text-[hsl(258,90%,20%)] w-full sm:w-auto" data-testid="button-create-new">
              <Plus className="mr-2 h-4 w-4" />
              {t('storybook.library.createNew')}
            </Button>
          </Link>
        </div>

        {error ? (
          <div className="text-center py-20">
            <BookOpen className="mx-auto h-16 w-16 text-destructive mb-6" />
            <h2 className="text-2xl font-semibold mb-4" data-testid="text-error-title">
              {t('storybook.library.error.title')}
            </h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto" data-testid="text-error-message">
              {error instanceof Error ? error.message : t('storybook.library.error.description')}
            </p>
            <Button onClick={() => window.location.reload()} variant="outline" data-testid="button-retry">
              {t('common.buttons.tryAgain')}
            </Button>
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="overflow-hidden animate-pulse">
                <Skeleton className="h-48 w-full" />
                <CardHeader>
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-full mb-1" />
                  <Skeleton className="h-4 w-5/6" />
                </CardHeader>
                <CardFooter className="flex items-center justify-between">
                  <Skeleton className="h-4 w-24" />
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-16" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : storybooks && storybooks.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {storybooks.map((storybook) => (
              <Card 
                key={storybook.id} 
                className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
                data-testid={`card-storybook-${storybook.id}`}
              >
                <Link href={`/view/${storybook.id}`}>
                  <div className="relative h-48 bg-gradient-to-br from-primary/20 to-secondary/20 overflow-hidden">
                    {storybook.pages[0]?.imageUrl ? (
                      <img 
                        src={storybook.pages[0].imageUrl} 
                        alt={storybook.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        data-testid={`img-cover-${storybook.id}`}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <BookOpen className="h-16 w-16 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                </Link>
                
                <CardHeader>
                  <CardTitle className="line-clamp-1" data-testid={`text-title-${storybook.id}`}>
                    {storybook.title}
                  </CardTitle>
                  <CardDescription className="line-clamp-2" data-testid={`text-prompt-${storybook.id}`}>
                    {storybook.prompt}
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="pb-3">
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
                    <Calendar className="h-4 w-4" />
                    <span data-testid={`text-date-${storybook.id}`}>
                      {formatDistanceToNow(new Date(storybook.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <StorybookPurchaseButtons storybook={storybook} />
                </CardContent>
                
                <CardFooter className="flex items-center justify-between gap-2 pt-3">
                  <Link href={`/view/${storybook.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full" data-testid={`button-view-${storybook.id}`}>
                      {t('common.buttons.view')}
                    </Button>
                  </Link>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      setDeletingBookId(storybook.id);
                    }}
                    data-testid={`button-delete-${storybook.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <BookOpen className="mx-auto h-16 w-16 text-muted-foreground mb-6" />
            <h2 className="text-2xl font-semibold mb-4" data-testid="text-empty-state">
              {t('storybook.library.empty.title')}
            </h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              {t('storybook.library.empty.description')}
            </p>
            <Link href="/create">
              <Button className="gradient-bg hover:opacity-90 !text-[hsl(258,90%,20%)]" data-testid="button-create-first">
                <Plus className="mr-2 h-4 w-4" />
                {t('storybook.library.createFirst')}
              </Button>
            </Link>
          </div>
        )}
      </div>

      <AlertDialog open={!!deletingBookId} onOpenChange={(open) => !open && setDeletingBookId(null)}>
        <AlertDialogContent data-testid="dialog-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle data-testid="dialog-title">{t('storybook.library.delete.title')}</AlertDialogTitle>
            <AlertDialogDescription data-testid="dialog-description">
              {t('storybook.library.delete.description', { title: storybooks?.find(b => b.id === deletingBookId)?.title })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deleteMutation.isPending}
              data-testid="button-cancel-delete"
            >
              {t('common.buttons.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingBookId && deleteMutation.mutate(deletingBookId)}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? t('storybook.library.delete.confirmButtonLoading') : t('storybook.library.delete.confirmButton')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
