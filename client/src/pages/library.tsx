import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import Navigation from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Calendar, Plus, Trash2, ShoppingCart, Check, X } from "lucide-react";
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
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { addToCart, isInCart, removeFromCart } from "@/lib/cartUtils";

interface Storybook {
  id: string;
  title: string;
  prompt: string;
  pages: Array<{ pageNumber: number; text: string; imageUrl: string }>;
  createdAt: string;
  shareUrl: string | null;
}

function StorybookPurchaseButtons({ storybook }: { storybook: Storybook }) {
  const { toast } = useToast();
  const [cartUpdated, setCartUpdated] = useState(0);

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

  const handleAddToCart = (type: 'digital' | 'print') => {
    const price = type === 'digital' ? 399 : 2499;
    addToCart({
      storybookId: storybook.id,
      type,
      title: storybook.title,
      price,
    });
    toast({
      title: "Added to cart",
      description: `${storybook.title} - ${type === 'digital' ? 'Digital' : 'Print'} Edition`,
    });
    window.dispatchEvent(new Event('cartUpdated'));
    setCartUpdated(prev => prev + 1);
  };

  const handleRemoveFromCart = (type: 'digital' | 'print') => {
    removeFromCart(storybook.id, type);
    toast({
      title: "Removed from cart",
      description: `${storybook.title} - ${type === 'digital' ? 'Digital' : 'Print'} Edition`,
    });
    window.dispatchEvent(new Event('cartUpdated'));
    setCartUpdated(prev => prev + 1);
  };

  const inCartDigital = isInCart(storybook.id, 'digital');
  const inCartPrint = isInCart(storybook.id, 'print');

  return (
    <div className="space-y-2 mt-3">
      {digitalPurchase?.owned ? (
        <Badge variant="secondary" className="w-full justify-center py-1">
          <Check className="h-3 w-3 mr-1" />
          Digital Purchased
        </Badge>
      ) : (
        <Button
          size="sm"
          variant={inCartDigital ? "secondary" : "outline"}
          className="w-full"
          onClick={() => inCartDigital ? handleRemoveFromCart('digital') : handleAddToCart('digital')}
          data-testid={`button-buy-digital-${storybook.id}`}
        >
          {inCartDigital ? (
            <>
              <X className="h-4 w-4 mr-1" />
              Remove from Cart
            </>
          ) : (
            <>
              <ShoppingCart className="h-4 w-4 mr-1" />
              Buy Digital ($3.99)
            </>
          )}
        </Button>
      )}

      {printPurchase?.owned ? (
        <Badge variant="secondary" className="w-full justify-center py-1">
          <Check className="h-3 w-3 mr-1" />
          Print Purchased
        </Badge>
      ) : (
        <Button
          size="sm"
          variant={inCartPrint ? "secondary" : "outline"}
          className="w-full"
          onClick={() => inCartPrint ? handleRemoveFromCart('print') : handleAddToCart('print')}
          data-testid={`button-buy-print-${storybook.id}`}
        >
          {inCartPrint ? (
            <>
              <X className="h-4 w-4 mr-1" />
              Remove from Cart
            </>
          ) : (
            <>
              <ShoppingCart className="h-4 w-4 mr-1" />
              Buy Print ($24.99) • FREE e-book
            </>
          )}
        </Button>
      )}
    </div>
  );
}

export default function Library() {
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
        title: "Storybook deleted",
        description: "Your storybook has been permanently deleted.",
      });
      setDeletingBookId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete",
        description: error.message || "Something went wrong. Please try again.",
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
              <p className="mt-4 text-muted-foreground">Loading...</p>
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
            <h2 className="text-3xl font-bold mb-4">Please Log In</h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              You need to be logged in to view your storybook library.
            </p>
            <Button onClick={() => window.location.href = '/api/login'} data-testid="button-login">
              Log In
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
              My Storybooks
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground" data-testid="text-storybook-count">
              {storybooks?.length || 0} storybook{storybooks?.length === 1 ? '' : 's'} created
            </p>
          </div>
          
          <Link href="/create">
            <Button className="gradient-bg hover:opacity-90 !text-[hsl(258,90%,20%)] w-full sm:w-auto" data-testid="button-create-new">
              <Plus className="mr-2 h-4 w-4" />
              Create New
            </Button>
          </Link>
        </div>

        {error ? (
          <div className="text-center py-20">
            <BookOpen className="mx-auto h-16 w-16 text-destructive mb-6" />
            <h2 className="text-2xl font-semibold mb-4" data-testid="text-error-title">
              Failed to load storybooks
            </h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto" data-testid="text-error-message">
              {error instanceof Error ? error.message : 'An unexpected error occurred. Please try again later.'}
            </p>
            <Button onClick={() => window.location.reload()} variant="outline" data-testid="button-retry">
              Try Again
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
                      View
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
              No storybooks yet
            </h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              Start creating magical storybooks with AI. Your imagination is the only limit!
            </p>
            <Link href="/create">
              <Button className="gradient-bg hover:opacity-90 !text-[hsl(258,90%,20%)]" data-testid="button-create-first">
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Storybook
              </Button>
            </Link>
          </div>
        )}
      </div>

      <AlertDialog open={!!deletingBookId} onOpenChange={(open) => !open && setDeletingBookId(null)}>
        <AlertDialogContent data-testid="dialog-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle data-testid="dialog-title">Delete Storybook?</AlertDialogTitle>
            <AlertDialogDescription data-testid="dialog-description">
              This will permanently delete '{storybooks?.find(b => b.id === deletingBookId)?.title}' and all its images. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deleteMutation.isPending}
              data-testid="button-cancel-delete"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingBookId && deleteMutation.mutate(deletingBookId)}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
