import { storage } from '../storage';
import type { PrintOrder } from '@shared/schema';
import Stripe from 'stripe';
import { sendOrderCancelledEmail } from './resend-email';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-09-30.clover',
});

interface StuckOrderResult {
  checked: number;
  cancelled: number;
  refunded: number;
  emailsSent: number;
  errors: string[];
}

/**
 * Checks for print orders stuck in processing (downloadAssets not started after 1 hour)
 * and automatically cancels them, refunds the customer, and sends notification email.
 */
export async function checkAndCancelStuckOrders(): Promise<StuckOrderResult> {
  const result: StuckOrderResult = {
    checked: 0,
    cancelled: 0,
    refunded: 0,
    emailsSent: 0,
    errors: [],
  };

  try {
    console.log('[Stuck Orders] Starting hourly check...');

    // Get all print orders from the last 7 days
    const allPrintOrders = await storage.getAllPrintOrders(1000);
    result.checked = allPrintOrders.length;

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // Filter for stuck orders
    const stuckOrders = allPrintOrders.filter((order) => {
      // Skip if already cancelled or completed
      if (order.status === 'Cancelled' || order.status === 'Complete') {
        return false;
      }

      // Must be older than 1 hour
      if (!order.createdAt || new Date(order.createdAt) > oneHourAgo) {
        return false;
      }

      // Check if downloadAssets is still NotStarted
      if (order.webhookData) {
        const webhookData = order.webhookData as any;
        const downloadStatus = webhookData?.status?.details?.downloadAssets;
        
        // If downloadAssets hasn't started, this is a stuck order
        if (downloadStatus === 'NotStarted') {
          return true;
        }
      } else {
        // If no webhook data at all after 1 hour, also stuck
        return true;
      }

      return false;
    });

    console.log(`[Stuck Orders] Found ${stuckOrders.length} stuck orders to cancel`);

    // Process each stuck order
    for (const printOrder of stuckOrders) {
      try {
        await processSingleStuckOrder(printOrder, result);
      } catch (error) {
        const errorMsg = `Failed to process stuck order ${printOrder.id}: ${error}`;
        console.error(`[Stuck Orders] ${errorMsg}`);
        result.errors.push(errorMsg);
      }
    }

    console.log('[Stuck Orders] Check completed:', result);
    return result;
  } catch (error) {
    console.error('[Stuck Orders] Fatal error during check:', error);
    result.errors.push(`Fatal error: ${error}`);
    return result;
  }
}

/**
 * Process a single stuck order: cancel, refund, and email
 */
async function processSingleStuckOrder(
  printOrder: PrintOrder,
  result: StuckOrderResult
): Promise<void> {
  console.log(`[Stuck Orders] Processing stuck order ${printOrder.id}`);

  // Get order details
  const orderDetails = await storage.getPrintOrderWithDetails(printOrder.id);
  
  if (!orderDetails) {
    throw new Error('Could not find order details');
  }

  const { purchase, storybook, user } = orderDetails;

  // 1. Cancel the order in our database
  await storage.updatePrintOrder(printOrder.id, {
    status: 'Cancelled',
    errorMessage: 'Order cancelled - Prodigi could not download print files. PDF URLs may have expired.',
  });
  result.cancelled++;
  console.log(`[Stuck Orders] Cancelled order ${printOrder.id} in database`);

  // 2. Attempt Stripe refund
  if (purchase.stripePaymentIntentId) {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(purchase.stripePaymentIntentId);
      
      if (paymentIntent.status === 'succeeded' && paymentIntent.amount_received > 0) {
        // Create refund
        const refund = await stripe.refunds.create({
          payment_intent: purchase.stripePaymentIntentId,
          reason: 'requested_by_customer',
          metadata: {
            print_order_id: printOrder.id,
            purchase_id: purchase.id,
            reason: 'stuck_order_auto_cancelled',
          },
        });

        console.log(`[Stuck Orders] Created Stripe refund ${refund.id} for ${purchase.stripePaymentIntentId}`);
        result.refunded++;

        // Update purchase status
        await storage.updatePurchaseStatus(purchase.id, 'refunded');
      } else {
        console.log(`[Stuck Orders] Payment intent ${purchase.stripePaymentIntentId} not in refundable state: ${paymentIntent.status}`);
      }
    } catch (stripeError) {
      const errorMsg = `Stripe refund failed for ${purchase.stripePaymentIntentId}: ${stripeError}`;
      console.error(`[Stuck Orders] ${errorMsg}`);
      result.errors.push(errorMsg);
    }
  }

  // 3. Send email notification
  try {
    const userName = user.firstName && user.lastName 
      ? `${user.firstName} ${user.lastName}`
      : user.firstName || user.lastName || 'Valued Customer';
    
    await sendOrderCancelledEmail(
      user.email || 'unknown@email.com',
      userName,
      storybook.title,
      printOrder.id,
      purchase.stripePaymentIntentId || 'N/A'
    );
    result.emailsSent++;
    console.log(`[Stuck Orders] Sent cancellation email to ${user.email}`);
  } catch (emailError) {
    const errorMsg = `Email failed for ${user.email}: ${emailError}`;
    console.error(`[Stuck Orders] ${errorMsg}`);
    result.errors.push(errorMsg);
  }
}
