import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Loader2, MapPin, CreditCard, Plus, Star } from "lucide-react";
import { AddressForm } from "@/components/account/AddressForm";
import { AddPaymentMethodDialog } from "@/components/account/AddPaymentMethodDialog";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";

interface ShippingAddress {
  id: string;
  fullName: string;
  phoneNumber?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

interface PaymentMethod {
  id: string;
  cardBrand: string;
  cardLast4: string;
  cardExpMonth: number;
  cardExpYear: number;
  isDefault: boolean;
}

interface NewCheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasPrintItems: boolean;
  amount: number;
  onSuccess: () => void;
}

function formatPrice(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function NewCheckoutDialog({ open, onOpenChange, hasPrintItems, amount, onSuccess }: NewCheckoutDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string>('');
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [showAddPaymentMethod, setShowAddPaymentMethod] = useState(false);

  // Fetch saved addresses
  const { data: addresses = [], isLoading: loadingAddresses } = useQuery<ShippingAddress[]>({
    queryKey: ['/api/shipping-addresses'],
    enabled: open && hasPrintItems,
  });

  // Fetch saved payment methods
  const { data: paymentMethods = [], isLoading: loadingPaymentMethods } = useQuery<PaymentMethod[]>({
    queryKey: ['/api/payment-methods'],
    enabled: open,
  });

  // Set default address when data loads
  useEffect(() => {
    if (hasPrintItems && addresses.length > 0 && !selectedAddressId) {
      const defaultAddress = addresses.find(a => a.isDefault) || addresses[0];
      if (defaultAddress) {
        setSelectedAddressId(defaultAddress.id);
      }
    }
  }, [addresses, hasPrintItems, selectedAddressId]);

  // Set default payment method when data loads
  useEffect(() => {
    if (paymentMethods.length > 0 && !selectedPaymentMethodId) {
      const defaultMethod = paymentMethods.find(m => m.isDefault) || paymentMethods[0];
      if (defaultMethod) {
        setSelectedPaymentMethodId(defaultMethod.id);
      }
    }
  }, [paymentMethods, selectedPaymentMethodId]);

  // Finalize purchase mutation
  const finalizeMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        paymentMethodId: selectedPaymentMethodId,
      };

      if (hasPrintItems) {
        if (!selectedAddressId) {
          throw new Error('Please select a shipping address');
        }
        
        // Find the selected address and send the full object
        const selectedAddress = addresses.find(a => a.id === selectedAddressId);
        if (!selectedAddress) {
          throw new Error('Selected address not found');
        }
        
        // Map saved address fields to cart shipping address format
        payload.shippingAddress = {
          name: selectedAddress.fullName,
          email: user?.email || '',
          phoneNumber: selectedAddress.phoneNumber || '',
          addressLine1: selectedAddress.addressLine1,
          addressLine2: selectedAddress.addressLine2 || '',
          city: selectedAddress.city,
          state: selectedAddress.stateProvince,
          postalCode: selectedAddress.postalCode,
          countryCode: selectedAddress.country,
        };
      }

      const response = await apiRequest('POST', '/api/cart/finalize', payload);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to complete purchase');
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/cart'] });
      queryClient.invalidateQueries({ queryKey: ['/api/purchases'] });
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      
      toast({
        title: "🎉 Order Created!",
        description: "Your order has been placed successfully. We'll charge your card once production is confirmed.",
        duration: 5000,
      });
      
      onSuccess();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to complete purchase",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!selectedPaymentMethodId) {
      toast({
        title: "Payment method required",
        description: "Please select or add a payment method",
        variant: "destructive",
      });
      return;
    }

    if (hasPrintItems && !selectedAddressId) {
      toast({
        title: "Shipping address required",
        description: "Please select or add a shipping address",
        variant: "destructive",
      });
      return;
    }

    finalizeMutation.mutate();
  };

  const isLoading = loadingAddresses || loadingPaymentMethods;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Complete Your Order</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Loading...</span>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Payment Method Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Payment Method
                </Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddPaymentMethod(true)}
                  data-testid="button-add-payment-checkout"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add New
                </Button>
              </div>

              {paymentMethods.length === 0 ? (
                <Card className="p-4 text-center text-sm text-muted-foreground">
                  No saved payment methods. Click "Add New" to add one.
                </Card>
              ) : (
                <RadioGroup value={selectedPaymentMethodId} onValueChange={setSelectedPaymentMethodId}>
                  <div className="space-y-2">
                    {paymentMethods.map((method) => (
                      <Card
                        key={method.id}
                        className={`p-4 cursor-pointer transition-colors ${
                          selectedPaymentMethodId === method.id ? 'border-primary bg-primary/5' : ''
                        }`}
                        onClick={() => setSelectedPaymentMethodId(method.id)}
                        data-testid={`card-payment-method-${method.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <RadioGroupItem value={method.id} id={`payment-${method.id}`} />
                          <Label htmlFor={`payment-${method.id}`} className="flex-1 cursor-pointer">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <CreditCard className="h-5 w-5 text-muted-foreground" />
                                <div>
                                  <p className="font-medium">
                                    {method.cardBrand.charAt(0).toUpperCase() + method.cardBrand.slice(1)} ••••{method.cardLast4}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Expires {method.cardExpMonth.toString().padStart(2, '0')}/{method.cardExpYear}
                                  </p>
                                </div>
                              </div>
                              {method.isDefault && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary text-xs">
                                  <Star className="h-3 w-3 fill-current" />
                                  Default
                                </span>
                              )}
                            </div>
                          </Label>
                        </div>
                      </Card>
                    ))}
                  </div>
                </RadioGroup>
              )}
            </div>

            {/* Shipping Address Selection (only for print items) */}
            {hasPrintItems && (
              <>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Shipping Address
                    </Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAddAddress(true)}
                      data-testid="button-add-address-checkout"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add New
                    </Button>
                  </div>

                  {showAddAddress ? (
                    <Card className="p-4 border-2 border-primary">
                      <h3 className="font-semibold mb-4">Add New Address</h3>
                      <AddressForm
                        onSuccess={() => {
                          setShowAddAddress(false);
                          queryClient.invalidateQueries({ queryKey: ['/api/shipping-addresses'] });
                        }}
                        onCancel={() => setShowAddAddress(false)}
                      />
                    </Card>
                  ) : addresses.length === 0 ? (
                    <Card className="p-4 text-center text-sm text-muted-foreground">
                      No saved addresses. Click "Add New" to add one.
                    </Card>
                  ) : (
                    <RadioGroup value={selectedAddressId} onValueChange={setSelectedAddressId}>
                      <div className="space-y-2">
                        {addresses.map((address) => (
                          <Card
                            key={address.id}
                            className={`p-4 cursor-pointer transition-colors ${
                              selectedAddressId === address.id ? 'border-primary bg-primary/5' : ''
                            }`}
                            onClick={() => setSelectedAddressId(address.id)}
                            data-testid={`card-address-${address.id}`}
                          >
                            <div className="flex items-start gap-3">
                              <RadioGroupItem value={address.id} id={`address-${address.id}`} className="mt-1" />
                              <Label htmlFor={`address-${address.id}`} className="flex-1 cursor-pointer">
                                <div className="flex items-start justify-between">
                                  <div className="space-y-1">
                                    <p className="font-medium">{address.fullName}</p>
                                    <div className="text-sm text-muted-foreground space-y-0.5">
                                      <p>{address.addressLine1}</p>
                                      {address.addressLine2 && <p>{address.addressLine2}</p>}
                                      <p>
                                        {address.city}, {address.stateProvince}, {address.postalCode}
                                      </p>
                                      <p>{address.country}</p>
                                    </div>
                                  </div>
                                  {address.isDefault && (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary text-xs">
                                      <Star className="h-3 w-3 fill-current" />
                                      Default
                                    </span>
                                  )}
                                </div>
                              </Label>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </RadioGroup>
                  )}
                </div>
              </>
            )}

            <Separator />

            {/* Order Summary */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Order Summary</Label>
              <Card className="p-4 bg-muted/50">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold">Total Amount</span>
                  <span className="text-2xl font-bold text-[hsl(258,90%,20%)] dark:text-[hsl(258,70%,70%)]">
                    ${formatPrice(amount)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Your card will be charged once your order is confirmed for production.
                </p>
              </Card>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={finalizeMutation.isPending}
                className="flex-1"
                data-testid="button-cancel-checkout"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={finalizeMutation.isPending || !selectedPaymentMethodId || (hasPrintItems && !selectedAddressId)}
                className="flex-1 gradient-bg !text-[hsl(258,90%,20%)]"
                data-testid="button-complete-order"
              >
                {finalizeMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating Order...
                  </>
                ) : (
                  'Complete Order'
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Add Payment Method Dialog */}
        <AddPaymentMethodDialog
          open={showAddPaymentMethod}
          onOpenChange={setShowAddPaymentMethod}
          onSuccess={() => {
            setShowAddPaymentMethod(false);
            queryClient.invalidateQueries({ queryKey: ['/api/payment-methods'] });
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
