import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import { AddPaymentMethodForm } from "./AddPaymentMethodForm";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

const stripePublicKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY || import.meta.env.TESTING_VITE_STRIPE_PUBLIC_KEY;
const stripePromise = loadStripe(stripePublicKey!);

interface AddPaymentMethodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AddPaymentMethodDialog({ open, onOpenChange, onSuccess }: AddPaymentMethodDialogProps) {
  const { toast } = useToast();
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  // Create SetupIntent when dialog opens
  const setupIntentMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/payment-methods/setup-intent');
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to initialize payment method setup');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setClientSecret(data.clientSecret);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to initialize",
        description: error.message,
        variant: "destructive",
      });
      onOpenChange(false);
    },
  });

  // Create SetupIntent when dialog opens
  useEffect(() => {
    if (open && !clientSecret) {
      setupIntentMutation.mutate();
    }
  }, [open]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setClientSecret(null);
    }
  }, [open]);

  const handleSuccess = () => {
    setClientSecret(null);
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Payment Method</DialogTitle>
        </DialogHeader>

        {setupIntentMutation.isPending || !clientSecret ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Initializing...</span>
          </div>
        ) : (
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <AddPaymentMethodForm
              clientSecret={clientSecret}
              onSuccess={handleSuccess}
              onCancel={() => onOpenChange(false)}
            />
          </Elements>
        )}
      </DialogContent>
    </Dialog>
  );
}
