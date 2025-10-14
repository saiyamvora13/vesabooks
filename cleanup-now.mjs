import { Storage } from "@google-cloud/storage";
import pkg from 'pg';
const { Client } = pkg;

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

const storage = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

// Get storybooks from database
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const result = await client.query('SELECT id, cover_image_url, back_cover_image_url, pages FROM storybooks');
const dbPngUrls = new Set();

for (const row of result.rows) {
  if (row.cover_image_url?.endsWith('.png')) {
    const filename = row.cover_image_url.split('/').pop();
    dbPngUrls.add(filename);
  }
  if (row.back_cover_image_url?.endsWith('.png')) {
    const filename = row.back_cover_image_url.split('/').pop();
    dbPngUrls.add(filename);
  }
  if (row.pages) {
    for (const page of row.pages) {
      if (page.imageUrl?.endsWith('.png')) {
        const filename = page.imageUrl.split('/').pop();
        dbPngUrls.add(filename);
      }
    }
  }
}

await client.end();

console.log('PNG filenames referenced in database:', Array.from(dbPngUrls));

// Get PNG files from storage
const searchPath = process.env.PUBLIC_OBJECT_SEARCH_PATHS.split(',')[0];
const bucketName = searchPath.split('/')[1];
const bucket = storage.bucket(bucketName);
const [files] = await bucket.getFiles();

const pngFiles = files.filter(f => f.name.endsWith('.png'));
console.log(`\nFound ${pngFiles.length} PNG files in storage`);

let deletedCount = 0;
let skippedCount = 0;
let sizeSaved = 0;

for (const file of pngFiles) {
  const filename = file.name.split('/').pop() || file.name;
  
  if (dbPngUrls.has(filename)) {
    console.log(`⊘ Skipping (in DB): ${file.name}`);
    skippedCount++;
    continue;
  }
  
  try {
    const [metadata] = await file.getMetadata();
    const size = typeof metadata.size === 'number' ? metadata.size : parseInt(metadata.size || '0');
    await file.delete();
    deletedCount++;
    sizeSaved += size;
    console.log(`✓ Deleted: ${file.name} (${(size / (1024 * 1024)).toFixed(2)} MB)`);
  } catch (error) {
    console.error(`✗ Error deleting ${file.name}:`, error.message);
  }
}

console.log(`\n=== CLEANUP COMPLETE ===`);
console.log(`PNG files deleted: ${deletedCount}`);
console.log(`PNG files skipped (in DB): ${skippedCount}`);
console.log(`Space saved: ${(sizeSaved / (1024 * 1024)).toFixed(2)} MB`);
