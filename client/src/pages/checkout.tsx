import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import Navigation from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { getCart, clearCart, type CartItem } from "@/lib/cartUtils";
import { apiRequest } from "@/lib/queryClient";
import { ShoppingCart, CreditCard, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

// Load Stripe outside component
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || '');

interface PricedCartItem extends CartItem {
  originalPrice?: number;
  discount?: number;
}

interface CheckoutFormProps {
  totalAmount: number;
  cartItems: CartItem[];
}

function CheckoutForm({ totalAmount, cartItems }: CheckoutFormProps) {
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
          return_url: `${window.location.origin}/purchases?success=true`,
        },
        redirect: 'if_required',
      });

      if (error) {
        // Handle errors - keep cart for retry
        if (error.type === 'card_error' || error.type === 'validation_error') {
          // User can retry
          setIsProcessing(false);
          toast({
            title: t('checkout.toast.paymentFailed.title'),
            description: error.message || t('checkout.toast.paymentFailed.description'),
            variant: "destructive",
          });
        } else {
          // Other errors
          setIsProcessing(false);
          toast({
            title: t('checkout.toast.paymentError.title'),
            description: error.message || t('checkout.toast.paymentError.description'),
            variant: "destructive",
          });
        }
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        // Payment succeeded - create purchases immediately
        try {
          // Call purchase creation endpoint
          const response = await apiRequest('POST', '/api/purchases/create', { 
            paymentIntentId: paymentIntent.id 
          });

          if (!response.ok) {
            throw new Error('Failed to create purchases');
          }

          // Clear cart after successful purchase creation
          clearCart();
          
          // Show success message
          toast({
            title: t('checkout.toast.paymentSuccessful.title'),
            description: t('checkout.toast.paymentSuccessful.description'),
          });
          
          // Redirect to purchases
          window.location.href = '/purchases?success=true';
        } catch (purchaseError) {
          // Purchase creation failed, but payment succeeded
          // Don't clear cart - let user retry or rely on webhook
          setIsProcessing(false);
          toast({
            title: t('checkout.toast.processingOrder.title'),
            description: t('checkout.toast.processingOrder.description'),
          });
          
          // Still redirect to purchases - webhook will create purchase
          setTimeout(() => {
            window.location.href = '/purchases?success=true';
          }, 2000);
        }
      }
    } catch (error) {
      // Network or unexpected errors - keep cart for retry
      setIsProcessing(false);
      toast({
        title: t('checkout.toast.paymentError.title'),
        description: error instanceof Error ? error.message : t('checkout.toast.paymentError.description'),
        variant: "destructive",
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            {t('checkout.payment.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PaymentElement />
        </CardContent>
      </Card>

      <Button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full gradient-bg hover:opacity-90 !text-[hsl(258,90%,20%)] h-12 text-lg"
        data-testid="button-submit-payment"
      >
        {isProcessing ? (
          <>
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            {t('checkout.payment.processingButton')}
          </>
        ) : (
          <>
            <CreditCard className="h-5 w-5 mr-2" />
            {t('checkout.payment.submitButton', { amount: (totalAmount / 100).toFixed(2) })}
          </>
        )}
      </Button>
    </form>
  );
}

export default function Checkout() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [pricedItems, setPricedItems] = useState<PricedCartItem[]>([]);
  const [clientSecret, setClientSecret] = useState<string>("");
  const [isCreatingPaymentIntent, setIsCreatingPaymentIntent] = useState(true);
  const [paymentIntentError, setPaymentIntentError] = useState<string>("");

  // Fetch pricing with discounts when authenticated
  const { data: pricingData } = useQuery({
    queryKey: ['/api/cart/calculate-pricing', cartItems],
    queryFn: async () => {
      if (!isAuthenticated || cartItems.length === 0) return null;
      const response = await apiRequest('POST', '/api/cart/calculate-pricing', { items: cartItems });
      return response.json();
    },
    enabled: isAuthenticated && cartItems.length > 0,
  });

  // Merge cart items with pricing data
  useEffect(() => {
    if (pricingData?.items) {
      setPricedItems(pricingData.items);
    } else {
      setPricedItems(cartItems);
    }
  }, [pricingData, cartItems]);

  // Check authentication
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: t('checkout.toast.authRequired.title'),
        description: t('checkout.toast.authRequired.description'),
        variant: "destructive",
      });
      window.location.href = '/api/login';
    }
  }, [authLoading, isAuthenticated, toast, t]);

  // Load cart and create payment intent
  useEffect(() => {
    const initializeCheckout = async () => {
      const cart = getCart();

      // Handle empty cart
      if (cart.length === 0) {
        toast({
          title: t('checkout.toast.cartEmpty.title'),
          description: t('checkout.toast.cartEmpty.description'),
          variant: "destructive",
        });
        setLocation('/cart');
        return;
      }

      setCartItems(cart);

      // Create Payment Intent
      try {
        setIsCreatingPaymentIntent(true);
        
        const items = cart.map(item => ({
          storybookId: item.storybookId,
          type: item.type,
          price: item.price,
        }));

        const response = await apiRequest('POST', '/api/create-payment-intent', { items });
        const data = await response.json();
        setClientSecret(data.clientSecret);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to initialize checkout';
        setPaymentIntentError(errorMessage);
        toast({
          title: t('checkout.toast.initializationFailed.title'),
          description: errorMessage,
          variant: "destructive",
        });
      } finally {
        setIsCreatingPaymentIntent(false);
      }
    };

    if (isAuthenticated && !authLoading) {
      initializeCheckout();
    }
  }, [isAuthenticated, authLoading, setLocation, toast, t]);

  const totalPrice = pricedItems.reduce((sum, item) => sum + item.price, 0);
  const totalDiscount = pricedItems.reduce((sum, item) => sum + (item.discount || 0), 0);

  // Show loading state
  if (authLoading || isCreatingPaymentIntent) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-lg text-muted-foreground">
              {authLoading ? t('checkout.states.authenticating') : t('checkout.states.preparingCheckout')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (paymentIntentError) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <div className="text-center py-16">
            <h2 className="text-2xl font-semibold mb-4 text-destructive">
              {t('checkout.error.title')}
            </h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              {paymentIntentError}
            </p>
            <Button onClick={() => setLocation('/cart')} data-testid="button-back-to-cart">
              {t('checkout.error.backButton')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Ensure we have a client secret before rendering
  if (!clientSecret) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-lg text-muted-foreground">{t('checkout.states.loading')}</p>
          </div>
        </div>
      </div>
    );
  }

  const options = {
    clientSecret,
    appearance: {
      theme: 'stripe' as const,
    },
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold font-display gradient-text mb-2" data-testid="text-checkout-title">
            {t('checkout.title')}
          </h1>
          <p className="text-muted-foreground">
            {t('checkout.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Summary */}
          <div className="lg:col-span-1">
            <Card className="sticky top-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  {t('checkout.orderSummary.title')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {pricedItems.map((item) => {
                    const hasDiscount = item.discount && item.discount > 0;
                    return (
                      <div 
                        key={`${item.storybookId}-${item.type}`}
                        className="space-y-2"
                        data-testid={`checkout-item-${item.storybookId}-${item.type}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate" data-testid={`text-item-title-${item.storybookId}-${item.type}`}>
                              {item.title}
                            </p>
                            <div className="mt-1 space-y-1">
                              <Badge 
                                variant={item.type === 'digital' ? 'default' : 'secondary'}
                                data-testid={`badge-item-type-${item.storybookId}-${item.type}`}
                              >
                                {item.type === 'digital' ? t('checkout.orderSummary.ebook') : t('checkout.orderSummary.printEdition')}
                              </Badge>
                              {item.type === 'print' && (
                                <p className="text-xs text-muted-foreground mt-1" data-testid={`text-free-ebook-${item.storybookId}`}>
                                  {t('checkout.orderSummary.includesFreeEbook')}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {hasDiscount && (
                              <span className="text-xs text-muted-foreground line-through" data-testid={`text-original-price-${item.storybookId}-${item.type}`}>
                                ${((item.originalPrice || item.price) / 100).toFixed(2)}
                              </span>
                            )}
                            <span className={`text-sm font-semibold whitespace-nowrap ${hasDiscount ? 'text-green-600' : ''}`} data-testid={`text-item-price-${item.storybookId}-${item.type}`}>
                              ${(item.price / 100).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="border-t border-border my-4" />

                {totalDiscount > 0 && (
                  <div className="flex items-center justify-between pb-2">
                    <span className="text-sm text-muted-foreground">{t('cart.totalDiscount')}</span>
                    <span className="text-sm font-semibold text-green-600" data-testid="text-total-discount">
                      -${(totalDiscount / 100).toFixed(2)}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <span className="text-lg font-semibold">{t('checkout.orderSummary.total')}</span>
                  <span className="text-2xl font-bold gradient-text" data-testid="text-checkout-total">
                    ${(totalPrice / 100).toFixed(2)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Payment Form */}
          <div className="lg:col-span-2">
            <Elements stripe={stripePromise} options={options}>
              <CheckoutForm totalAmount={totalPrice} cartItems={cartItems} />
            </Elements>
          </div>
        </div>
      </div>
    </div>
  );
}
