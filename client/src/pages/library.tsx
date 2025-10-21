import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import Navigation from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Calendar, Plus, Trash2, ShoppingCart, Check, X, Download, Loader2, CreditCard, Bookmark, BookmarkX } from "lucide-react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { addToCart, isInCart, removeFromCart } from "@/lib/cartUtils";
import { SEO } from "@/components/SEO";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAllBookSizes, getBookSizesByOrientation } from "@shared/bookSizes";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// Validate Stripe public key exists
const stripePublicKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
const stripePromise = stripePublicKey ? loadStripe(stripePublicKey) : null;

// Form schema for book options
const bookOptionsSchema = z.object({
  bookSize: z.string().default('a5-portrait'),
  shippingMethod: z.enum(['Budget', 'Standard', 'Express', 'Overnight']).default('Standard'),
  destinationCountryCode: z.string().default('US'),
});

type BookOptionsFormValues = z.infer<typeof bookOptionsSchema>;

// Form schema for shipping address
const shippingAddressSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  phoneNumber: z.string().min(1, "Phone number is required"),
  line1: z.string().min(1, "Address line 1 is required"),
  line2: z.string().optional(),
  postalOrZipCode: z.string().min(1, "Postal/ZIP code is required"),
  townOrCity: z.string().min(1, "City is required"),
  stateOrCounty: z.string().optional(),
  countryCode: z.string().min(2, "Country is required"),
});

type ShippingAddressFormValues = z.infer<typeof shippingAddressSchema>;

interface Storybook {
  id: string;
  title: string;
  prompt: string;
  pages: Array<{ pageNumber: number; text: string; imageUrl: string }>;
  createdAt: string;
  shareUrl: string | null;
  orientation?: 'portrait' | 'landscape' | 'square';
  coverImageUrl?: string;
}

interface CheckoutPaymentFormProps {
  storybookId: string;
  title: string;
  price: number;
  type: 'digital' | 'print';
  onSuccess: (purchaseId?: string) => void;
  bookSize?: string;
}

function CheckoutPaymentForm({ storybookId, title, price, type, onSuccess, bookSize }: CheckoutPaymentFormProps) {
  const { t } = useTranslation();
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/library?success=true`,
        },
        redirect: 'if_required',
      });

      if (error) {
        setIsProcessing(false);
        toast({
          title: "Payment Failed",
          description: error.message || "An error occurred during payment.",
          variant: "destructive",
        });
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        try {
          const purchaseData: any = { 
            paymentIntentId: paymentIntent.id 
          };
          
          // Include book customization data for print purchases
          if (type === 'print') {
            purchaseData.bookSize = bookSize;
          }
          
          const response = await apiRequest('POST', '/api/purchases/create', purchaseData);

          if (!response.ok) {
            throw new Error('Failed to create purchases');
          }

          const result = await response.json();
          const purchaseId = result.purchases?.[0]?.id;

          toast({
            title: "Payment Successful",
            description: `You've successfully purchased ${title}!`,
          });

          onSuccess(purchaseId);
        } catch (purchaseError) {
          setIsProcessing(false);
          toast({
            title: "Processing Order",
            description: "Your payment was successful. Your purchase is being processed.",
          });
          onSuccess();
        }
      }
    } catch (error) {
      setIsProcessing(false);
      toast({
        title: "Payment Error",
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
        variant: "destructive",
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <PaymentElement />
      </div>

      <div className="flex items-center justify-between pt-4 border-t">
        <span className="text-lg font-semibold">Total</span>
        <span className="text-2xl font-bold gradient-text">
          ${(price / 100).toFixed(2)}
        </span>
      </div>

      <Button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full gradient-bg hover:opacity-90 !text-[hsl(258,90%,20%)] h-12"
        data-testid="button-submit-payment"
      >
        {isProcessing ? (
          <>
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <CreditCard className="h-5 w-5 mr-2" />
            Pay ${(price / 100).toFixed(2)}
          </>
        )}
      </Button>
    </form>
  );
}

interface CheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storybook: Storybook;
  type: 'digital' | 'print';
  price: number;
}

