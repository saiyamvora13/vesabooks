const apiKey = process.env.PRODIGI_SANDBOX_API_KEY;
const baseUrl = 'https://api.sandbox.prodigi.com/v4.0';
const testPdfUrl = 'https://81bbcc7c-a449-47fd-84cd-094938defafa-00-30zozi0nbl6hl.kirk.replit.dev/api/storage/2025/10/23/print-pdfs/7ec18e28-d2ac-4ce2-9451-608e3e39f702.pdf';

const recipient = {
  name: "Test User",
  email: "test@example.com",
  phoneNumber: "1234567890",
  address: {
    line1: "123 Test St",
    line2: "",
    postalOrZipCode: "90049",
    countryCode: "US",
    townOrCity: "Los Angeles",
    stateOrCounty: "CA"
  }
};

async function testOrder(testName, sku, assetConfig) {
  console.log(`\n========== TEST: ${testName} ==========`);
  console.log(`SKU: ${sku}`);
  console.log(`Asset config:`, JSON.stringify(assetConfig, null, 2));
  
  const orderRequest = {
    merchantReference: `TEST-${Date.now()}`,
    shippingMethod: 'Standard',
    recipient,
    items: [{
      sku,
      copies: 1,
      sizing: 'fillPrintArea',
      assets: [assetConfig]
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
      console.log(`✅ SUCCESS! Order created: ${data.order.id}`);
      return { success: true, orderId: data.order.id };
    } else {
      console.log(`❌ FAILED!`);
      console.log(`Status: ${response.status}`);
      console.log(`Error:`, JSON.stringify(data, null, 2));
      return { success: false, error: data };
    }
  } catch (error) {
    console.log(`❌ EXCEPTION:`, error.message);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  const results = [];
  
  // Test 1: Letter Portrait with printArea: "default"
  results.push(await testOrder(
    'Letter Portrait WITH printArea: "default"',
    'BOOK-FE-LETTER-P-HARD-G',
    { printArea: 'default', url: testPdfUrl }
  ));
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Test 2: Letter Portrait WITHOUT printArea
  results.push(await testOrder(
    'Letter Portrait WITHOUT printArea',
    'BOOK-FE-LETTER-P-HARD-G',
    { url: testPdfUrl }
  ));
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Test 3: Letter Landscape with printArea: "default"
  results.push(await testOrder(
    'Letter Landscape WITH printArea: "default"',
    'BOOK-FE-LETTER-L-HARD-G',
    { printArea: 'default', url: testPdfUrl }
  ));
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Test 4: Letter Landscape WITHOUT printArea
  results.push(await testOrder(
    'Letter Landscape WITHOUT printArea',
    'BOOK-FE-LETTER-L-HARD-G',
    { url: testPdfUrl }
  ));
  
  // Summary
  console.log('\n========== SUMMARY ==========');
  results.forEach((result, index) => {
    const testNames = [
      'Letter Portrait WITH printArea',
      'Letter Portrait WITHOUT printArea',
      'Letter Landscape WITH printArea',
      'Letter Landscape WITHOUT printArea'
    ];
    console.log(`${index + 1}. ${testNames[index]}: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`);
  });
}

runTests().catch(console.error);
