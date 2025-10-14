async function runMigration() {
  const baseUrl = 'http://localhost:5000';
  
  console.log('🔐 Logging in as admin...');
  
  // Login as admin
  const loginResponse = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: 'admin@storybook.com',
      password: 'admin123'
    }),
  });

  if (!loginResponse.ok) {
    console.error('❌ Login failed:', loginResponse.status);
    const error = await loginResponse.text();
    console.error(error);
    return;
  }

  // Get all cookies from the response
  const setCookieHeader = loginResponse.headers.get('set-cookie');
  if (!setCookieHeader) {
    console.error('❌ No session cookie received');
    return;
  }

  // Extract the session cookie (handle multiple cookies)
  const cookies = setCookieHeader.split(',').map(c => c.split(';')[0]).join('; ');
  console.log('✅ Logged in successfully');
  console.log('   Session cookie:', cookies.substring(0, 50) + '...');

  console.log('\n🔄 Running image migration...');
  
  // Call migration endpoint with session cookie
  const migrationResponse = await fetch(`${baseUrl}/api/admin/migrate-images`, {
    method: 'POST',
    headers: {
      'Cookie': cookies,
      'Content-Type': 'application/json',
    },
  });

  if (!migrationResponse.ok) {
    console.error('❌ Migration failed:', migrationResponse.status);
    const error = await migrationResponse.text();
    console.error(error);
    return;
  }

  const result = await migrationResponse.json();
  
  console.log('✅ Migration completed successfully!\n');
  console.log('📊 Results:');
  console.log(`   Total storybooks processed: ${result.results.length}`);
  console.log(`   Total images migrated: ${result.totalImages}`);
  console.log();
  
  result.results.forEach((book: any) => {
    if (book.failed) {
      console.log(`❌ ${book.title} (FAILED)`);
      console.log(`   Reason: ${book.failureReason}`);
    } else {
      console.log(`✅ ${book.title} (${book.count} images)`);
      book.migratedImages.forEach((img: string) => {
        console.log(`   - ${img}`);
      });
    }
    console.log();
  });
}

runMigration().catch(console.error);