function CheckoutDialog({ open, onOpenChange, storybook, type, price }: CheckoutDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [clientSecret, setClientSecret] = useState<string>("");
  const [isCreatingPaymentIntent, setIsCreatingPaymentIntent] = useState(false);
  const [error, setError] = useState<string>("");
  const [purchaseId, setPurchaseId] = useState<string | null>(null);
  
  // Get orientation-appropriate book sizes
  const availableBookSizes = getBookSizesByOrientation(storybook.orientation as 'portrait' | 'landscape' | 'square' || 'portrait');
  const defaultBookSize = availableBookSizes.length > 0 ? availableBookSizes[0].id : 'a5-portrait';
  
  // Book options state
  const [bookSize, setBookSize] = useState<string>(defaultBookSize);
  const [shippingMethod, setShippingMethod] = useState<'Budget' | 'Standard' | 'Express' | 'Overnight'>('Standard');
  const [destinationCountryCode, setDestinationCountryCode] = useState<string>('US');
  const [quotedPrice, setQuotedPrice] = useState<number | null>(null);
  
  const bookOptionsForm = useForm<BookOptionsFormValues>({
    resolver: zodResolver(bookOptionsSchema),
    defaultValues: {
      bookSize: defaultBookSize,
      shippingMethod: 'Standard',
      destinationCountryCode: 'US',
    },
  });
  
  const shippingForm = useForm<ShippingAddressFormValues>({
    resolver: zodResolver(shippingAddressSchema),
    defaultValues: {
      name: '',
      email: '',
      phoneNumber: '',
      line1: '',
      line2: '',
      postalOrZipCode: '',
      townOrCity: '',
      stateOrCounty: '',
      countryCode: destinationCountryCode,
    },
  });

  // Watch form values to fetch quotes
  const watchedBookSize = bookOptionsForm.watch('bookSize');
  const watchedShippingMethod = bookOptionsForm.watch('shippingMethod');
  const watchedDestinationCountryCode = bookOptionsForm.watch('destinationCountryCode');

  // Fetch quote for print orders
  const { data: quoteData, isLoading: isLoadingQuote, error: quoteError } = useQuery({
    queryKey: ['/api/prodigi/quote', watchedBookSize, watchedShippingMethod, watchedDestinationCountryCode],
    queryFn: async () => {
      try {
        const response = await apiRequest('POST', '/api/prodigi/quote', {
          bookSize: watchedBookSize,
          shippingMethod: watchedShippingMethod,
          destinationCountryCode: watchedDestinationCountryCode,
        });
        if (!response.ok) {
          throw new Error('Failed to fetch quote');
        }
        return response.json();
      } catch (error) {
        console.error('[Quote Error]', error);
        throw error instanceof Error ? error : new Error('Quote fetch failed');
      }
    },
    enabled: open && type === 'print' && !!watchedBookSize && !!watchedShippingMethod && !!watchedDestinationCountryCode,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
    retryDelay: 1000,
  });

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      // For digital purchases, skip book options and go straight to payment
      if (type === 'digital') {
        setStep(2);
      } else {
        setStep(1);
      }
      setClientSecret("");
      setError("");
      setQuotedPrice(null);
      setPurchaseId(null);
      bookOptionsForm.reset({ 
        bookSize: defaultBookSize, 
        shippingMethod: 'Standard',
        destinationCountryCode: 'US',
      });
      shippingForm.reset({
        name: '',
        email: '',
        phoneNumber: '',
        line1: '',
        line2: '',
        postalOrZipCode: '',
        townOrCity: '',
        stateOrCounty: '',
        countryCode: destinationCountryCode,
      });
      setBookSize(defaultBookSize);
      setShippingMethod('Standard');
      setDestinationCountryCode('US');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, type]);

  // Create payment intent when moving to step 2
  useEffect(() => {
    if (!stripePublicKey) {
      setError("Stripe is not configured. Please contact support.");
      return;
    }

    if (open && step === 2 && !clientSecret) {
      // For print orders, ensure quote is loaded before creating payment intent
      if (type === 'print' && !quotedPrice) {
        console.warn('Attempted to create payment intent without quoted price');
        setError("Price quote is not available. Please go back and try again.");
        return;
      }

      setIsCreatingPaymentIntent(true);

      const createPaymentIntent = async () => {
        try {
          // For print purchases, use quoted price; for digital, use prop price
          const finalPrice = type === 'print' ? Math.round(quotedPrice! * 100) : price;
          
          // Build item with customization data for print purchases
          const item: any = { storybookId: storybook.id, type, price: finalPrice };
          if (type === 'print') {
            item.bookSize = bookSize;
            item.shippingMethod = shippingMethod;
            item.destinationCountryCode = destinationCountryCode;
          }
          
          const response = await apiRequest('POST', '/api/create-payment-intent', { 
            items: [item] 
          });
          
          if (!response.ok) {
            throw new Error('Failed to create payment intent');
          }
          
          const data = await response.json();
          
          if (!data.clientSecret) {
            throw new Error('No client secret received');
          }
          
          setClientSecret(data.clientSecret);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : "Failed to initialize checkout. Please try again.";
          setError(errorMsg);
          toast({
            title: "Error",
            description: errorMsg,
            variant: "destructive",
          });
        } finally {
          setIsCreatingPaymentIntent(false);
        }
      };
      
      createPaymentIntent();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step, storybook.id, type, quotedPrice, clientSecret, bookSize, shippingMethod, destinationCountryCode]);

  const handleBookOptionsSubmit = (values: BookOptionsFormValues) => {
    // Validate quote is available before proceeding
    if (!quoteData?.price?.amount) {
      toast({
        title: "Quote Not Available",
        description: "Please wait for the price to load before continuing.",
        variant: "destructive",
      });
      return;
    }
    
    // Set all values atomically
    const priceInDollars = parseFloat(quoteData.price.amount);
    setBookSize(values.bookSize);
    setShippingMethod(values.shippingMethod);
    setDestinationCountryCode(values.destinationCountryCode);
    setQuotedPrice(priceInDollars);
    
    // Only advance after quote is confirmed
    setStep(2);
  };

  const handleSuccess = (purchId?: string) => {
    queryClient.invalidateQueries({ queryKey: ['/api/purchases/check'] });
    
    // For print purchases, move to shipping address step
    if (type === 'print' && purchId) {
      setPurchaseId(purchId);
      setStep(3);
    } else {
      // For digital purchases, close dialog
      onOpenChange(false);
    }
  };
  
  // Mutation for submitting print order
  const submitPrintOrderMutation = useMutation({
    mutationFn: async (shippingDetails: ShippingAddressFormValues) => {
      if (!purchaseId) {
        throw new Error('Purchase ID is required');
      }
      
      const response = await apiRequest('POST', '/api/prodigi/submit-order', {
        purchaseId,
        recipientDetails: shippingDetails,
        shippingMethod,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to submit print order');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Print Order Submitted",
        description: "Your book is being sent to production. You'll receive tracking information via email.",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Order Submission Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const handleShippingSubmit = (values: ShippingAddressFormValues) => {
    submitPrintOrderMutation.mutate(values);
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setStep(1);
      setClientSecret("");
      setError("");
    }
    onOpenChange(isOpen);
  };

  const options = clientSecret ? {
    clientSecret,
    appearance: {
      theme: 'stripe' as const,
    },
  } : undefined;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === 1 ? (
              <>
                <BookOpen className="h-5 w-5" />
                Book Options
              </>
            ) : step === 2 ? (
              <>
                <CreditCard className="h-5 w-5" />
                Complete Purchase
              </>
            ) : (
              <>
                <BookOpen className="h-5 w-5" />
                Shipping Address
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {step === 1 ? (
              'Select your book size, shipping speed, and destination to get a price quote'
            ) : step === 2 ? (
              'Complete your payment to purchase the storybook'
            ) : (
              'Enter shipping details for your print order'
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Book Options Form - Step 1 (only for print) */}
        {step === 1 && type === 'print' && (
          <div className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="font-medium text-sm">{storybook.title}</p>
              <Badge variant="secondary" className="mt-2">Print Edition</Badge>
            </div>

            <Form {...bookOptionsForm}>
              <form onSubmit={bookOptionsForm.handleSubmit(handleBookOptionsSubmit)} className="space-y-4">
                <FormField
                  control={bookOptionsForm.control}
                  name="bookSize"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Book Size</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-book-size">
                            <SelectValue placeholder="Select book size" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {getBookSizesByOrientation((storybook.orientation || 'portrait') as 'portrait' | 'landscape' | 'square').map((size) => (
                            <SelectItem key={size.id} value={size.id} data-testid={`option-book-size-${size.id}`}>
                              {size.name} ({size.widthInches}" × {size.heightInches}")
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={bookOptionsForm.control}
                  name="destinationCountryCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ship to Country</FormLabel>
                      <Select 
                        onValueChange={(value) => {
                          try {
                            field.onChange(value);
                          } catch (err) {
                            console.error('[Select Error]', err);
                          }
                        }} 
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-destination-country">
                            <SelectValue placeholder="Select country" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="US" data-testid="option-country-us">United States</SelectItem>
                          <SelectItem value="CA" data-testid="option-country-ca">Canada</SelectItem>
                          <SelectItem value="GB" data-testid="option-country-gb">United Kingdom</SelectItem>
                          <SelectItem value="AU" data-testid="option-country-au">Australia</SelectItem>
                          <SelectItem value="DE" data-testid="option-country-de">Germany</SelectItem>
                          <SelectItem value="FR" data-testid="option-country-fr">France</SelectItem>
                          <SelectItem value="ES" data-testid="option-country-es">Spain</SelectItem>
                          <SelectItem value="IT" data-testid="option-country-it">Italy</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={bookOptionsForm.control}
                  name="shippingMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Shipping Speed</FormLabel>
                      <Select 
                        onValueChange={(value) => {
                          try {
                            field.onChange(value);
                          } catch (err) {
                            console.error('[Select Error]', err);
                          }
                        }} 
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-shipping-method">
                            <SelectValue placeholder="Select shipping method" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Budget" data-testid="option-shipping-budget">Budget (7-14 days)</SelectItem>
                          <SelectItem value="Standard" data-testid="option-shipping-standard">Standard (5-7 days)</SelectItem>
                          <SelectItem value="Express" data-testid="option-shipping-express">Express (2-3 days)</SelectItem>
                          <SelectItem value="Overnight" data-testid="option-shipping-overnight">Overnight</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Display quoted price */}
                {isLoadingQuote ? (
                  <div className="flex items-center justify-center p-4 bg-muted/50 rounded-lg">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    <span className="text-sm text-muted-foreground">Calculating price...</span>
                  </div>
                ) : quoteData?.price ? (
                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
                    <span className="font-medium">Total Price</span>
                    <span className="text-2xl font-bold gradient-text" data-testid="text-quoted-price">
                      ${quoteData.price.amount}
                    </span>
                  </div>
                ) : null}

                <Button
                  type="submit"
                  disabled={isLoadingQuote || !quoteData?.price}
                  className="w-full gradient-bg hover:opacity-90 !text-[hsl(258,90%,20%)]"
                  data-testid="button-continue-to-payment"
                >
                  {isLoadingQuote ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Continue to Payment'
                  )}
                </Button>
              </form>
            </Form>
          </div>
        )}

        {/* Payment Form - Step 2 */}
        {step === 2 && (
          <>
            {error ? (
              <div className="flex flex-col items-center justify-center py-8">
                <X className="h-12 w-12 text-destructive mb-4" />
                <p className="text-sm text-destructive text-center">{error}</p>
                <Button 
                  variant="outline" 
                  onClick={() => handleClose(false)} 
                  className="mt-4"
                  data-testid="button-close-error"
                >
                  Close
                </Button>
              </div>
            ) : isCreatingPaymentIntent || !clientSecret ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                <p className="text-sm text-muted-foreground">Preparing checkout...</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="font-medium text-sm">{storybook.title}</p>
                  <Badge variant={type === 'digital' ? 'default' : 'secondary'} className="mt-2">
                    {type === 'digital' ? 'E-book' : 'Print Edition'}
                  </Badge>
                  {type === 'print' && (
                    <div className="mt-2 space-y-1">
                      {bookSize && (
                        <p className="text-xs text-muted-foreground">
                          Size: {getAllBookSizes().find(s => s.id === bookSize)?.name}
                        </p>
                      )}
                      {shippingMethod && (
                        <p className="text-xs text-muted-foreground">
                          Shipping: {shippingMethod}
                        </p>
                      )}
                      {destinationCountryCode && (
                        <p className="text-xs text-muted-foreground">
                          Destination: {destinationCountryCode}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {stripePromise && options ? (
                  <Elements stripe={stripePromise} options={options}>
                    <CheckoutPaymentForm 
                      storybookId={storybook.id}
                      title={storybook.title}
                      price={type === 'print' && quotedPrice ? Math.round(quotedPrice * 100) : price}
                      type={type}
                      onSuccess={handleSuccess}
                      bookSize={type === 'print' ? bookSize : undefined}
                    />
                  </Elements>
                ) : (
                  <div className="flex flex-col items-center justify-center py-4">
                    <p className="text-sm text-destructive">Unable to load payment system</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Shipping Address Form - Step 3 (only for print after payment) */}
        {step === 3 && type === 'print' && (
          <div className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="font-medium text-sm">{storybook.title}</p>
              <Badge variant="secondary" className="mt-2">Print Edition</Badge>
              <p className="text-xs text-muted-foreground mt-2">Payment completed! Now we need your shipping address.</p>
            </div>

            <Form {...shippingForm}>
              <form onSubmit={shippingForm.handleSubmit(handleShippingSubmit)} className="space-y-4">
                <FormField
                  control={shippingForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="John Doe" data-testid="input-recipient-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={shippingForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" placeholder="john@example.com" data-testid="input-recipient-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={shippingForm.control}
                  name="phoneNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="+1234567890" data-testid="input-recipient-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={shippingForm.control}
                  name="line1"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address Line 1</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="123 Main St" data-testid="input-address-line1" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={shippingForm.control}
                  name="line2"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address Line 2 (Optional)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Apt 4B" data-testid="input-address-line2" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={shippingForm.control}
                    name="townOrCity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="New York" data-testid="input-city" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={shippingForm.control}
                    name="stateOrCounty"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State/County</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="NY" data-testid="input-state" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={shippingForm.control}
                    name="postalOrZipCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ZIP/Postal Code</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="10001" data-testid="input-postal-code" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={shippingForm.control}
                    name="countryCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Country</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-country">
                              <SelectValue placeholder="Select country" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="US">United States</SelectItem>
                            <SelectItem value="CA">Canada</SelectItem>
                            <SelectItem value="GB">United Kingdom</SelectItem>
                            <SelectItem value="AU">Australia</SelectItem>
                            <SelectItem value="DE">Germany</SelectItem>
                            <SelectItem value="FR">France</SelectItem>
                            <SelectItem value="ES">Spain</SelectItem>
                            <SelectItem value="IT">Italy</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full gradient-bg hover:opacity-90 !text-[hsl(258,90%,20%)]"
                  disabled={submitPrintOrderMutation.isPending}
                  data-testid="button-submit-shipping"
                >
                  {submitPrintOrderMutation.isPending ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Submitting Order...
                    </>
                  ) : (
                    'Submit Print Order'
                  )}
                </Button>
              </form>
            </Form>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface DownloadCustomizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storybook: Storybook;
}

function DownloadCustomizationDialog({ open, onOpenChange, storybook }: DownloadCustomizationDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const bookSizes = getBookSizesByOrientation(storybook.orientation as 'portrait' | 'landscape' | 'square' || 'portrait');
  const defaultBookSize = bookSizes.length > 0 ? bookSizes[0].id : 'a5-portrait';
  
  const form = useForm<BookOptionsFormValues>({
    resolver: zodResolver(bookOptionsSchema),
    defaultValues: {
      bookSize: defaultBookSize,
    },
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      form.reset({
        bookSize: defaultBookSize,
      });
    }
  }, [open, form, defaultBookSize]);

  const handleDownload = (values: BookOptionsFormValues) => {
    const params = new URLSearchParams();
    params.append('bookSize', values.bookSize);
    
    window.open(`/api/storybooks/${storybook.id}/download-print-pdf?${params.toString()}`);
    
    toast({
      title: "Download Started",
      description: "Your print-ready PDF is being prepared for download.",
    });
    
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Print PDF Options
          </DialogTitle>
          <DialogDescription>
            Select your preferred book size for the print-ready PDF download
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted/50 p-4 rounded-lg">
            <p className="font-medium text-sm">{storybook.title}</p>
            <Badge variant="secondary" className="mt-2">Print Edition</Badge>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleDownload)} className="space-y-4">
              <FormField
                control={form.control}
                name="bookSize"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Book Size</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-book-size">
                          <SelectValue placeholder="Select book size" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {bookSizes.map((size) => (
                          <SelectItem key={size.id} value={size.id}>
                            {size.name} ({size.widthInches}" × {size.heightInches}")
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="flex-1"
                  data-testid="button-cancel-download"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 gradient-bg hover:opacity-90 !text-[hsl(258,90%,20%)]"
                  data-testid="button-confirm-download"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StorybookPurchaseButtons({ storybook }: { storybook: Storybook }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [cartUpdated, setCartUpdated] = useState(0);
  const [checkoutDialog, setCheckoutDialog] = useState<{ open: boolean; type?: 'digital' | 'print' }>({ open: false });
  const [downloadDialog, setDownloadDialog] = useState(false);

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

  // Fetch pricing settings from public endpoint
  const { data: pricingSettings } = useQuery<{ digital_price: string; print_price: string }>({
    queryKey: ['/api/settings/pricing'],
  });

  // Get prices from settings with fallback defaults
  const digitalPrice = pricingSettings?.digital_price 
    ? parseInt(pricingSettings.digital_price) 
    : 399;
  const printPrice = pricingSettings?.print_price 
    ? parseInt(pricingSettings.print_price) 
    : 2499;

  const handleAddToCart = (type: 'digital' | 'print') => {
    // Apply discount if user owns digital and is buying print
    let price = type === 'digital' ? digitalPrice : printPrice;
    if (type === 'print' && digitalPurchase?.owned) {
      price = Math.max(0, printPrice - digitalPrice);
    }
    
    addToCart({
      storybookId: storybook.id,
      type,
      title: storybook.title,
      price,
    });
    toast({
      title: t('storybook.library.purchase.addedToCart.title'),
      description: t('storybook.library.purchase.addedToCart.description', { 
        title: storybook.title, 
        type: type === 'digital' ? 'Digital' : 'Print' 
      }),
    });
    window.dispatchEvent(new Event('cartUpdated'));
    setCartUpdated(prev => prev + 1);
  };

  const handleRemoveFromCart = (type: 'digital' | 'print') => {
    removeFromCart(storybook.id, type);
    toast({
      title: t('storybook.library.purchase.removedFromCart.title'),
      description: t('storybook.library.purchase.removedFromCart.description', { 
        title: storybook.title, 
        type: type === 'digital' ? 'Digital' : 'Print' 
      }),
    });
    window.dispatchEvent(new Event('cartUpdated'));
    setCartUpdated(prev => prev + 1);
  };

  const inCartDigital = isInCart(storybook.id, 'digital');
  const inCartPrint = isInCart(storybook.id, 'print');

  // Calculate price with potential discount
  // Only apply digital discount for first-time print purchases, not repurchases
  let printPurchasePrice = printPrice;
  if (digitalPurchase?.owned && !printPurchase?.owned) {
    printPurchasePrice = Math.max(0, printPrice - digitalPrice);
  }

  return (
    <>
      <div className="space-y-2 mt-3">
        {digitalPurchase?.owned ? (
          <>
            <Badge variant="secondary" className="w-full justify-center py-1">
              <Check className="h-3 w-3 mr-1" />
              {t('storybook.library.purchase.digitalPurchased')}
            </Badge>
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => setDownloadDialog(true)}
              data-testid={`button-download-print-pdf-${storybook.id}`}
            >
              <Download className="h-4 w-4 mr-1" />
              Download Print PDF
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="default"
            className="w-full gradient-bg hover:opacity-90 !text-[hsl(258,90%,20%)]"
            onClick={() => setCheckoutDialog({ open: true, type: 'digital' })}
            data-testid={`button-buy-digital-${storybook.id}`}
          >
            <ShoppingCart className="h-4 w-4 mr-1" />
            {t('storybook.library.purchase.buyEbook')}
          </Button>
        )}

        <Button
          size="sm"
          variant="outline"
          className="w-full h-auto py-2"
          onClick={() => setCheckoutDialog({ open: true, type: 'print' })}
          data-testid={`button-buy-print-${storybook.id}`}
        >
          <div className="flex flex-col items-center gap-0.5">
            <div className="flex items-center gap-1.5">
              <ShoppingCart className="h-4 w-4" />
              {printPurchase?.owned ? (
                <span className="flex items-center gap-1">
                  <span>Buy Again</span>
                  <span className="font-semibold">${(printPrice / 100).toFixed(2)}</span>
                </span>
              ) : digitalPurchase?.owned ? (
                <span className="flex items-center gap-1">
                  <span>Buy Print</span>
                  <span className="line-through text-muted-foreground">(${(printPrice / 100).toFixed(2)})</span>
                  <span>-</span>
                  <span className="font-semibold">${(printPurchasePrice / 100).toFixed(2)}</span>
                </span>
              ) : (
                <span>{t('storybook.library.purchase.buyPrint')}</span>
              )}
            </div>
            {printPurchase?.owned ? (
              <span className="text-xs text-muted-foreground">Order another copy</span>
            ) : digitalPurchase?.owned ? (
              <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                {t('purchases.upgrade.savings', { amount: (digitalPrice / 100).toFixed(2) })}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">{t('storybook.library.purchase.freeEbookIncluded')}</span>
            )}
          </div>
        </Button>
      </div>

      {checkoutDialog.open && checkoutDialog.type && (
        <CheckoutDialog
          open={checkoutDialog.open}
          onOpenChange={(open) => setCheckoutDialog({ open, type: checkoutDialog.type })}
          storybook={storybook}
          type={checkoutDialog.type}
          price={checkoutDialog.type === 'digital' ? digitalPrice : printPurchasePrice}
        />
      )}
      
      <DownloadCustomizationDialog
        open={downloadDialog}
        onOpenChange={setDownloadDialog}
        storybook={storybook}
      />
    </>
  );
}

export default function Library() {
  const { t } = useTranslation();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [deletingBookId, setDeletingBookId] = useState<string | null>(null);

  const { data: ownedStorybooks, isLoading: ownedLoading, error: ownedError } = useQuery<Storybook[]>({
    queryKey: ["/api/storybooks"],
    enabled: isAuthenticated,
  });

  const { data: savedStorybooks, isLoading: savedLoading } = useQuery<Storybook[]>({
    queryKey: ["/api/storybooks/saved"],
    enabled: isAuthenticated,
  });

  // Combine owned and saved storybooks for count
  const storybooks = ownedStorybooks || [];
  const saved = savedStorybooks || [];
  const totalCount = storybooks.length + saved.length;
  const isLoading = ownedLoading || savedLoading;
  const error = ownedError;

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/storybooks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/storybooks"] });
      toast({
        title: t('storybook.library.delete.toast.success.title'),
        description: t('storybook.library.delete.toast.success.description'),
      });
      setDeletingBookId(null);
    },
    onError: (error: Error) => {
      toast({
        title: t('storybook.library.delete.toast.error.title'),
        description: error.message || t('storybook.library.delete.toast.error.description'),
        variant: "destructive",
      });
    },
  });

  const unsaveMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/storybooks/${id}/save`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/storybooks/saved"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gallery"] });
      toast({
        title: "Removed from Library",
        description: "Storybook has been removed from your library",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove storybook",
        variant: "destructive",
      });
    },
  });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <SEO 
          title="My Library - AI Storybook Builder"
          description="Access your collection of personalized AI-generated children's storybooks. View, share, and download your stories."
          path="/library"
        />
        <Navigation />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-muted-foreground">{t('common.states.loading')}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        <SEO 
          title="My Library - AI Storybook Builder"
          description="Access your collection of personalized AI-generated children's storybooks. View, share, and download your stories."
          path="/library"
        />
        <Navigation />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center py-20">
            <BookOpen className="mx-auto h-16 w-16 text-muted-foreground mb-6" />
            <h2 className="text-3xl font-bold mb-4">{t('storybook.library.pleaseLogin.title')}</h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              {t('storybook.library.pleaseLogin.description')}
            </p>
            <Button onClick={() => window.location.href = '/api/login'} data-testid="button-login">
              {t('storybook.library.pleaseLogin.button')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title="My Library - AI Storybook Builder"
        description="Access your collection of personalized AI-generated children's storybooks. View, share, and download your stories."
        path="/library"
      />
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-6 sm:py-8 lg:py-12">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold font-display gradient-text mb-2" data-testid="text-library-title">
              {t('storybook.library.title')}
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground" data-testid="text-storybook-count">
              {t('storybook.library.count', { count: totalCount })}
            </p>
          </div>
          
          <Link href="/create">
            <Button className="gradient-bg hover:opacity-90 !text-[hsl(258,90%,20%)] w-full sm:w-auto" data-testid="button-create-new">
              <Plus className="mr-2 h-4 w-4" />
              {t('storybook.library.createNew')}
            </Button>
          </Link>
        </div>

        {error ? (
          <div className="text-center py-20">
            <BookOpen className="mx-auto h-16 w-16 text-destructive mb-6" />
            <h2 className="text-2xl font-semibold mb-4" data-testid="text-error-title">
              {t('storybook.library.error.title')}
            </h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto" data-testid="text-error-message">
              {error instanceof Error ? error.message : t('storybook.library.error.description')}
            </p>
            <Button onClick={() => window.location.reload()} variant="outline" data-testid="button-retry">
              {t('common.buttons.tryAgain')}
            </Button>
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
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
        ) : (storybooks && storybooks.length > 0) || (saved && saved.length > 0) ? (
          <div className="space-y-12">
            {/* Owned Storybooks Section */}
            {storybooks && storybooks.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold mb-6" data-testid="text-owned-section">
                  My Storybooks ({storybooks.length})
                </h2>
                <div className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {storybooks.map((storybook) => (
                    <Card 
                      key={storybook.id} 
                      className="overflow-hidden hover:shadow-lg transition-all duration-300 active:scale-[0.98] cursor-pointer group touch-manipulation"
                      data-testid={`card-storybook-${storybook.id}`}
                    >
                      <Link href={`/view/${storybook.id}`}>
                        <div className="relative aspect-[3/4] bg-gradient-to-br from-primary/20 to-secondary/20 overflow-hidden">
                          {storybook.coverImageUrl ? (
                            <img 
                              src={storybook.coverImageUrl} 
                              alt={`Cover image for ${storybook.title}`}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              data-testid={`img-cover-${storybook.id}`}
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <BookOpen className="h-16 w-16 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                      </Link>
                      
                      <CardHeader className="p-3 sm:p-6">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="line-clamp-2 text-base sm:text-lg flex-1" data-testid={`text-title-${storybook.id}`}>
                            {storybook.title}
                          </CardTitle>
                          {storybook.orientation && (
                            <Badge variant="outline" className="text-xs shrink-0" data-testid={`badge-orientation-${storybook.id}`}>
                              {storybook.orientation === 'portrait' ? '📱 Portrait' : storybook.orientation === 'landscape' ? '🖼️ Landscape' : '⬛ Square'}
                            </Badge>
                          )}
                        </div>
                        <CardDescription className="line-clamp-2 text-sm" data-testid={`text-prompt-${storybook.id}`}>
                          {storybook.prompt}
                        </CardDescription>
                      </CardHeader>
                      
                      <CardContent className="px-3 sm:px-6 pb-3">
                        <div className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
                          <Calendar className="h-4 w-4" />
                          <span data-testid={`text-date-${storybook.id}`}>
                            {formatDistanceToNow(new Date(storybook.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                        <StorybookPurchaseButtons storybook={storybook} />
                      </CardContent>
                      
                      <CardFooter className="flex items-center justify-between gap-2 px-3 sm:px-6 pt-3 pb-3 sm:pb-6">
                        <Link href={`/view/${storybook.id}`} className="flex-1">
                          <Button variant="outline" size="default" className="w-full h-10 sm:h-9" data-testid={`button-view-${storybook.id}`}>
                            {t('common.buttons.view')}
                          </Button>
                        </Link>
                        <Button
                          variant="destructive"
                          size="default"
                          className="h-10 sm:h-9 px-3"
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
              </div>
            )}

            {/* Saved Storybooks Section */}
            {saved && saved.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-2" data-testid="text-saved-section">
                  <Bookmark className="h-6 w-6" />
                  Saved from Gallery ({saved.length})
                </h2>
                <div className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {saved.map((storybook) => (
                    <Card 
                      key={storybook.id} 
                      className="overflow-hidden hover:shadow-lg transition-all duration-300 active:scale-[0.98] cursor-pointer group touch-manipulation border-primary/30"
                      data-testid={`card-saved-${storybook.id}`}
                    >
                      <Link href={`/view/${storybook.id}`}>
                        <div className="relative aspect-[3/4] bg-gradient-to-br from-primary/20 to-secondary/20 overflow-hidden">
                          {storybook.coverImageUrl ? (
                            <img 
                              src={storybook.coverImageUrl} 
                              alt={`Cover image for ${storybook.title}`}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              data-testid={`img-cover-${storybook.id}`}
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <BookOpen className="h-16 w-16 text-muted-foreground" />
                            </div>
                          )}
                          {/* Bookmark indicator */}
                          <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-2 shadow-lg">
                            <Bookmark className="h-4 w-4 fill-current" />
                          </div>
                        </div>
                      </Link>
                      
                      <CardHeader className="p-3 sm:p-6">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="line-clamp-2 text-base sm:text-lg flex-1" data-testid={`text-title-${storybook.id}`}>
                            {storybook.title}
                          </CardTitle>
                          {storybook.orientation && (
                            <Badge variant="outline" className="text-xs shrink-0" data-testid={`badge-orientation-${storybook.id}`}>
                              {storybook.orientation === 'portrait' ? '📱 Portrait' : storybook.orientation === 'landscape' ? '🖼️ Landscape' : '⬛ Square'}
                            </Badge>
                          )}
                        </div>
                        <CardDescription className="line-clamp-2 text-sm" data-testid={`text-prompt-${storybook.id}`}>
                          {storybook.prompt}
                        </CardDescription>
                      </CardHeader>
                      
                      <CardContent className="px-3 sm:px-6 pb-3">
                        <div className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
                          <Calendar className="h-4 w-4" />
                          <span data-testid={`text-date-${storybook.id}`}>
                            {formatDistanceToNow(new Date(storybook.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                        <StorybookPurchaseButtons storybook={storybook} />
                      </CardContent>
                      
                      <CardFooter className="flex items-center justify-between gap-2 px-3 sm:px-6 pt-3 pb-3 sm:pb-6">
                        <Link href={`/view/${storybook.id}`} className="flex-1">
                          <Button variant="outline" size="default" className="w-full h-10 sm:h-9" data-testid={`button-view-${storybook.id}`}>
                            {t('common.buttons.view')}
                          </Button>
                        </Link>
                        <Button
                          variant="outline"
                          size="default"
                          className="h-10 sm:h-9 px-3"
                          onClick={(e) => {
                            e.preventDefault();
                            unsaveMutation.mutate(storybook.id);
                          }}
                          disabled={unsaveMutation.isPending}
                          data-testid={`button-unsave-${storybook.id}`}
                        >
                          <BookmarkX className="h-4 w-4" />
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-20">
            <BookOpen className="mx-auto h-16 w-16 text-muted-foreground mb-6" />
            <h2 className="text-2xl font-semibold mb-4" data-testid="text-empty-state">
              {t('storybook.library.empty.title')}
            </h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              {t('storybook.library.empty.description')}
            </p>
            <Link href="/create">
              <Button className="gradient-bg hover:opacity-90 !text-[hsl(258,90%,20%)]" data-testid="button-create-first">
                <Plus className="mr-2 h-4 w-4" />
                {t('storybook.library.createFirst')}
              </Button>
            </Link>
          </div>
        )}
      </div>

      <AlertDialog open={!!deletingBookId} onOpenChange={(open) => !open && setDeletingBookId(null)}>
        <AlertDialogContent data-testid="dialog-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle data-testid="dialog-title">{t('storybook.library.delete.title')}</AlertDialogTitle>
            <AlertDialogDescription data-testid="dialog-description">
              {t('storybook.library.delete.description', { title: storybooks?.find(b => b.id === deletingBookId)?.title })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deleteMutation.isPending}
              data-testid="button-cancel-delete"
            >
              {t('common.buttons.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingBookId && deleteMutation.mutate(deletingBookId)}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? t('storybook.library.delete.confirmButtonLoading') : t('storybook.library.delete.confirmButton')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
