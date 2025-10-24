import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { OrderNote, OrderStatusHistory } from "@shared/schema";
import { 
  ExternalLink, 
  Package, 
  User, 
  BookOpen, 
  DollarSign, 
  Clock, 
  FileText, 
  History,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Truck,
  Send,
  Download
} from "lucide-react";
import { Link } from "wouter";

interface OrderDetailsDialogProps {
  orderReference: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface OrderDetails {
  orderReference: string;
  createdAt: string;
  totalAmount: number;
  customer: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    createdAt: string;
    authProvider: string;
  };
  customerStats: {
    totalOrders: number;
    totalSpent: number;
  } | null;
  shippingAddress: {
    fullName: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    stateProvince: string;
    postalCode: string;
    country: string;
    phoneNumber?: string;
  } | null;
  paymentMethod: {
    cardBrand: string;
    cardLast4: string;
    cardExpMonth: number;
    cardExpYear: number;
  } | null;
  storybook: {
    id: string;
    title: string;
  };
  items: Array<{
    type: string;
    bookSize?: string;
    price: number;
    status: string;
  }>;
  printOrder?: {
    trackingNumber?: string;
    trackingUrl?: string;
    carrier?: string;
    status?: string;
  };
  notes: OrderNote[];
  history: OrderStatusHistory[];
}

