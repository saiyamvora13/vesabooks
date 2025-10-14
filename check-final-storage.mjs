import { Storage } from "@google-cloud/storage";

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

const searchPath = process.env.PUBLIC_OBJECT_SEARCH_PATHS.split(',')[0];
const bucketName = searchPath.split('/')[1];

const bucket = storage.bucket(bucketName);
const [files] = await bucket.getFiles();

const pngFiles = [];
const jpgFiles = [];
let totalSize = 0;

for (const file of files) {
  const [metadata] = await file.getMetadata();
  const size = typeof metadata.size === 'number' ? metadata.size : parseInt(metadata.size || '0');
  totalSize += size;
  
  if (file.name.endsWith('.png')) {
    pngFiles.push({ name: file.name, size });
  } else if (file.name.endsWith('.jpg') || file.name.endsWith('.jpeg')) {
    jpgFiles.push({ name: file.name, size });
  }
}

const pngSize = pngFiles.reduce((sum, f) => sum + f.size, 0);

console.log('=== FINAL STORAGE STATE ===');
console.log(`Total Files: ${files.length}`);
console.log(`Total Size: ${(totalSize / (1024 * 1024)).toFixed(2)} MB`);
console.log(`PNG Files: ${pngFiles.length} (${(pngSize / (1024 * 1024)).toFixed(2)} MB)`);
console.log(`JPG Files: ${jpgFiles.length}`);

if (pngFiles.length > 0) {
  console.log('\nRemaining PNG files:');
  pngFiles.forEach(f => {
    console.log(`  - ${f.name} (${(f.size / (1024 * 1024)).toFixed(2)} MB)`);
  });
}

console.log(`\n✓ Cleaned up ${114 - pngSize / (1024 * 1024)} MB of PNG files`);
