const apiKey = process.env.PRODIGI_SANDBOX_API_KEY;
const baseUrl = 'https://api.sandbox.prodigi.com/v4.0';
const testPdfUrl = 'https://81bbcc7c-a449-47fd-84cd-094938defafa-00-30zozi0nbl6hl.kirk.replit.dev/api/storage/2025/10/23/print-pdfs/7ec18e28-d2ac-4ce2-9451-608e3e39f702.pdf';

const recipient = {
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
};

async function testPrintArea(printAreaValue) {
  console.log(`\n========== Testing printArea: "${printAreaValue}" ==========`);
  
  const orderRequest = {
    merchantReference: `TEST-${Date.now()}`,
    shippingMethod: 'Standard',
    recipient,
    items: [{
      sku: 'BOOK-FE-LETTER-P-HARD-G',
      copies: 1,
      sizing: 'fillPrintArea',
      assets: [{
        printArea: printAreaValue,
        url: testPdfUrl
      }]
    }]
  };
  
  try {
    const response = await fetch(`${baseUrl}/orders`, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderRequest)
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log(`✅ SUCCESS! Order: ${data.order.id}`);
      return true;
    } else {
      console.log(`❌ FAILED - ${data.failures ? Object.keys(data.failures)[0] : data.outcome}`);
      if (data.failures && data.failures['items[0].assets']) {
        console.log('Error:', JSON.stringify(data.failures['items[0].assets'], null, 2));
      }
      return false;
    }
  } catch (error) {
    console.log(`❌ EXCEPTION: ${error.message}`);
    return false;
  }
}

async function runTests() {
  const printAreas = ['default', 'cover', 'pages', 'spine', 'front', 'back', 'interior', 'content', 'all'];
  
  for (const area of printAreas) {
    await testPrintArea(area);
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

runTests().catch(console.error);
