import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
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
import { apiRequest } from "@/lib/queryClient";
import { SEO } from "@/components/SEO";

interface PricedCartItem extends CartItem {
  originalPrice?: number;
  discount?: number;
}

function CartItemCard({ item, onRemove }: { item: PricedCartItem; onRemove: (storybookId: string, type: 'digital' | 'print') => void }) {
  const { t } = useTranslation();
  const { data: storybook, isLoading } = useQuery<Storybook>({
    queryKey: ['/api/storybooks', item.storybookId],
  });

  const coverImageUrl = storybook?.pages?.[0]?.imageUrl;
  const hasDiscount = item.discount && item.discount > 0;

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
              loading="lazy"
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
                  {item.type === 'digital' ? t('cart.item.ebookEdition') : t('cart.item.printEdition')}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {item.type === 'digital' ? t('cart.item.downloadableEpub') : t('cart.item.professionallyPrinted')}
                </span>
              </div>
              {item.type === 'print' && (
                <Badge variant="outline" className="w-fit" data-testid={`badge-free-ebook-${item.storybookId}`}>
                  {t('cart.item.includesFreeEbook')}
                </Badge>
              )}
              {hasDiscount && item.discount && (
                <Badge variant="default" className="w-fit bg-green-600 hover:bg-green-700" data-testid={`badge-discount-${item.storybookId}`}>
                  {t('cart.item.digitalOwnerDiscount')}: -${(item.discount / 100).toFixed(2)}
                </Badge>
              )}
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <div className="flex items-center gap-3">
              {hasDiscount && (
                <span className="text-sm text-muted-foreground line-through" data-testid={`text-original-price-${item.storybookId}-${item.type}`}>
                  ${((item.originalPrice || item.price) / 100).toFixed(2)}
                </span>
              )}
              <span className={`text-lg font-semibold ${hasDiscount ? 'text-green-600' : ''}`} data-testid={`text-price-${item.storybookId}-${item.type}`}>
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
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [pricedItems, setPricedItems] = useState<PricedCartItem[]>([]);

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
        title: t('cart.toast.cancelled.title'),
        description: t('cart.toast.cancelled.description'),
      });
      window.history.replaceState({}, '', '/cart');
    } else if (params.get('success') === 'true') {
      clearCart();
      loadCart();
      window.dispatchEvent(new Event('cartUpdated'));
      toast({
        title: t('cart.toast.success.title'),
        description: t('cart.toast.success.description'),
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
      title: t('cart.toast.removed.title'),
      description: t('cart.toast.removed.description'),
    });
  };

  const handleClearCart = () => {
    clearCart();
    setCartItems([]);
    window.dispatchEvent(new Event('cartUpdated'));
    toast({
      title: t('cart.toast.cleared.title'),
      description: t('cart.toast.cleared.description'),
    });
  };

  const handleCheckout = () => {
    if (!isAuthenticated) {
      toast({
        title: t('cart.toast.authRequired.title'),
        description: t('cart.toast.authRequired.description'),
        variant: "destructive",
      });
      window.location.href = '/api/login';
      return;
    }

    if (cartItems.length === 0) {
      toast({
        title: t('cart.toast.cartEmpty.title'),
        description: t('cart.toast.cartEmpty.description'),
        variant: "destructive",
      });
      return;
    }

    setLocation('/checkout');
  };

  const totalPrice = pricedItems.reduce((sum, item) => sum + item.price, 0);
  const totalDiscount = pricedItems.reduce((sum, item) => sum + (item.discount || 0), 0);

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
            {t('cart.title')}
          </h1>
          <p className="text-muted-foreground" data-testid="text-cart-count">
            {t('cart.count', { count: cartItems.length })}
          </p>
        </div>

        {cartItems.length === 0 ? (
          <div className="text-center py-16">
            <ShoppingCart className="mx-auto h-16 w-16 text-muted-foreground mb-6" />
            <h2 className="text-2xl font-semibold mb-4" data-testid="text-empty-cart">
              {t('cart.empty.title')}
            </h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              {t('cart.empty.description')}
            </p>
            <Link href="/library">
              <Button className="gradient-bg hover:opacity-90 !text-[hsl(258,90%,20%)]" data-testid="link-library">
                {t('cart.empty.button')}
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-4">
              {pricedItems.map((item) => (
                <CartItemCard
                  key={`${item.storybookId}-${item.type}`}
                  item={item}
                  onRemove={handleRemoveItem}
                />
              ))}
            </div>

            <Card className="bg-muted/50">
              <CardContent className="pt-6">
                {totalDiscount > 0 && (
                  <div className="flex items-center justify-between mb-3 pb-3 border-b">
                    <span className="text-sm text-muted-foreground">{t('cart.totalDiscount')}</span>
                    <span className="text-sm font-semibold text-green-600" data-testid="text-total-discount">
                      -${(totalDiscount / 100).toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between mb-6">
                  <span className="text-lg font-semibold">{t('cart.total')}</span>
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
                    {t('cart.clearCart')}
                  </Button>
                  <Button
                    onClick={handleCheckout}
                    size="lg"
                    className="w-full gradient-bg !text-[hsl(258,90%,20%)] shadow-lg text-lg transition-all duration-200 hover:scale-105 hover:shadow-2xl hover:brightness-110 hover:ring-2 hover:ring-[hsl(258,90%,40%)] hover:ring-offset-2"
                    data-testid="button-checkout"
                  >
                    <ShoppingCart className="h-5 w-5 mr-2" />
                    {t('cart.proceedToCheckout')}
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
