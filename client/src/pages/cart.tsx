import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import Navigation from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ShoppingCart, Trash2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getCart, removeFromCart, clearCart, type CartItem } from "@/lib/cartUtils";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import type { Storybook } from "@shared/schema";

function CartItemCard({ item, onRemove }: { item: CartItem; onRemove: (storybookId: string, type: 'digital' | 'print') => void }) {
  const { data: storybook, isLoading } = useQuery<Storybook>({
    queryKey: ['/api/storybooks', item.storybookId],
  });

  const coverImageUrl = storybook?.pages?.[0]?.imageUrl;

  return (
    <Card data-testid={`card-item-${item.storybookId}-${item.type}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-4">
          {isLoading ? (
            <Skeleton className="w-20 h-28 rounded-lg flex-shrink-0" data-testid={`skeleton-image-${item.storybookId}`} />
          ) : coverImageUrl ? (
            <img
              src={coverImageUrl}
              alt={`${item.title} cover`}
              className="w-20 h-28 object-cover rounded-lg flex-shrink-0"
              data-testid={`img-cover-${item.storybookId}-${item.type}`}
            />
          ) : (
            <div className="w-20 h-28 bg-muted rounded-lg flex-shrink-0 flex items-center justify-center">
              <ShoppingCart className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
          
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg mb-2" data-testid={`text-title-${item.storybookId}-${item.type}`}>
              {item.title}
            </CardTitle>
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={item.type === 'digital' ? 'default' : 'secondary'} data-testid={`badge-type-${item.storybookId}-${item.type}`}>
                  {item.type === 'digital' ? 'E-book Edition' : 'Print Edition'}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {item.type === 'digital' ? 'Downloadable EPUB' : 'Professionally printed'}
                </span>
              </div>
              {item.type === 'print' && (
                <Badge variant="outline" className="w-fit" data-testid={`badge-free-ebook-${item.storybookId}`}>
                  ✨ Includes free e-book
                </Badge>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="text-lg font-semibold" data-testid={`text-price-${item.storybookId}-${item.type}`}>
              ${(item.price / 100).toFixed(2)}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemove(item.storybookId, item.type)}
              data-testid={`button-remove-${item.storybookId}-${item.type}`}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}

export default function Cart() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  useEffect(() => {
    const loadCart = () => {
      setCartItems(getCart());
    };

    loadCart();

    window.addEventListener('storage', loadCart);
    window.addEventListener('cartUpdated', loadCart);

    const params = new URLSearchParams(window.location.search);
    if (params.get('cancelled') === 'true') {
      toast({
        title: "Checkout cancelled",
        description: "Your items are still in the cart",
      });
      window.history.replaceState({}, '', '/cart');
    } else if (params.get('success') === 'true') {
      clearCart();
      loadCart();
      window.dispatchEvent(new Event('cartUpdated'));
      toast({
        title: "Purchase successful!",
        description: "Your items have been purchased",
      });
      window.history.replaceState({}, '', '/cart');
    }

    return () => {
      window.removeEventListener('storage', loadCart);
      window.removeEventListener('cartUpdated', loadCart);
    };
  }, [toast]);

  const handleRemoveItem = (storybookId: string, type: 'digital' | 'print') => {
    removeFromCart(storybookId, type);
    setCartItems(getCart());
    window.dispatchEvent(new Event('cartUpdated'));
    toast({
      title: "Item removed",
      description: "The item has been removed from your cart",
    });
  };

  const handleClearCart = () => {
    clearCart();
    setCartItems([]);
    window.dispatchEvent(new Event('cartUpdated'));
    toast({
      title: "Cart cleared",
      description: "All items have been removed from your cart",
    });
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

  const totalPrice = cartItems.reduce((sum, item) => sum + item.price, 0);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold font-display gradient-text mb-2" data-testid="text-cart-title">
            Shopping Cart
          </h1>
          <p className="text-muted-foreground" data-testid="text-cart-count">
            {cartItems.length} {cartItems.length === 1 ? 'item' : 'items'} in your cart
          </p>
        </div>

        {cartItems.length === 0 ? (
          <div className="text-center py-16">
            <ShoppingCart className="mx-auto h-16 w-16 text-muted-foreground mb-6" />
            <h2 className="text-2xl font-semibold mb-4" data-testid="text-empty-cart">
              Your cart is empty
            </h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              Browse our library and add some amazing storybooks to your cart!
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
                  key={`${item.storybookId}-${item.type}`}
                  item={item}
                  onRemove={handleRemoveItem}
                />
              ))}
            </div>

            <Card className="bg-muted/50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-6">
                  <span className="text-lg font-semibold">Total</span>
                  <span className="text-3xl font-bold text-[hsl(258,90%,20%)] dark:text-[hsl(258,70%,70%)]" data-testid="text-total">
                    ${(totalPrice / 100).toFixed(2)}
                  </span>
                </div>
                
                <div className="flex flex-col gap-3 items-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearCart}
                    className="text-xs"
                    data-testid="button-clear-cart"
                  >
                    <Trash2 className="h-3 w-3 mr-1.5" />
                    Clear Cart
                  </Button>
                  <Button
                    onClick={handleCheckout}
                    size="lg"
                    className="w-full gradient-bg !text-[hsl(258,90%,20%)] shadow-lg text-lg transition-all duration-200 hover:scale-105 hover:shadow-2xl hover:brightness-110 hover:ring-2 hover:ring-[hsl(258,90%,40%)] hover:ring-offset-2"
                    data-testid="button-checkout"
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
