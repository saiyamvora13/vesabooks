const apiKey = process.env.PRODIGI_SANDBOX_API_KEY;

Promise.all([
  fetch('https://api.sandbox.prodigi.com/v4.0/products/BOOK-FE-LETTER-P-HARD-G', {
    headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' }
  }).then(res => res.json()),
  fetch('https://api.sandbox.prodigi.com/v4.0/products/BOOK-FE-LETTER-L-HARD-G', {
    headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' }
  }).then(res => res.json())
])
.then(([portrait, landscape]) => {
  console.log('=== LETTER PORTRAIT ===');
  console.log('printAreas:', JSON.stringify(portrait.product.printAreas, null, 2));
  console.log('\n=== LETTER LANDSCAPE ===');
  console.log('printAreas:', JSON.stringify(landscape.product.printAreas, null, 2));
})
.catch(err => console.error('Error:', err));
