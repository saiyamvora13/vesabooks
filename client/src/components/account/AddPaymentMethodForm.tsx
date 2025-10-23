import { useState } from "react";
import { useStripe, useElements, PaymentElement } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface AddPaymentMethodFormProps {
  clientSecret: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function AddPaymentMethodForm({ clientSecret, onSuccess, onCancel }: AddPaymentMethodFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [saveForFuture, setSaveForFuture] = useState(true);

  // Save payment method mutation
  const saveMutation = useMutation({
    mutationFn: async (setupIntentId: string) => {
      const response = await apiRequest('POST', '/api/payment-methods', {
        setupIntentId,
        saveForFuture,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save payment method');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/payment-methods'] });
      toast({
        title: "Payment method added",
        description: "Your payment method has been saved successfully",
      });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to save payment method",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    try {
      // Confirm SetupIntent without charging
      const { error, setupIntent } = await stripe.confirmSetup({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/account`,
        },
        redirect: 'if_required',
      });

      if (error) {
        toast({
          title: "Failed to add payment method",
          description: error.message,
          variant: "destructive",
        });
      } else if (setupIntent && setupIntent.status === 'succeeded') {
        // Save the payment method to backend if user wants to save it
        if (saveForFuture) {
          await saveMutation.mutateAsync(setupIntent.id);
        } else {
          toast({
            title: "Payment method confirmed",
            description: "Payment method setup completed successfully",
          });
          onSuccess();
        }
      }
    } catch (error: any) {
      toast({
        title: "Failed to add payment method",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />

      <div className="flex items-center space-x-2">
        <Checkbox
          id="save-for-future"
          checked={saveForFuture}
          onCheckedChange={(checked) => setSaveForFuture(checked === true)}
          data-testid="checkbox-save-payment-method"
        />
        <Label htmlFor="save-for-future" className="text-sm cursor-pointer">
          Save this payment method for future purchases
        </Label>
      </div>

      <div className="flex gap-3 pt-4">
        <Button
          type="submit"
          disabled={!stripe || isProcessing || saveMutation.isPending}
          className="flex-1"
          data-testid="button-save-payment-method"
        >
          {isProcessing || saveMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {isProcessing ? 'Processing...' : 'Saving...'}
            </>
          ) : (
            'Add Payment Method'
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isProcessing || saveMutation.isPending}
          data-testid="button-cancel-payment-method"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
