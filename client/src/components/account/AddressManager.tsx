import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Plus, MapPin, Star, Edit, Trash2, Loader2 } from "lucide-react";
import { useState } from "react";
import { AddressForm } from "./AddressForm";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

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

export function AddressManager() {
  const { toast } = useToast();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Fetch addresses
  const { data: addresses = [], isLoading } = useQuery<ShippingAddress[]>({
    queryKey: ['/api/shipping-addresses'],
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/shipping-addresses/${id}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete address');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/shipping-addresses'] });
      toast({
        title: "Address deleted",
        description: "The address has been removed from your account",
      });
      setDeletingId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete address",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Set default mutation
  const setDefaultMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('POST', `/api/shipping-addresses/${id}/set-default`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to set default address');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/shipping-addresses'] });
      toast({
        title: "Default address updated",
        description: "This address will be used for future orders",
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8" data-testid="loading-addresses">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {addresses.length === 0 && !isAdding ? (
        <div className="text-center py-8" data-testid="empty-addresses">
          <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-2">No saved addresses</h3>
          <p className="text-muted-foreground mb-4">
            Add a shipping address for faster checkout
          </p>
          <Button onClick={() => setIsAdding(true)} data-testid="button-add-first-address">
            <Plus className="h-4 w-4 mr-2" />
            Add Address
          </Button>
        </div>
      ) : (
        <>
          <div className="flex justify-end mb-4">
            {!isAdding && (
              <Button onClick={() => setIsAdding(true)} size="sm" data-testid="button-add-address">
                <Plus className="h-4 w-4 mr-2" />
                Add Address
              </Button>
            )}
          </div>

          {isAdding && (
            <Card className="p-4 border-2 border-primary">
              <h3 className="font-semibold mb-4">Add New Address</h3>
              <AddressForm
                onSuccess={() => setIsAdding(false)}
                onCancel={() => setIsAdding(false)}
              />
            </Card>
          )}

          <div className="space-y-3">
            {addresses.map((address) => (
              editingId === address.id ? (
                <Card key={address.id} className="p-4 border-2 border-primary">
                  <h3 className="font-semibold mb-4">Edit Address</h3>
                  <AddressForm
                    address={address}
                    onSuccess={() => setEditingId(null)}
                    onCancel={() => setEditingId(null)}
                  />
                </Card>
              ) : (
                <Card key={address.id} className="p-4" data-testid={`address-card-${address.id}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold" data-testid={`address-name-${address.id}`}>
                          {address.fullName}
                        </h4>
                        {address.isDefault && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium" data-testid={`address-default-${address.id}`}>
                            <Star className="h-3 w-3 fill-current" />
                            Default
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>{address.addressLine1}</p>
                        {address.addressLine2 && <p>{address.addressLine2}</p>}
                        <p>
                          {address.city}, {address.stateProvince}, {address.postalCode}
                        </p>
                        <p>{address.country}</p>
                        {address.phoneNumber && <p className="mt-2">{address.phoneNumber}</p>}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 ml-4">
                      {!address.isDefault && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDefaultMutation.mutate(address.id)}
                          disabled={setDefaultMutation.isPending}
                          data-testid={`button-set-default-${address.id}`}
                        >
                          {setDefaultMutation.isPending && setDefaultMutation.variables === address.id ? (
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
                        onClick={() => setEditingId(address.id)}
                        data-testid={`button-edit-${address.id}`}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeletingId(address.id)}
                        data-testid={`button-delete-${address.id}`}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </Card>
              )
            ))}
          </div>
        </>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Address</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this address? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
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
