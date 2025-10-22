import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import Navigation from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ShoppingCart, Trash2, X, Minus, Plus, Loader2, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Storybook, CartItem, Purchase } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { SEO } from "@/components/SEO";
import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BOOK_SIZES, getBookSizesByOrientation, type BookOrientation } from "@shared/bookSizes";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

// Initialize Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || '');

// Shipping address schema
const shippingAddressSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  phoneNumber: z.string().min(1, "Phone number is required"),
  addressLine1: z.string().min(1, "Address line 1 is required"),
  addressLine2: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().optional(),
  postalCode: z.string().min(1, "Postal/ZIP code is required"),
  countryCode: z.string().min(2, "Country code is required").default('US'),
});

type ShippingAddressFormValues = z.infer<typeof shippingAddressSchema>;

interface EnrichedCartItem extends CartItem {
  storybook?: Storybook | null;
  price: number;
  originalPrice: number;
  discount: number;
}

function formatPrice(cents: number): string {
  return (cents / 100).toFixed(2);
}

function CartItemCard({ 
  item, 
  onRemove, 
  onUpdateQuantity,
  onUpdateProductType,
  onUpdateBookSize,
}: { 
  item: EnrichedCartItem; 
  onRemove: () => void;
  onUpdateQuantity: (quantity: number) => void;
  onUpdateProductType: (productType: 'digital' | 'print') => void;
  onUpdateBookSize: (bookSize: string) => void;
}) {
  const { t } = useTranslation();
  const coverImageUrl = item.storybook?.coverImageUrl || item.storybook?.pages?.[0]?.imageUrl;
  const itemTotal = item.price * item.quantity;

  // Determine storybook orientation for book size filtering
  const storybookOrientation: BookOrientation = item.storybook?.orientation as BookOrientation || 'portrait';
  const availableBookSizes = getBookSizesByOrientation(storybookOrientation);
  
  // Validate current bookSize is in available options, fallback to first available
  const validBookSize = item.bookSize && availableBookSizes.some(size => size.id === item.bookSize) 
    ? item.bookSize 
    : availableBookSizes[0]?.id || 'a5-portrait';
  
  // Validate productType to ensure it's always valid
  const validProductType: 'digital' | 'print' = 
    (item.productType === 'digital' || item.productType === 'print') 
      ? item.productType 
      : 'digital';

  return (
    <Card data-testid={`card-item-${item.storybookId}-${item.productType}`}>
      <CardHeader className="pb-3 p-4 sm:p-6">
        <div className="flex flex-col gap-4">
          {/* Top row: Image, Title, Remove Button */}
          <div className="flex flex-col sm:flex-row items-start gap-4">
            {coverImageUrl ? (
              <img
                src={coverImageUrl}
                alt={`${item.storybook?.title || 'Storybook'} cover`}
                className="w-full sm:w-20 h-40 sm:h-28 object-cover rounded-lg flex-shrink-0"
                data-testid={`img-cover-${item.storybookId}-${item.productType}`}
                loading="lazy"
              />
            ) : (
              <div className="w-full sm:w-20 h-40 sm:h-28 bg-muted rounded-lg flex-shrink-0 flex items-center justify-center">
                <ShoppingCart className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4">
                <CardTitle className="text-lg" data-testid={`text-title-${item.storybookId}-${item.productType}`}>
                  {item.storybook?.title || 'Untitled Story'}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 flex-shrink-0"
                  onClick={onRemove}
                  data-testid={`button-remove-${item.storybookId}-${item.productType}`}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Configuration row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Product Type Selector */}
            <div className="space-y-2">
              <Label htmlFor={`product-type-${item.id}`} className="text-sm font-medium">
                Product Type
              </Label>
              <Select
                value={validProductType}
                onValueChange={(value: 'digital' | 'print') => onUpdateProductType(value)}
              >
                <SelectTrigger 
                  id={`product-type-${item.id}`}
                  data-testid={`select-product-type-${item.storybookId}-${item.productType}`}
                >
                  <SelectValue placeholder="Select product type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="digital">Digital (E-book)</SelectItem>
                  <SelectItem value="print">Print (Hardcover)</SelectItem>
                </SelectContent>
              </Select>
              {validProductType === 'print' && (
                <p className="text-xs text-green-600 dark:text-green-400">Includes Free E-book</p>
              )}
            </div>

            {/* Book Size Selector (only for print) */}
            {validProductType === 'print' && (
              <div className="space-y-2">
                <Label htmlFor={`book-size-${item.id}`} className="text-sm font-medium">
                  Book Size
                </Label>
                <Select
                  value={validBookSize}
                  onValueChange={onUpdateBookSize}
                >
                  <SelectTrigger 
                    id={`book-size-${item.id}`}
                    data-testid={`select-book-size-${item.storybookId}-${item.productType}`}
                  >
                    <SelectValue placeholder="Select book size" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableBookSizes.map((size) => (
                      <SelectItem key={size.id} value={size.id}>
                        {size.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Quantity Control (only for digital) */}
            {validProductType === 'digital' ? (
              <div className="space-y-2">
                <Label htmlFor={`quantity-${item.id}`} className="text-sm font-medium">
                  Quantity
                </Label>
                <div className="flex items-center gap-2 border rounded-lg p-1 w-fit">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onUpdateQuantity(Math.max(1, item.quantity - 1))}
                    disabled={item.quantity <= 1}
                    data-testid={`button-decrease-${item.storybookId}-${item.productType}`}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-8 text-center font-medium" data-testid={`text-quantity-${item.storybookId}-${item.productType}`}>
                    {item.quantity}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onUpdateQuantity(item.quantity + 1)}
                    data-testid={`button-increase-${item.storybookId}-${item.productType}`}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          {/* Price Display */}
          <div className="flex items-end justify-between pt-2 border-t">
            <div>
              {item.discount > 0 ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-foreground" data-testid={`text-price-${item.storybookId}-${item.productType}`}>
                      ${formatPrice(item.price)}
                    </span>
                    <span className="text-sm line-through text-muted-foreground">
                      ${formatPrice(item.originalPrice)}
                    </span>
                    <Badge variant="destructive" className="text-xs">
                      Save ${formatPrice(item.discount)}
                    </Badge>
                  </div>
                  <p className="text-xs text-green-600 dark:text-green-400">
                    Digital edition discount applied
                  </p>
                </div>
              ) : (
                <span className="text-lg font-bold text-foreground" data-testid={`text-price-${item.storybookId}-${item.productType}`}>
                  ${formatPrice(item.price)}
                </span>
              )}
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Item Total</div>
              <div className="text-xl font-bold" data-testid={`text-item-total-${item.storybookId}-${item.productType}`}>
                ${formatPrice(itemTotal)}
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}

function ShippingAddressForm({ 
  onSubmit, 
  onCancel,
  isProcessing,
}: {
  onSubmit: (address: ShippingAddressFormValues) => void;
  onCancel: () => void;
  isProcessing: boolean;
}) {
  const form = useForm<ShippingAddressFormValues>({
    resolver: zodResolver(shippingAddressSchema),
    defaultValues: {
      name: '',
      email: '',
      phoneNumber: '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      postalCode: '',
      countryCode: 'US',
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="John Doe" data-testid="input-name" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input {...field} type="email" placeholder="john@example.com" data-testid="input-email" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="phoneNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone Number</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="+1 (555) 123-4567" data-testid="input-phone" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="addressLine1"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Address Line 1</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="123 Main St" data-testid="input-address-line1" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="addressLine2"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Address Line 2 (Optional)</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Apt 4B" data-testid="input-address-line2" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>City</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="New York" data-testid="input-city" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="state"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>State/Province</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="NY" data-testid="input-state" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="postalCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Postal Code</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="10001" data-testid="input-postal-code" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="countryCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Country</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger data-testid="select-country">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="US">United States</SelectItem>
                        <SelectItem value="CA">Canada</SelectItem>
                        <SelectItem value="GB">United Kingdom</SelectItem>
                        <SelectItem value="AU">Australia</SelectItem>
                        <SelectItem value="DE">Germany</SelectItem>
                        <SelectItem value="FR">France</SelectItem>
                        <SelectItem value="ES">Spain</SelectItem>
                        <SelectItem value="IT">Italy</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isProcessing}
            className="flex-1"
            data-testid="button-cancel-shipping"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isProcessing}
            className="flex-1 gradient-bg !text-[hsl(258,90%,20%)]"
            data-testid="button-submit-shipping"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <MapPin className="h-4 w-4 mr-2" />
                Complete Order
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}

function CheckoutDialog({ 
  open, 
  onOpenChange, 
  clientSecret, 
  amount,
  hasPrintItems,
  onSuccess,
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  clientSecret: string;
  amount: number;
  hasPrintItems: boolean;
  onSuccess: (paymentIntentId: string, shippingAddress?: ShippingAddressFormValues) => void;
}) {
  const [checkoutStep, setCheckoutStep] = useState<'payment' | 'shipping' | 'complete'>('payment');
  const [paymentIntentId, setPaymentIntentId] = useState<string>('');

  const handlePaymentSuccess = (intentId: string) => {
    setPaymentIntentId(intentId);
    
    if (hasPrintItems) {
      setCheckoutStep('shipping');
    } else {
      onSuccess(intentId);
    }
  };

  const handleShippingSubmit = (address: ShippingAddressFormValues) => {
    onSuccess(paymentIntentId, address);
  };

  const handleCancel = () => {
    setCheckoutStep('payment');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {checkoutStep === 'payment' ? 'Complete Your Purchase' : 'Shipping Address'}
          </DialogTitle>
        </DialogHeader>
        
        {checkoutStep === 'payment' ? (
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <CheckoutForm amount={amount} onSuccess={handlePaymentSuccess} />
          </Elements>
        ) : (
          <ShippingAddressForm 
            onSubmit={handleShippingSubmit} 
            onCancel={handleCancel}
            isProcessing={false}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CheckoutForm({ amount, onSuccess }: { amount: number; onSuccess: (paymentIntentId: string) => void }) {
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
          return_url: `${window.location.origin}/cart`,
        },
        redirect: 'if_required',
      });

      if (error) {
        toast({
          title: "Payment failed",
          description: error.message,
          variant: "destructive",
        });
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        onSuccess(paymentIntent.id);
      }
    } catch (error: any) {
      toast({
        title: "Payment failed",
        description: error.message || "An error occurred during payment",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Total Amount</span>
          <span className="text-2xl font-bold">${formatPrice(amount)}</span>
        </div>
        <Button 
          type="submit" 
          disabled={!stripe || isProcessing}
          className="w-full gradient-bg !text-[hsl(258,90%,20%)]"
          data-testid="button-confirm-payment"
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            `Pay $${formatPrice(amount)}`
          )}
        </Button>
      </div>
    </form>
  );
}

export default function Cart() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const [checkoutDialog, setCheckoutDialog] = useState<{ open: boolean; clientSecret?: string; amount?: number }>({ open: false });

  // Fetch cart items from database (now includes storybook data and pricing)
  const { data: cartResponse, isLoading, refetch } = useQuery<{ items: EnrichedCartItem[] }>({
    queryKey: ['/api/cart'],
    enabled: isAuthenticated,
  });

  const cartItems = cartResponse?.items || [];
  const hasPrintItems = cartItems.some(item => item.productType === 'print');

  // Shipping configuration state
  const [shippingMethod, setShippingMethod] = useState('standard');
  const [shippingCountry, setShippingCountry] = useState('United States');

  // Calculate totals
  const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalDiscount = cartItems.reduce((sum, item) => sum + (item.discount * item.quantity), 0);
  const totalBeforeDiscount = cartItems.reduce((sum, item) => sum + (item.originalPrice * item.quantity), 0);
  
  // Shipping cost (placeholder - would be calculated by Prodigi API in production)
  const shippingCost = hasPrintItems ? (
    shippingMethod === 'overnight' ? 2999 : 
    shippingMethod === 'express' ? 1999 : 
    shippingMethod === 'standard' ? 999 : 
    599 // budget
  ) : 0;
  
  const total = subtotal + shippingCost;

  // Remove item mutation
  const removeItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const response = await apiRequest('DELETE', `/api/cart/${itemId}`);
      if (!response.ok) {
        throw new Error('Failed to remove item');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cart'] });
      toast({
        title: "Item removed",
        description: "Item has been removed from your cart",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove item from cart",
        variant: "destructive",
      });
    },
  });

  // Update item mutation (for quantity, product type, book size)
  const updateItemMutation = useMutation({
    mutationFn: async ({ itemId, updates }: { itemId: string; updates: Partial<{ quantity: number; productType: string; bookSize: string }> }) => {
      const response = await apiRequest('PATCH', `/api/cart/${itemId}`, updates);
      if (!response.ok) {
        throw new Error('Failed to update item');
      }
      return response.json();
    },
    onSuccess: (data, variables) => {
      // Use setTimeout to prevent race conditions with Select components
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['/api/cart'] });
      }, 50);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update item",
        variant: "destructive",
      });
    },
  });

  // Checkout mutation
  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/cart/checkout');
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create checkout');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setCheckoutDialog({ 
        open: true, 
        clientSecret: data.clientSecret,
        amount: data.amount,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Checkout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Finalize purchase mutation
  const finalizeMutation = useMutation({
    mutationFn: async ({ paymentIntentId, shippingAddress }: { paymentIntentId: string; shippingAddress?: ShippingAddressFormValues }) => {
      const response = await apiRequest('POST', '/api/cart/finalize', { 
        paymentIntentId,
        shippingAddress,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to finalize purchase');
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/cart'] });
      queryClient.invalidateQueries({ queryKey: ['/api/purchases'] });
      
      const purchases = data.purchases || [];
      const printPurchases = purchases.filter((p: Purchase) => p.type === 'print');
      const digitalPurchases = purchases.filter((p: Purchase) => p.type === 'digital');
      
      setCheckoutDialog({ open: false });
      
      // Show enhanced success toast with order details
      const itemCount = purchases.length;
      let description = `${itemCount} ${itemCount === 1 ? 'item' : 'items'} purchased successfully. `;
      
      if (printPurchases.length > 0) {
        description += `Your ${printPurchases.length} print ${printPurchases.length === 1 ? 'book' : 'books'} will be shipped soon. `;
      }
      
      description += "Check your library to view your purchases.";
      
      toast({
        title: "🎉 Order Confirmed!",
        description: description,
        duration: 5000,
      });
      
      // Redirect to library after a short delay
      setTimeout(() => {
        setLocation('/library');
      }, 2000);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to complete purchase",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleRemoveItem = (itemId: string) => {
    removeItemMutation.mutate(itemId);
  };

  const handleUpdateQuantity = (itemId: string, quantity: number) => {
    updateItemMutation.mutate({ itemId, updates: { quantity } });
  };

  const handleUpdateProductType = (itemId: string, productType: 'digital' | 'print') => {
    updateItemMutation.mutate({ itemId, updates: { productType } });
  };

  const handleUpdateBookSize = (itemId: string, bookSize: string) => {
    updateItemMutation.mutate({ itemId, updates: { bookSize } });
  };

  const handleCheckout = () => {
    if (!isAuthenticated) {
      toast({
        title: "Authentication required",
        description: "Please log in to checkout",
        variant: "destructive",
      });
      window.location.href = '/api/login';
      return;
    }

    if (cartItems.length === 0) {
      toast({
        title: "Cart is empty",
        description: "Add items to your cart before checking out",
        variant: "destructive",
      });
      return;
    }

    checkoutMutation.mutate();
  };

  const handlePaymentSuccess = (paymentIntentId: string, shippingAddress?: ShippingAddressFormValues) => {
    finalizeMutation.mutate({ paymentIntentId, shippingAddress });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        <SEO 
          title="Shopping Cart - AI Storybook Builder"
          description="Review your selected storybooks before checkout"
          path="/cart"
        />
        <Navigation />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <ShoppingCart className="mx-auto h-16 w-16 text-muted-foreground mb-6" />
          <h2 className="text-2xl font-semibold mb-4">Sign in to view your cart</h2>
          <p className="text-muted-foreground mb-8">
            You need to be logged in to use the shopping cart
          </p>
          <Button onClick={() => window.location.href = '/api/login'} className="gradient-bg hover:opacity-90 !text-[hsl(258,90%,20%)]" data-testid="button-sign-in">
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title="Shopping Cart - AI Storybook Builder"
        description="Review your selected storybooks before checkout. Purchase digital downloads or print copies of your AI-generated children's stories."
        path="/cart"
      />
      <Navigation />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold font-display gradient-text mb-2" data-testid="text-cart-title">
            Shopping Cart
          </h1>
          <p className="text-muted-foreground" data-testid="text-cart-count">
            {isLoading ? 'Loading...' : `${cartItems.length} ${cartItems.length === 1 ? 'item' : 'items'}`}
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row items-start gap-4">
                    <Skeleton className="w-full sm:w-20 h-40 sm:h-28 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-6 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : cartItems.length === 0 ? (
          <div className="text-center py-16">
            <ShoppingCart className="mx-auto h-16 w-16 text-muted-foreground mb-6" />
            <h2 className="text-2xl font-semibold mb-4" data-testid="text-empty-cart">
              Your cart is empty
            </h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              Browse your library to add storybooks to your cart
            </p>
            <Link href="/library">
              <Button className="gradient-bg hover:opacity-90 !text-[hsl(258,90%,20%)]" data-testid="link-library">
                Browse Library
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-4">
              {cartItems.map((item) => (
                <CartItemCard
                  key={item.id}
                  item={item}
                  onRemove={() => handleRemoveItem(item.id)}
                  onUpdateQuantity={(quantity) => handleUpdateQuantity(item.id, quantity)}
                  onUpdateProductType={(productType) => handleUpdateProductType(item.id, productType)}
                  onUpdateBookSize={(bookSize) => handleUpdateBookSize(item.id, bookSize)}
                />
              ))}
            </div>

            {/* Shipping Configuration (only show if there are print items) */}
            {hasPrintItems && (
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">Shipping Configuration</CardTitle>
                  <p className="text-sm text-muted-foreground">Configure shipping for your print items</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="shipping-method">Shipping Method</Label>
                      <Select value={shippingMethod} onValueChange={setShippingMethod}>
                        <SelectTrigger id="shipping-method" data-testid="select-shipping-method">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="budget">Budget Shipping ($5.99)</SelectItem>
                          <SelectItem value="standard">Standard Shipping ($9.99)</SelectItem>
                          <SelectItem value="express">Express Shipping ($19.99)</SelectItem>
                          <SelectItem value="overnight">Overnight Shipping ($29.99)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="shipping-country">Destination Country</Label>
                      <Select value={shippingCountry} onValueChange={setShippingCountry}>
                        <SelectTrigger id="shipping-country" data-testid="select-shipping-country">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="United States">United States</SelectItem>
                          <SelectItem value="Canada">Canada</SelectItem>
                          <SelectItem value="United Kingdom">United Kingdom</SelectItem>
                          <SelectItem value="Australia">Australia</SelectItem>
                          <SelectItem value="Germany">Germany</SelectItem>
                          <SelectItem value="France">France</SelectItem>
                          <SelectItem value="Spain">Spain</SelectItem>
                          <SelectItem value="Italy">Italy</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="bg-muted/50">
              <CardContent className="pt-6">
                <div className="space-y-3 mb-6">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Items</span>
                    <span data-testid="text-item-count">
                      {cartItems.reduce((sum, item) => sum + item.quantity, 0)}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span data-testid="text-subtotal">${formatPrice(subtotal)}</span>
                  </div>
                  
                  {totalDiscount > 0 && (
                    <div className="flex items-center justify-between text-sm text-green-600 dark:text-green-400">
                      <span>Discount</span>
                      <span data-testid="text-discount">-${formatPrice(totalDiscount)}</span>
                    </div>
                  )}
                  
                  {hasPrintItems && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Shipping</span>
                      <span data-testid="text-shipping">${formatPrice(shippingCost)}</span>
                    </div>
                  )}
                  
                  <div className="pt-3 border-t border-border">
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-semibold">Total</span>
                      <span className="text-3xl font-bold text-[hsl(258,90%,20%)] dark:text-[hsl(258,70%,70%)]" data-testid="text-total">
                        ${formatPrice(total)}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col gap-3">
                  <Button
                    onClick={handleCheckout}
                    size="lg"
                    className="w-full gradient-bg !text-[hsl(258,90%,20%)] shadow-lg text-lg transition-all duration-200 hover:scale-105 hover:shadow-2xl hover:brightness-110 hover:ring-2 hover:ring-[hsl(258,90%,40%)] hover:ring-offset-2"
                    data-testid="button-checkout"
                    disabled={removeItemMutation.isPending || updateItemMutation.isPending || checkoutMutation.isPending}
                  >
                    {checkoutMutation.isPending ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="h-5 w-5 mr-2" />
                        Proceed to Checkout
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {checkoutDialog.open && checkoutDialog.clientSecret && checkoutDialog.amount && (
        <CheckoutDialog
          open={checkoutDialog.open}
          onOpenChange={(open) => setCheckoutDialog({ open })}
          clientSecret={checkoutDialog.clientSecret}
          amount={checkoutDialog.amount}
          hasPrintItems={hasPrintItems}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
}
