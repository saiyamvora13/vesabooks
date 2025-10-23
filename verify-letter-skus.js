const apiKey = process.env.PRODIGI_SANDBOX_API_KEY;

async function checkSKU(sku) {
  console.log(`\n========== Checking SKU: ${sku} ==========`);
  
  try {
    const response = await fetch(`https://api.sandbox.prodigi.com/v4.0/products/${sku}`, {
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (response.ok && data.outcome === 'Ok') {
      console.log(`✅ SKU EXISTS`);
      console.log(`Description: ${data.product.description}`);
      console.log(`Print Areas:`, Object.keys(data.product.printAreas).length > 0 ? Object.keys(data.product.printAreas) : 'EMPTY {}');
      return true;
    } else {
      console.log(`❌ SKU NOT FOUND`);
      console.log(`Response:`, JSON.stringify(data, null, 2));
      return false;
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
    return false;
  }
}

async function searchLetterBooks() {
  console.log('\n========== Searching for Letter-size hardcover books ==========');
  
  try {
    const response = await fetch('https://api.sandbox.prodigi.com/v4.0/products', {
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (data.products) {
      const letterBooks = data.products.filter(p => 
        (p.sku.includes('LETTER') || p.description.toLowerCase().includes('letter') ||
         p.description.includes('8.5') || p.description.includes('11')) &&
        p.description.toLowerCase().includes('hard')
      );
      
      console.log(`\nFound ${letterBooks.length} Letter-size hardcover products:`);
      letterBooks.forEach(book => {
        console.log(`\n- SKU: ${book.sku}`);
        console.log(`  Description: ${book.description}`);
      });
    }
  } catch (error) {
    console.log(`Error searching: ${error.message}`);
  }
}

async function run() {
  await checkSKU('BOOK-FE-LETTER-P-HARD-G');
  await checkSKU('BOOK-FE-LETTER-L-HARD-G');
  await searchLetterBooks();
}

run().catch(console.error);
