import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import Navigation from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ShoppingCart, Trash2, Minus, Plus, Loader2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Storybook, CartItem } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { SEO } from "@/components/SEO";
import { useState } from "react";
import { BOOK_SIZES, getBookSizesByOrientation, type BookOrientation } from "@shared/bookSizes";
import { NewCheckoutDialog } from "@/components/cart/NewCheckoutDialog";


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
  isUpdating,
}: { 
  item: EnrichedCartItem; 
  onRemove: () => void;
  onUpdateQuantity: (quantity: number) => void;
  onUpdateProductType: (productType: 'digital' | 'print') => void;
  onUpdateBookSize: (bookSize: string) => void;
  isUpdating: boolean;
}) {
  const { t } = useTranslation();
  const coverImageUrl = item.storybook?.coverImageUrl || item.storybook?.pages?.[0]?.imageUrl;
  const itemTotal = item.price * item.quantity;

  // Determine storybook orientation for book size filtering
  const storybookOrientation: BookOrientation = item.storybook?.orientation as BookOrientation || 'portrait';
  const availableBookSizes = getBookSizesByOrientation(storybookOrientation);
  
  // Ensure availableBookSizes is never empty (safety check)
  const safeAvailableBookSizes = availableBookSizes.length > 0 ? availableBookSizes : getBookSizesByOrientation('portrait');
  
  // Validate current bookSize is in available options, fallback to first available
  const validBookSize = item.bookSize && safeAvailableBookSizes.some(size => size.id === item.bookSize) 
    ? item.bookSize 
    : safeAvailableBookSizes[0]?.id || 'a5-portrait';
  
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
                disabled={isUpdating}
              >
                <SelectTrigger 
                  id={`product-type-${item.id}`}
                  data-testid={`select-product-type-${item.storybookId}-${item.productType}`}
                  disabled={isUpdating}
                >
                  <SelectValue placeholder="Select product type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="digital">Digital (E-book)</SelectItem>
                  <SelectItem value="print">Print (Hardcover)</SelectItem>
                </SelectContent>
              </Select>
              {validProductType === 'print' && (
                <p className="text-xs text-green-600 dark:text-green-400 font-medium">✓ Print Includes the E-book</p>
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
                  disabled={isUpdating}
                >
                  <SelectTrigger 
                    id={`book-size-${item.id}`}
                    data-testid={`select-book-size-${item.storybookId}-${item.productType}`}
                    disabled={isUpdating}
                  >
                    <SelectValue placeholder="Select book size" />
                  </SelectTrigger>
                  <SelectContent>
                    {safeAvailableBookSizes.map((size) => (
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

export default function Cart() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const [checkoutDialogOpen, setCheckoutDialogOpen] = useState(false);

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


  const handleRemoveItem = (itemId: string) => {
    removeItemMutation.mutate(itemId);
  };

  const handleUpdateQuantity = (itemId: string, quantity: number) => {
    updateItemMutation.mutate({ itemId, updates: { quantity } });
  };

  const handleUpdateProductType = (itemId: string, productType: 'digital' | 'print') => {
    try {
      updateItemMutation.mutate({ itemId, updates: { productType } });
    } catch (error) {
      console.error('Error updating product type:', error);
    }
  };

  const handleUpdateBookSize = (itemId: string, bookSize: string) => {
    try {
      updateItemMutation.mutate({ itemId, updates: { bookSize } });
    } catch (error) {
      console.error('Error updating book size:', error);
    }
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

    setCheckoutDialogOpen(true);
  };

  const handleCheckoutSuccess = () => {
    // Redirect to orders page to view the order
    setTimeout(() => {
      setLocation('/orders');
    }, 2000);
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
                  isUpdating={updateItemMutation.isPending}
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
                    disabled={removeItemMutation.isPending || updateItemMutation.isPending}
                  >
                    <ShoppingCart className="h-5 w-5 mr-2" />
                    Proceed to Checkout
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <NewCheckoutDialog
        open={checkoutDialogOpen}
        onOpenChange={setCheckoutDialogOpen}
        hasPrintItems={hasPrintItems}
        amount={total}
        onSuccess={handleCheckoutSuccess}
      />
    </div>
  );
}
