// Migration script to move images from filesystem to Object Storage
import { storage } from "../storage";
import { ObjectStorageService } from "../objectStorage";
import * as fs from "fs";
import * as path from "path";

async function migrateToObjectStorage() {
  console.log("Starting migration to Object Storage...");
  
  const objectStorage = new ObjectStorageService();
  const generatedDir = path.join(process.cwd(), "generated");
  
  // Get all storybooks
  const storybooks = await storage.getAllStorybooks();
  console.log(`Found ${storybooks.length} storybooks to migrate`);
  
  let migratedCount = 0;
  let skippedCount = 0;
  
  for (const storybook of storybooks) {
    console.log(`\nMigrating storybook: ${storybook.title} (${storybook.id})`);
    
    let needsUpdate = false;
    let newCoverImageUrl = storybook.coverImageUrl;
    const newPages = [...storybook.pages];
    
    // Migrate cover image if it's from filesystem
    if (storybook.coverImageUrl && storybook.coverImageUrl.startsWith('/api/images/')) {
      const coverFilename = storybook.coverImageUrl.replace('/api/images/', '');
      const coverPath = path.join(generatedDir, coverFilename);
      
      if (fs.existsSync(coverPath)) {
        console.log(`  Uploading cover image: ${coverFilename}`);
        newCoverImageUrl = await objectStorage.uploadFile(coverPath, coverFilename);
        needsUpdate = true;
      } else {
        console.log(`  Cover image not found on filesystem: ${coverPath}`);
      }
    }
    
    // Migrate page images
    for (let i = 0; i < storybook.pages.length; i++) {
      const page = storybook.pages[i];
      
      if (page.imageUrl.startsWith('/api/images/')) {
        const imageFilename = page.imageUrl.replace('/api/images/', '');
        const imagePath = path.join(generatedDir, imageFilename);
        
        if (fs.existsSync(imagePath)) {
          console.log(`  Uploading page ${page.pageNumber} image: ${imageFilename}`);
          const newImageUrl = await objectStorage.uploadFile(imagePath, imageFilename);
          newPages[i] = { ...page, imageUrl: newImageUrl };
          needsUpdate = true;
        } else {
          console.log(`  Page ${page.pageNumber} image not found on filesystem: ${imagePath}`);
        }
      }
    }
    
    // Update database if needed
    if (needsUpdate) {
      await storage.updateStorybookImages(storybook.id, newCoverImageUrl || '', newPages);
      console.log(`  ✓ Updated storybook in database`);
      migratedCount++;
    } else {
      console.log(`  - Already using Object Storage or images not found`);
      skippedCount++;
    }
  }
  
  console.log(`\nMigration complete!`);
  console.log(`  Migrated: ${migratedCount}`);
  console.log(`  Skipped: ${skippedCount}`);
}

// Run migration
migrateToObjectStorage().catch(console.error);
