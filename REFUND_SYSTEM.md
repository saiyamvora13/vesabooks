# Refund System Documentation

## Overview
The refund system automatically processes Stripe refunds and updates purchase records when refunds are issued through the Stripe Dashboard. It handles both full and partial refunds, supports batch orders with multiple purchases, and sends email notifications to customers.

## Features

### ✅ Implemented
- **Automatic Refund Processing**: Stripe webhook handlers automatically update purchase status when refunds are issued
- **Full & Partial Refund Support**: Tracks both complete and partial refunds with appropriate status badges
- **Batch Order Handling**: Proportionally distributes refunds across multiple purchases in a single payment
- **Idempotency Protection**: Prevents duplicate processing of the same refund event
- **Email Notifications**: Sends refund confirmation emails to customers (one per purchase, not per partial refund)
- **Admin Dashboard**: Filter and view refunded orders in the admin panel
- **Customer Dashboard**: Display refund status and amounts in "My Orders" page

### Database Schema
```typescript
purchases {
  status: 'completed' | 'pending' | 'refunded' | 'partially_refunded' | 'failed'
  refundAmount: string          // Cumulative refund amount in cents
  refundedAt: timestamp          // Date of first refund
  refundReason: string           // Reason provided by Stripe
  stripeRefundId: string         // ID of the refund event (for idempotency)
}
```

## How It Works

### Webhook Flow

1. **Admin Issues Refund in Stripe Dashboard**
   - Full refund: Refunds entire payment
   - Partial refund: Refunds specified amount

2. **Stripe Sends Webhook Events**
   - `charge.refunded`: Primary event containing refund details
   - `refund.created`: Alternative event with refund-specific data
   - `refund.failed`: Notification if refund fails

3. **System Processes Refund**
   ```
   ┌─────────────────────────────────────────────┐
   │ 1. Check idempotency (skip if already done) │
   └─────────────────┬───────────────────────────┘
                     │
   ┌─────────────────▼───────────────────────────┐
   │ 2. Get all purchases for PaymentIntent      │
   └─────────────────┬───────────────────────────┘
                     │
   ┌─────────────────▼───────────────────────────┐
   │ 3. Calculate proportional refund per item   │
   │    - Single purchase: full refund amount    │
   │    - Multiple: distribute proportionally    │
   └─────────────────┬───────────────────────────┘
                     │
   ┌─────────────────▼───────────────────────────┐
   │ 4. Add to existing refund (cumulative)      │
   └─────────────────┬───────────────────────────┘
                     │
   ┌─────────────────▼───────────────────────────┐
   │ 5. Validate & cap at purchase price         │
   └─────────────────┬───────────────────────────┘
                     │
   ┌─────────────────▼───────────────────────────┐
   │ 6. Update status (refunded/partial)         │
   └─────────────────┬───────────────────────────┘
                     │
   ┌─────────────────▼───────────────────────────┐
   │ 7. Send email (first refund only)           │
   └─────────────────────────────────────────────┘
   ```

### Proportional Refund Calculation

For batch orders with multiple items:
```typescript
// Example: $50 payment for 2 books ($30 + $20)
// Admin refunds $25

Book 1: $25 × ($30 / $50) = $15 refund
Book 2: $25 × ($20 / $50) = $10 refund
```

## Supported Scenarios

### ✅ Fully Supported

1. **Single Purchase Full Refund**
   - Purchase: $39.99 digital book
   - Refund: $39.99
   - Result: Status = `refunded`, email sent

2. **Single Purchase Partial Refund**
   - Purchase: $39.99 digital book
   - Refund: $20.00
   - Result: Status = `partially_refunded`, email sent

3. **Batch Order Full Refund**
   - Purchases: 3 books @ $39.99 each = $119.97
   - Refund: $119.97
   - Result: All 3 marked `refunded`, 3 emails sent

4. **Batch Order Partial Refund (Proportional)**
   - Purchases: Book A ($30) + Book B ($20) = $50
   - Refund: $25
   - Result: Book A gets $15 refund, Book B gets $10 refund, both `partially_refunded`

