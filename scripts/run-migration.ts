import fetch from 'node-fetch';

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
      password: 'admin123' // Default password - update if different
    }),
  });

  if (!loginResponse.ok) {
    console.error('❌ Login failed:', loginResponse.status);
    const error = await loginResponse.text();
    console.error(error);
    return;
  }

  // Get session cookie
  const cookies = loginResponse.headers.get('set-cookie');
  console.log('✅ Logged in successfully');

  console.log('\n🔄 Running image migration...');
  
  // Call migration endpoint
  const migrationResponse = await fetch(`${baseUrl}/api/admin/migrate-images`, {
    method: 'POST',
    headers: {
      'Cookie': cookies || '',
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