export default function OrderDetailsDialog({ orderReference, open, onOpenChange }: OrderDetailsDialogProps) {
  const { toast } = useToast();
  const [showRefundDialog, setShowRefundDialog] = useState(false);
  const [noteType, setNoteType] = useState("general");
  const [noteContent, setNoteContent] = useState("");
  const [isInternal, setIsInternal] = useState(true);

  const { data: orderDetails, isLoading, error } = useQuery<OrderDetails>({
    queryKey: ["/api/admin/orders", orderReference],
    enabled: open && !!orderReference,
  });

  const addNoteMutation = useMutation({
    mutationFn: async (noteData: { noteType: string; content: string; isInternal: boolean }) => {
      const response = await apiRequest("POST", `/api/admin/orders/${orderReference}/notes`, noteData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Note Added",
        description: "The order note has been added successfully.",
      });
      setNoteContent("");
      setNoteType("general");
      setIsInternal(true);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orders", orderReference] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add note. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAddNote = () => {
    if (!noteContent.trim()) {
      toast({
        title: "Validation Error",
        description: "Note content is required.",
        variant: "destructive",
      });
      return;
    }

    addNoteMutation.mutate({
      noteType,
      content: noteContent,
      isInternal,
    });
  };

  const handleRefund = () => {
    setShowRefundDialog(false);
    toast({
      title: "Coming Soon",
      description: "Refund functionality coming soon.",
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { className: string; icon: any }> = {
      completed: { className: "bg-green-500/20 text-green-400 border-green-500/50", icon: CheckCircle2 },
      pending: { className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50", icon: Clock },
      failed: { className: "bg-red-500/20 text-red-400 border-red-500/50", icon: XCircle },
      refunded: { className: "bg-slate-500/20 text-slate-400 border-slate-500/50", icon: AlertCircle },
    };

    const variant = variants[status] || variants.pending;
    const Icon = variant.icon;

    return (
      <Badge className={variant.className}>
        <Icon className="w-3 h-3 mr-1" />
        {status}
      </Badge>
    );
  };

  const getTypeBadge = (type: string) => {
    const isDigital = type === "digital";
    return (
      <Badge className={isDigital ? "bg-blue-500/20 text-blue-400 border-blue-500/50" : "bg-purple-500/20 text-purple-400 border-purple-500/50"}>
        {isDigital ? "Digital" : "Print"}
      </Badge>
    );
  };

  const formatDate = (dateInput: string | Date | null) => {
    if (!dateInput) return 'N/A';
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] bg-slate-900 border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-slate-100">Loading Order Details...</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Skeleton className="h-32 w-full bg-slate-800" />
            <Skeleton className="h-32 w-full bg-slate-800" />
            <Skeleton className="h-32 w-full bg-slate-800" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (error || !orderDetails) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] bg-slate-900 border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-slate-100">Error</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-8 text-slate-400">
            <AlertCircle className="w-12 h-12 mb-4" />
            <p>Order not found or failed to load.</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const hasCompletedItems = orderDetails.items.some(item => item.status === 'completed');

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] bg-slate-900 border-slate-800 overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl text-slate-100">Order Details: {orderDetails.orderReference}</DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-6">
              {/* Order Information */}
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-lg text-slate-100 flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    Order Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Order Reference</p>
                      <p className="text-sm text-slate-200 font-mono">{orderDetails.orderReference}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Order Date</p>
                      <p className="text-sm text-slate-200">{formatDate(orderDetails.createdAt)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Total Amount</p>
                      <p className="text-lg font-semibold text-green-400">{formatCurrency(orderDetails.totalAmount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Status</p>
                      {orderDetails.items.map((item, idx) => (
                        <div key={idx} className="mb-1">
                          {getStatusBadge(item.status)}
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Downloads */}
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-lg text-slate-100 flex items-center gap-2">
                    <Download className="w-5 h-5" />
                    Downloads
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <a
                    href={`/api/storybooks/${orderDetails.storybook.id}/epub`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button
                      variant="outline"
                      className="w-full border-slate-700 text-slate-200 hover:bg-slate-700"
                      data-testid="button-download-epub"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download EPUB (E-book)
                      <ExternalLink className="w-4 h-4 ml-auto" />
                    </Button>
                  </a>
                  <a
                    href={`/api/storybooks/${orderDetails.storybook.id}/download-print-pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button
                      variant="outline"
                      className="w-full border-slate-700 text-slate-200 hover:bg-slate-700"
                      data-testid="button-download-print-pdf"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Print PDF
                      <ExternalLink className="w-4 h-4 ml-auto" />
                    </Button>
                  </a>
                </CardContent>
              </Card>

              {/* Customer Information */}
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-lg text-slate-100 flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Customer Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Name</p>
                      <p className="text-sm text-slate-200">{orderDetails.customer.firstName} {orderDetails.customer.lastName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Email</p>
                      <p className="text-sm text-slate-200">{orderDetails.customer.email}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Account Created</p>
                      <p className="text-sm text-slate-200">{formatDate(orderDetails.customer.createdAt)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Authentication</p>
                      <p className="text-sm text-slate-200">
                        {orderDetails.customer.authProvider.charAt(0).toUpperCase() + orderDetails.customer.authProvider.slice(1)}
                      </p>
                    </div>
                    {orderDetails.shippingAddress?.phoneNumber && (
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Phone Number</p>
                        <p className="text-sm text-slate-200">{orderDetails.shippingAddress.phoneNumber}</p>
                      </div>
                    )}
                  </div>

                  {orderDetails.customerStats && (
                    <>
                      <Separator className="bg-slate-700" />
                      <div>
                        <h4 className="text-sm font-semibold text-slate-300 mb-3">Customer Statistics</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Total Orders</p>
                            <p className="text-sm text-slate-200">{orderDetails.customerStats.totalOrders}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Total Spent</p>
                            <p className="text-sm text-green-400 font-semibold">
                              {formatCurrency(orderDetails.customerStats.totalSpent || 0)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {orderDetails.shippingAddress && (
                    <>
                      <Separator className="bg-slate-700" />
                      <div>
                        <h4 className="text-sm font-semibold text-slate-300 mb-3">Shipping Address</h4>
                        <div className="space-y-2">
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Full Name</p>
                            <p className="text-sm text-slate-200">{orderDetails.shippingAddress.fullName}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Address</p>
                            <p className="text-sm text-slate-200">{orderDetails.shippingAddress.addressLine1}</p>
                            {orderDetails.shippingAddress.addressLine2 && (
                              <p className="text-sm text-slate-200">{orderDetails.shippingAddress.addressLine2}</p>
                            )}
                            <p className="text-sm text-slate-200">
                              {orderDetails.shippingAddress.city}, {orderDetails.shippingAddress.stateProvince} {orderDetails.shippingAddress.postalCode}
                            </p>
                            <p className="text-sm text-slate-200">{orderDetails.shippingAddress.country}</p>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {orderDetails.paymentMethod && (
                    <>
                      <Separator className="bg-slate-700" />
                      <div>
                        <h4 className="text-sm font-semibold text-slate-300 mb-3">Payment Method</h4>
                        <div className="space-y-2">
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Card Brand</p>
                            <p className="text-sm text-slate-200">
                              {orderDetails.paymentMethod.cardBrand.charAt(0).toUpperCase() + orderDetails.paymentMethod.cardBrand.slice(1)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Card Number</p>
                            <p className="text-sm text-slate-200 font-mono">•••• {orderDetails.paymentMethod.cardLast4}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Expiry</p>
                            <p className="text-sm text-slate-200">
                              {String(orderDetails.paymentMethod.cardExpMonth).padStart(2, '0')}/{orderDetails.paymentMethod.cardExpYear}
                            </p>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  <Separator className="bg-slate-700" />
                  <Link href={`/orders?userId=${orderDetails.customer.id}`}>
                    <a className="inline-flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300">
                      View Customer's Order History
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </Link>
                </CardContent>
              </Card>

              {/* Storybook Details */}
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-lg text-slate-100 flex items-center gap-2">
                    <BookOpen className="w-5 h-5" />
                    Storybook Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Title</p>
                    <p className="text-sm text-slate-200">{orderDetails.storybook.title}</p>
                  </div>
                  <Link href={`/view/${orderDetails.storybook.id}`}>
                    <a className="inline-flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300" target="_blank">
                      View Storybook
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </Link>
                </CardContent>
              </Card>

              {/* Purchase Items */}
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-lg text-slate-100 flex items-center gap-2">
                    <DollarSign className="w-5 h-5" />
                    Purchase Items
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {orderDetails.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center p-3 bg-slate-900/50 rounded-lg">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            {getTypeBadge(item.type)}
                            {item.bookSize && (
                              <span className="text-xs text-slate-400">({item.bookSize})</span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500">Status: {item.status}</p>
                        </div>
                        <p className="text-sm font-semibold text-slate-200">{formatCurrency(item.price)}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Tracking Info (if print order) */}
              {orderDetails.printOrder && (
                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-lg text-slate-100 flex items-center gap-2">
                      <Truck className="w-5 h-5" />
                      Tracking Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {orderDetails.printOrder.carrier && (
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Carrier</p>
                        <p className="text-sm text-slate-200">{orderDetails.printOrder.carrier}</p>
                      </div>
                    )}
                    {orderDetails.printOrder.trackingNumber && (
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Tracking Number</p>
                        <p className="text-sm text-slate-200 font-mono">{orderDetails.printOrder.trackingNumber}</p>
                      </div>
                    )}
                    {orderDetails.printOrder.trackingUrl && (
                      <a 
                        href={orderDetails.printOrder.trackingUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300"
                      >
                        Track Shipment
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                    {orderDetails.printOrder.status && (
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Print Status</p>
                        <p className="text-sm text-slate-200">{orderDetails.printOrder.status}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Order Notes */}
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-lg text-slate-100 flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Order Notes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {orderDetails.notes.length > 0 ? (
                    <div className="space-y-3">
                      {orderDetails.notes.map((note) => (
                        <div key={note.id} className="p-3 bg-slate-900/50 rounded-lg border-l-4 border-purple-500">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {note.noteType}
                              </Badge>
                              {note.isInternal && (
                                <Badge variant="outline" className="text-xs bg-orange-500/20 text-orange-400 border-orange-500/50">
                                  Internal
                                </Badge>
                              )}
                            </div>
                            <span className="text-xs text-slate-500">{formatDate(note.createdAt)}</span>
                          </div>
                          <p className="text-sm text-slate-300 whitespace-pre-wrap">{note.content}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 text-center py-4">No notes yet</p>
                  )}
                </CardContent>
              </Card>

              {/* Status History Timeline */}
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-lg text-slate-100 flex items-center gap-2">
                    <History className="w-5 h-5" />
                    Status History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {orderDetails.history.length > 0 ? (
                    <div className="space-y-4">
                      {orderDetails.history.map((entry, idx) => (
                        <div key={entry.id} className="relative pl-6">
                          {idx !== orderDetails.history.length - 1 && (
                            <div className="absolute left-2 top-6 bottom-0 w-0.5 bg-slate-700" />
                          )}
                          <div className="absolute left-0 top-1 w-4 h-4 rounded-full bg-purple-500" />
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              {entry.previousStatus && (
                                <span className="text-sm text-slate-400">{entry.previousStatus}</span>
                              )}
                              {entry.previousStatus && <span className="text-slate-600">→</span>}
                              <span className="text-sm font-semibold text-slate-200">{entry.newStatus}</span>
                            </div>
                            <p className="text-xs text-slate-500">{formatDate(entry.createdAt)}</p>
                            {entry.changeReason && (
                              <p className="text-xs text-slate-400 italic">{entry.changeReason}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 text-center py-4">No history available</p>
                  )}
                </CardContent>
              </Card>

              {/* Add Note Form */}
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-lg text-slate-100">Add Note</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="noteType" className="text-slate-300">Note Type</Label>
                    <Select value={noteType} onValueChange={setNoteType}>
                      <SelectTrigger 
                        id="noteType"
                        className="bg-slate-900 border-slate-700 text-slate-200"
                        data-testid="select-note-type"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-700">
                        <SelectItem value="general">General</SelectItem>
                        <SelectItem value="customer_service">Customer Service</SelectItem>
                        <SelectItem value="refund">Refund</SelectItem>
                        <SelectItem value="technical">Technical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="noteContent" className="text-slate-300">Note Content</Label>
                    <Textarea
                      id="noteContent"
                      value={noteContent}
                      onChange={(e) => setNoteContent(e.target.value)}
                      placeholder="Enter note details..."
                      className="bg-slate-900 border-slate-700 text-slate-200 min-h-[100px]"
                      data-testid="textarea-note-content"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="isInternal" 
                      checked={isInternal} 
                      onCheckedChange={(checked) => setIsInternal(checked as boolean)}
                      data-testid="checkbox-internal-note"
                    />
                    <Label htmlFor="isInternal" className="text-slate-300 cursor-pointer">
                      Internal Note (not visible to customer)
                    </Label>
                  </div>

                  <Button
                    onClick={handleAddNote}
                    disabled={addNoteMutation.isPending || !noteContent.trim()}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                    data-testid="button-add-note"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {addNoteMutation.isPending ? "Adding Note..." : "Add Note"}
                  </Button>
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex gap-3">
                {hasCompletedItems && (
                  <Button
                    onClick={() => setShowRefundDialog(true)}
                    variant="outline"
                    className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                    data-testid="button-refund"
                  >
                    Process Refund
                  </Button>
                )}
                <Button
                  onClick={() => onOpenChange(false)}
                  variant="outline"
                  className="border-slate-700 text-slate-300 hover:bg-slate-800"
                  data-testid="button-close"
                >
                  Close
                </Button>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Refund Confirmation Dialog */}
      <AlertDialog open={showRefundDialog} onOpenChange={setShowRefundDialog}>
        <AlertDialogContent className="bg-slate-900 border-slate-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-100">Confirm Refund</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Are you sure you want to process a refund for order {orderDetails.orderReference}? 
              This action will refund {formatCurrency(orderDetails.totalAmount)} to the customer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRefund}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Process Refund
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