5. **Multiple Sequential Refunds**
   - Purchase: $50
   - First refund: $20 → `partially_refunded`, email sent
   - Second refund: $30 → `refunded`, no email (already notified)

6. **Duplicate Webhook Events**
   - Same refund event received twice
   - Result: Second event skipped (idempotency check)

## Known Limitations & Edge Cases

### ⚠️ Known Limitations

1. **Print Orders Cannot Be Refunded Automatically**
   - **Issue**: Print orders go through Prodigi and have complex fulfillment states
   - **Impact**: Refunding a print order in Stripe won't automatically cancel Prodigi production
   - **Workaround**: Manual intervention required:
     1. Cancel Prodigi order first (if not yet shipped)
     2. Then issue Stripe refund
     3. System will track the refund, but production status remains separate

2. **One Email Per Purchase**
   - **Behavior**: Email sent only on first refund
   - **Impact**: Customers won't receive notification for subsequent partial refunds
   - **Reason**: Prevents email spam for multiple small refunds
   - **Workaround**: Customers can check "My Orders" page for updated refund amounts

3. **Rounding in Proportional Refunds**
   - **Issue**: Refund amounts are rounded to nearest cent
   - **Impact**: Total distributed may differ by 1-2 cents from actual refund
   - **Example**: $10.00 split 3 ways = $3.33 + $3.33 + $3.34
   - **Acceptable**: Within Stripe's tolerance

4. **Status Display for Pending Refunds**
   - **Behavior**: Refunds pending in Stripe show as `pending` status
   - **Impact**: Customer sees "Processing" instead of "Refunded" until Stripe confirms
   - **Timeline**: Usually resolves within minutes

### 🔍 Edge Cases

1. **Refund > Purchase Price**
   - **Protection**: System caps refund at purchase price
   - **Log Warning**: "Refund amount exceeds purchase price - capping"

2. **Multiple Purchases, Single Refund < Total**
   - **Scenario**: Order with 3 books, partial refund doesn't indicate which book
   - **Behavior**: All books marked `partially_refunded` proportionally
   - **Admin Note**: Check Stripe Dashboard for actual distribution intent

3. **Webhook Race Conditions**
   - **Protection**: `stripeRefundId` ensures only one event processes per refund
   - **Scenario**: `charge.refunded` and `refund.created` arrive simultaneously
   - **Result**: First one processes, second skipped

4. **Very Old Purchases (Pre-Refund System)**
   - **Issue**: Purchases created before refund fields were added
   - **Impact**: `refundAmount` will be NULL/empty
   - **Handling**: System treats as 0 and calculates correctly

## Testing Refunds

### Test Mode (Stripe Dashboard)

1. **Create Test Purchase**
   ```bash
   # Use test card: 4242 4242 4242 4242
   # Make a purchase through the app
   ```

2. **Issue Test Refund**
   - Go to Stripe Dashboard (test mode)
   - Find the payment intent
   - Click "Refund payment"
   - Choose amount (full or partial)
   - Submit

3. **Verify Webhook**
   ```bash
   # Check server logs
   [Stripe Webhook] Received charge.refunded event...
   [Stripe Webhook] Updated purchase XXX: status=refunded, refund=3999/3999 cents
   [Stripe Webhook] Sent refund confirmation email to user@example.com
   ```

4. **Check Results**
   - Customer: "My Orders" page shows refund badge
   - Admin: Admin Orders page shows refund status
   - Email: Customer receives refund confirmation

### Manual Webhook Testing

```bash
# Install Stripe CLI
stripe listen --forward-to localhost:5000/api/webhook/stripe

# Trigger test refund event
stripe trigger charge.refunded
```

## Monitoring & Troubleshooting

### Key Log Patterns

