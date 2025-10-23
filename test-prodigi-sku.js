const apiKey = process.env.PRODIGI_SANDBOX_API_KEY;
const sku = 'BOOK-FE-LETTER-P-HARD-G';

fetch(`https://api.sandbox.prodigi.com/v4.0/products/${sku}`, {
  headers: {
    'X-API-Key': apiKey,
    'Content-Type': 'application/json'
  }
})
.then(res => res.json())
.then(data => {
  console.log('=== Product Details ===');
  console.log(JSON.stringify(data, null, 2));
  
  if (data.product && data.product.printAreas) {
    console.log('\n=== Print Areas ===');
    data.product.printAreas.forEach(area => {
      console.log(`- ${area}`);
    });
  }
})
.catch(err => console.error('Error:', err));
