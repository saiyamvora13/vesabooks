import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { SEO } from "@/components/SEO";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AddressManager } from "@/components/account/AddressManager";
import { PaymentMethodManager } from "@/components/account/PaymentMethodManager";
import { MapPin, CreditCard, User } from "lucide-react";

export default function Account() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect to login if not authenticated
  if (!isLoading && !user) {
    setLocation('/login');
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <SEO
        title="My Account | AI Storybook Builder"
        description="Manage your account settings, saved addresses, and payment methods"
      />
      
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex items-center gap-3 mb-8">
          <User className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">My Account</h1>
            <p className="text-muted-foreground mt-1">
              Manage your account settings and preferences
            </p>
          </div>
        </div>

        <Tabs defaultValue="addresses" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="addresses" className="flex items-center gap-2" data-testid="tab-addresses">
              <MapPin className="h-4 w-4" />
              Saved Addresses
            </TabsTrigger>
            <TabsTrigger value="payment-methods" className="flex items-center gap-2" data-testid="tab-payment-methods">
              <CreditCard className="h-4 w-4" />
              Payment Methods
            </TabsTrigger>
          </TabsList>

          <TabsContent value="addresses" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Saved Shipping Addresses</CardTitle>
                <CardDescription>
                  Manage your saved shipping addresses for faster checkout
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AddressManager />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payment-methods" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Saved Payment Methods</CardTitle>
                <CardDescription>
                  Manage your saved credit and debit cards for quick payments
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PaymentMethodManager />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