**Success:**
```
[Stripe Webhook] Received charge.refunded event evt_xxx for payment intent: pi_xxx
[Stripe Webhook] Updated purchase abc123: status=refunded, refund=3999/3999 cents
[Stripe Webhook] Sent refund confirmation email to user@example.com
```

**Idempotency Skip:**
```
[Stripe Webhook] Refund re_xxx already processed - skipping duplicate event
```

**Validation Warning:**
```
[Email] Refund amount 5000 exceeds purchase price 3999 - capping at purchase price
```

### Common Issues

1. **No Purchases Found**
   ```
   [Stripe Webhook] No purchases found for payment intent pi_xxx
   ```
   - **Cause**: PaymentIntent doesn't match any purchase
   - **Check**: Verify purchase was created with correct `stripePaymentIntentId`

2. **Email Failed**
   ```
   [Stripe Webhook] Failed to send email for purchase xxx: Error
   ```
   - **Impact**: Refund processed but customer not notified
   - **Action**: Check Resend API status, manually notify customer

3. **Webhook Not Received**
   - **Check**: Stripe webhook configuration
   - **Verify**: Webhook URL is correct
   - **Test**: Use Stripe CLI to replay event

## Admin Operations

### How to Issue a Refund

1. **Navigate to Stripe Dashboard**
   - Use test mode for testing
   - Use live mode for production

2. **Find the Payment**
   - Search by order reference (ORDER-XXXXXXXX)
   - Or search by customer email

3. **Issue Refund**
   - Click "Refund payment"
   - Select amount:
     - Full refund: Entire payment
     - Partial refund: Enter specific amount
   - Choose reason (optional):
     - Customer request
     - Duplicate charge
     - Fraudulent
   - Submit refund

4. **Verify in Admin Dashboard**
   - Go to Admin → Orders
   - Filter by status: "Refunded" or "Partially Refunded"
   - Confirm purchase shows correct refund amount

### Bulk Refunds

For refunding multiple orders:

1. **Use Stripe Dashboard Bulk Actions**
   - Select multiple payments
   - Choose "Refund selected"

2. **Webhook Handles Automatically**
   - Each refund triggers separate webhook
   - All purchases updated independently
   - All customers notified via email

## Security Considerations

### Webhook Verification
- ✅ Stripe signature verification enabled
- ✅ Webhook secret validated on all events
- ✅ Invalid signatures rejected with 400 error

### Idempotency
- ✅ Duplicate events ignored based on `stripeRefundId`
- ✅ Race condition protection for simultaneous events
- ✅ Event ID logged for audit trail

### Amount Validation
- ✅ Refund amounts capped at purchase price
- ✅ Negative refunds rejected by Stripe (upstream)
- ✅ Currency validation (USD only)

## Future Enhancements

### Potential Improvements

1. **Multi-Currency Support**
   - Current: USD only
   - Enhancement: Support EUR, GBP, etc.

2. **Partial Refund Notifications**
   - Current: One email per purchase
   - Enhancement: Optional emails for each partial refund

3. **Refund Reasons in UI**
   - Current: Admin sees reason in logs
   - Enhancement: Display refund reason in admin dashboard

4. **Automated Partial Refunds**
   - Current: Manual via Stripe Dashboard
   - Enhancement: "Issue Partial Refund" button in admin

5. **Print Order Integration**
   - Current: Manual Prodigi cancellation required
   - Enhancement: Auto-cancel Prodigi when refunding print orders

## Related Files

- `server/routes.ts`: Webhook handlers (lines 4458-4636)
- `server/storage.ts`: Database operations
- `server/services/resend-email.ts`: Email templates (sendRefundConfirmationEmail)
- `shared/schema.ts`: Database schema
- `client/src/pages/orders.tsx`: Customer-facing refund display
- `client/src/pages/admin/orders.tsx`: Admin refund management

## Support

For issues or questions about the refund system:
1. Check server logs for webhook processing
2. Verify Stripe Dashboard shows correct refund status
3. Check database directly: `SELECT * FROM purchases WHERE status LIKE '%refund%'`
4. Review this documentation for known limitations
