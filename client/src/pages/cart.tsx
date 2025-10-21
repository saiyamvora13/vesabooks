import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import Navigation from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ShoppingCart, Trash2, X, Minus, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Storybook, CartItem } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { SEO } from "@/components/SEO";

interface CartItemWithStorybook extends CartItem {
  storybook?: Storybook;
}

function CartItemCard({ 
  item, 
  onRemove, 
  onUpdateQuantity 
}: { 
  item: CartItemWithStorybook; 
  onRemove: () => void;
  onUpdateQuantity: (quantity: number) => void;
}) {
  const { t } = useTranslation();
  const { data: storybook, isLoading } = useQuery<Storybook>({
    queryKey: ['/api/storybooks', item.storybookId],
  });

  const coverImageUrl = storybook?.coverImageUrl || storybook?.pages?.[0]?.imageUrl;

  return (
    <Card data-testid={`card-item-${item.storybookId}-${item.productType}`}>
      <CardHeader className="pb-3 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start gap-4">
          {isLoading ? (
            <Skeleton className="w-full sm:w-20 h-40 sm:h-28 rounded-lg flex-shrink-0" data-testid={`skeleton-image-${item.storybookId}`} />
          ) : coverImageUrl ? (
            <img
              src={coverImageUrl}
              alt={`${storybook?.title} cover`}
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
            <CardTitle className="text-lg mb-2" data-testid={`text-title-${item.storybookId}-${item.productType}`}>
              {storybook?.title || 'Loading...'}
            </CardTitle>
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={item.productType === 'digital' ? 'default' : 'secondary'} data-testid={`badge-type-${item.storybookId}-${item.productType}`}>
                  {item.productType === 'digital' ? 'E-book Edition' : 'Print Edition'}
                </Badge>
                {item.productType === 'print' && item.bookSize && (
                  <Badge variant="outline" className="w-fit">
                    {item.bookSize}
                  </Badge>
                )}
              </div>
              {item.productType === 'digital' && (
                <p className="text-sm text-muted-foreground">Downloadable EPUB format</p>
              )}
              {item.productType === 'print' && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Professionally printed hardcover</p>
                  <Badge variant="outline" className="w-fit bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300">
                    Includes Free E-book
                  </Badge>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start w-full sm:w-auto gap-4 mt-3 sm:mt-0 flex-shrink-0">
            {/* Quantity Controls */}
            <div className="flex items-center gap-2 border rounded-lg p-1">
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
            
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10"
              onClick={onRemove}
              data-testid={`button-remove-${item.storybookId}-${item.productType}`}
            >
              <X className="h-5 w-5" />
            </Button>
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

  // Fetch cart items from database
  const { data: cartItems = [], isLoading, refetch } = useQuery<CartItem[]>({
    queryKey: ['/api/cart'],
    enabled: isAuthenticated,
  });

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

  // Update quantity mutation
  const updateQuantityMutation = useMutation({
    mutationFn: async ({ itemId, quantity }: { itemId: string; quantity: number }) => {
      const response = await apiRequest('PATCH', `/api/cart/${itemId}`, { quantity });
      if (!response.ok) {
        throw new Error('Failed to update quantity');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cart'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update quantity",
        variant: "destructive",
      });
    },
  });

  const handleRemoveItem = (itemId: string) => {
    removeItemMutation.mutate(itemId);
  };

  const handleUpdateQuantity = (itemId: string, quantity: number) => {
    updateQuantityMutation.mutate({ itemId, quantity });
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

    setLocation('/checkout');
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
          <Button onClick={() => window.location.href = '/api/login'} className="gradient-bg hover:opacity-90 !text-[hsl(258,90%,20%)]">
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
                />
              ))}
            </div>

            <Card className="bg-muted/50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-6">
                  <span className="text-lg font-semibold">Total Items</span>
                  <span className="text-3xl font-bold text-[hsl(258,90%,20%)] dark:text-[hsl(258,70%,70%)]" data-testid="text-total">
                    {cartItems.reduce((sum, item) => sum + item.quantity, 0)}
                  </span>
                </div>
                
                <div className="flex flex-col gap-3">
                  <Button
                    onClick={handleCheckout}
                    size="lg"
                    className="w-full gradient-bg !text-[hsl(258,90%,20%)] shadow-lg text-lg transition-all duration-200 hover:scale-105 hover:shadow-2xl hover:brightness-110 hover:ring-2 hover:ring-[hsl(258,90%,40%)] hover:ring-offset-2"
                    data-testid="button-checkout"
                    disabled={removeItemMutation.isPending || updateQuantityMutation.isPending}
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
    </div>
  );
}
