import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Plus, CreditCard, Star, Trash2, Loader2 } from "lucide-react";
import { useState } from "react";
import { AddPaymentMethodDialog } from "./AddPaymentMethodDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface PaymentMethod {
  id: string;
  cardBrand: string;
  cardLast4: string;
  cardExpMonth: number;
  cardExpYear: number;
  isDefault: boolean;
}

export function PaymentMethodManager() {
  const { toast } = useToast();
  const [isAdding, setIsAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Fetch payment methods
  const { data: paymentMethods = [], isLoading } = useQuery<PaymentMethod[]>({
    queryKey: ['/api/payment-methods'],
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/payment-methods/${id}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete payment method');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/payment-methods'] });
      toast({
        title: "Payment method deleted",
        description: "The payment method has been removed from your account",
      });
      setDeletingId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete payment method",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Set default mutation
  const setDefaultMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('POST', `/api/payment-methods/${id}/set-default`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to set default payment method');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/payment-methods'] });
      toast({
        title: "Default payment method updated",
        description: "This card will be used for future orders",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to set default",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getCardIcon = (brand: string) => {
    // Return appropriate card icon based on brand
    return <CreditCard className="h-5 w-5" />;
  };

  const formatCardBrand = (brand: string) => {
    return brand.charAt(0).toUpperCase() + brand.slice(1);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8" data-testid="loading-payment-methods">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {paymentMethods.length === 0 ? (
        <div className="text-center py-8" data-testid="empty-payment-methods">
          <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-2">No saved payment methods</h3>
          <p className="text-muted-foreground mb-4">
            Add a credit or debit card for faster checkout
          </p>
          <Button onClick={() => setIsAdding(true)} data-testid="button-add-first-payment-method">
            <Plus className="h-4 w-4 mr-2" />
            Add Payment Method
          </Button>
        </div>
      ) : (
        <>
          <div className="flex justify-end mb-4">
            <Button onClick={() => setIsAdding(true)} size="sm" data-testid="button-add-payment-method">
              <Plus className="h-4 w-4 mr-2" />
              Add Payment Method
            </Button>
          </div>

          <div className="space-y-3">
            {paymentMethods.map((method) => (
              <Card key={method.id} className="p-4" data-testid={`payment-method-card-${method.id}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getCardIcon(method.cardBrand)}
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium" data-testid={`payment-method-brand-${method.id}`}>
                          {formatCardBrand(method.cardBrand)} ••••{method.cardLast4}
                        </p>
                        {method.isDefault && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium" data-testid={`payment-method-default-${method.id}`}>
                            <Star className="h-3 w-3 fill-current" />
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Expires {method.cardExpMonth.toString().padStart(2, '0')}/{method.cardExpYear}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {!method.isDefault && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDefaultMutation.mutate(method.id)}
                        disabled={setDefaultMutation.isPending}
                        data-testid={`button-set-default-payment-${method.id}`}
                      >
                        {setDefaultMutation.isPending && setDefaultMutation.variables === method.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Star className="h-4 w-4 mr-2" />
                            Set Default
                          </>
                        )}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeletingId(method.id)}
                      data-testid={`button-delete-payment-${method.id}`}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Add payment method dialog */}
      <AddPaymentMethodDialog
        open={isAdding}
        onOpenChange={setIsAdding}
        onSuccess={() => setIsAdding(false)}
      />

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payment Method</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this payment method? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-payment">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-payment"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
