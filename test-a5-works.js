const apiKey = process.env.PRODIGI_SANDBOX_API_KEY;
const testPdfUrl = 'https://81bbcc7c-a449-47fd-84cd-094938defafa-00-30zozi0nbl6hl.kirk.replit.dev/api/storage/2025/10/23/print-pdfs/7ec18e28-d2ac-4ce2-9451-608e3e39f702.pdf';

const orderRequest = {
  merchantReference: `TEST-A5-${Date.now()}`,
  shippingMethod: 'Standard',
  recipient: {
    name: "Test User",
    email: "test@example.com",
    phoneNumber: "1234567890",
    address: {
      line1: "123 Test St",
      postalOrZipCode: "90049",
      countryCode: "US",
      townOrCity: "Los Angeles",
      stateOrCounty: "CA"
    }
  },
  items: [{
    sku: 'BOOK-FE-A5-P-HARD-G',
    copies: 1,
    sizing: 'fillPrintArea',
    assets: [{
      printArea: 'default',
      url: testPdfUrl
    }]
  }]
};

fetch('https://api.sandbox.prodigi.com/v4.0/orders', {
  method: 'POST',
  headers: {
    'X-API-Key': apiKey,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(orderRequest)
})
.then(res => res.json())
.then(data => {
  if (data.order) {
    console.log(`✅ SUCCESS! A5 Portrait order created: ${data.order.id}`);
    console.log('A5 books with printArea:"default" WORK FINE');
  } else {
    console.log('❌ FAILED:', JSON.stringify(data, null, 2));
  }
})
.catch(err => console.error('Error:', err.message));
