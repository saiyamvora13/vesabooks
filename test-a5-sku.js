const apiKey = process.env.PRODIGI_SANDBOX_API_KEY;
const sku = 'BOOK-FE-A5-P-HARD-G';

fetch(`https://api.sandbox.prodigi.com/v4.0/products/${sku}`, {
  headers: {
    'X-API-Key': apiKey,
    'Content-Type': 'application/json'
  }
})
.then(res => res.json())
.then(data => {
  console.log('=== A5 Product Details ===');
  console.log('printAreas:', JSON.stringify(data.product.printAreas, null, 2));
  console.log('\nprintAreaSizes:', JSON.stringify(data.product.variants[0].printAreaSizes, null, 2));
})
.catch(err => console.error('Error:', err));
