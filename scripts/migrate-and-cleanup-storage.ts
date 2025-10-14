// Script to migrate PNG images to JPG and cleanup orphaned files
import { ObjectStorageService } from "../server/objectStorage";
import { storage } from "../server/storage";
import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";

async function optimizeImageForWeb(imageBuffer: Buffer): Promise<Buffer> {
  return sharp(imageBuffer)
    .resize(1200, 1200, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .jpeg({ quality: 90 })
    .toBuffer();
}

async function runStorageAnalysis() {
  console.log("\n=== STORAGE ANALYSIS ===\n");
  const objectStorage = new ObjectStorageService();
  const allFiles = await objectStorage.listAllFiles();
  
  const largeFiles = allFiles.filter(f => f.size > 1.5 * 1024 * 1024);
  const pngFiles = allFiles.filter(f => f.name.endsWith('.png'));
  const jpgFiles = allFiles.filter(f => f.name.endsWith('.jpg') || f.name.endsWith('.jpeg'));
  
  const totalSize = allFiles.reduce((sum, f) => sum + f.size, 0);
  const pngSize = pngFiles.reduce((sum, f) => sum + f.size, 0);
  
  console.log(`Total Files: ${allFiles.length}`);
  console.log(`Total Size: ${(totalSize / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`PNG Files: ${pngFiles.length} (${(pngSize / (1024 * 1024)).toFixed(2)} MB)`);
  console.log(`JPG Files: ${jpgFiles.length}`);
  console.log(`Large Files (>1.5MB): ${largeFiles.length}`);
  
  if (largeFiles.length > 0) {
    console.log("\nLarge Files:");
    largeFiles.forEach(f => {
      console.log(`  - ${f.name}: ${(f.size / (1024 * 1024)).toFixed(2)} MB`);
    });
  }
  
  return { pngFiles, largeFiles };
}

async function migrateAllImages() {
  console.log("\n=== MIGRATING PNG IMAGES ===\n");
  
  const objectStorage = new ObjectStorageService();
  const generatedDir = path.join(process.cwd(), "generated");
  
  if (!fs.existsSync(generatedDir)) {
    fs.mkdirSync(generatedDir, { recursive: true });
  }

  const allStorybooks = await storage.getAllStorybooks();
  const storybooksToMigrate = allStorybooks.filter(sb => 
    sb.coverImageUrl?.endsWith('.png') || 
    sb.backCoverImageUrl?.endsWith('.png') ||
    sb.pages.some(p => p.imageUrl?.endsWith('.png'))
  );
  
  if (storybooksToMigrate.length === 0) {
    console.log("No PNG images to migrate");
    return { migratedBooks: 0, migratedImages: 0 };
  }

  console.log(`Found ${storybooksToMigrate.length} storybooks with PNG images\n`);

  let totalMigratedImages = 0;
  const { db } = await import('../server/db');
  const { storybooks } = await import('../shared/schema');
  const { eq } = await import('drizzle-orm');

  for (const storybook of storybooksToMigrate) {
    console.log(`Processing: ${storybook.title}`);
    const migratedImages: string[] = [];
    const filesToDelete: string[] = [];

    let newCoverUrl = storybook.coverImageUrl;
    let newBackCoverUrl = storybook.backCoverImageUrl;
    const updatedPages = [...storybook.pages];
    const uploadedNewFiles: string[] = [];
    
    try {
      const createdAt = storybook.createdAt || new Date();
      
      // Migrate cover image
      if (storybook.coverImageUrl?.endsWith('.png')) {
        const oldFilename = storybook.coverImageUrl.split('/').pop()!;
        const newFilename = oldFilename.replace('.png', '.jpg');
        
        const imageBuffer = await objectStorage.getFileBuffer(oldFilename);
        const optimizedBuffer = await optimizeImageForWeb(imageBuffer);
        
        const tempPath = path.join(generatedDir, newFilename);
        fs.writeFileSync(tempPath, optimizedBuffer);
        
        newCoverUrl = await objectStorage.uploadFile(tempPath, newFilename, true, createdAt);
        uploadedNewFiles.push(newCoverUrl.replace('/api/storage/', ''));
        fs.unlinkSync(tempPath);
        
        filesToDelete.push(oldFilename);
        migratedImages.push(`Cover: ${oldFilename} → ${newFilename}`);
      }

      // Migrate back cover image
      if (storybook.backCoverImageUrl?.endsWith('.png')) {
        const oldFilename = storybook.backCoverImageUrl.split('/').pop()!;
        const newFilename = oldFilename.replace('.png', '.jpg');
        
        const imageBuffer = await objectStorage.getFileBuffer(oldFilename);
        const optimizedBuffer = await optimizeImageForWeb(imageBuffer);
        
        const tempPath = path.join(generatedDir, newFilename);
        fs.writeFileSync(tempPath, optimizedBuffer);
        
        newBackCoverUrl = await objectStorage.uploadFile(tempPath, newFilename, true, createdAt);
        uploadedNewFiles.push(newBackCoverUrl.replace('/api/storage/', ''));
        fs.unlinkSync(tempPath);
        
        filesToDelete.push(oldFilename);
        migratedImages.push(`Back Cover: ${oldFilename} → ${newFilename}`);
      }

      // Migrate page images
      for (let i = 0; i < storybook.pages.length; i++) {
        const page = storybook.pages[i];
        if (page.imageUrl?.endsWith('.png')) {
          const oldFilename = page.imageUrl.split('/').pop()!;
          const newFilename = oldFilename.replace('.png', '.jpg');
          
          const imageBuffer = await objectStorage.getFileBuffer(oldFilename);
          const optimizedBuffer = await optimizeImageForWeb(imageBuffer);
          
          const tempPath = path.join(generatedDir, newFilename);
          fs.writeFileSync(tempPath, optimizedBuffer);
          
          const newUrl = await objectStorage.uploadFile(tempPath, newFilename, true, createdAt);
          uploadedNewFiles.push(newUrl.replace('/api/storage/', ''));
          fs.unlinkSync(tempPath);
          
          filesToDelete.push(oldFilename);
          updatedPages[i] = { ...page, imageUrl: newUrl };
          migratedImages.push(`Page ${page.pageNumber}: ${oldFilename} → ${newFilename}`);
        }
      }

      if (migratedImages.length > 0) {
        await db.update(storybooks)
          .set({ 
            coverImageUrl: newCoverUrl,
            backCoverImageUrl: newBackCoverUrl,
            pages: updatedPages
          })
          .where(eq(storybooks.id, storybook.id));

        totalMigratedImages += migratedImages.length;

        // Delete old PNG files
        for (const oldFile of filesToDelete) {
          try {
            await objectStorage.deleteFile(oldFile);
            console.log(`  ✓ Deleted: ${oldFile}`);
          } catch (deleteError) {
            console.error(`  ✗ Failed to delete ${oldFile}:`, deleteError);
          }
        }
        
        console.log(`  ✓ Migrated ${migratedImages.length} images\n`);
      }
    } catch (error) {
      console.error(`  ✗ Migration failed:`, error);
      
      // Rollback uploaded files
      for (const newFile of uploadedNewFiles) {
        try {
          await objectStorage.deleteFile(newFile);
        } catch (cleanupError) {
          console.error(`  ✗ Cleanup failed for ${newFile}:`, cleanupError);
        }
      }
    }
  }

  console.log(`\n✓ Migration complete: ${totalMigratedImages} images from ${storybooksToMigrate.length} books`);
  return { migratedBooks: storybooksToMigrate.length, migratedImages: totalMigratedImages };
}

async function cleanupOrphanedPngs() {
  console.log("\n=== CLEANING UP ORPHANED PNG FILES ===\n");
  
  const objectStorage = new ObjectStorageService();
  
  const allFiles = await objectStorage.listAllFiles();
  const pngFiles = allFiles.filter(f => f.name.endsWith('.png'));
  
  if (pngFiles.length === 0) {
    console.log("No PNG files found in storage");
    return { deletedCount: 0 };
  }

  const allStorybooks = await storage.getAllStorybooks();
  const dbPngUrls = new Set<string>();
  
  for (const sb of allStorybooks) {
    if (sb.coverImageUrl?.endsWith('.png')) {
      dbPngUrls.add(sb.coverImageUrl.split('/').pop()!);
    }
    if (sb.backCoverImageUrl?.endsWith('.png')) {
      dbPngUrls.add(sb.backCoverImageUrl.split('/').pop()!);
    }
    for (const page of sb.pages) {
      if (page.imageUrl?.endsWith('.png')) {
        dbPngUrls.add(page.imageUrl.split('/').pop()!);
      }
    }
  }

  let deletedCount = 0;

  for (const pngFile of pngFiles) {
    const filename = pngFile.name.split('/').pop() || pngFile.name;
    
    if (dbPngUrls.has(filename)) {
      console.log(`  ⊘ Skipping (in use): ${pngFile.name}`);
      continue;
    }

    try {
      await objectStorage.deleteFile(pngFile.name);
      deletedCount++;
      console.log(`  ✓ Deleted: ${pngFile.name} (${(pngFile.size / (1024 * 1024)).toFixed(2)} MB)`);
    } catch (error) {
      console.error(`  ✗ Failed to delete ${pngFile.name}:`, error);
    }
  }

  console.log(`\n✓ Cleanup complete: ${deletedCount} orphaned PNG files deleted`);
  return { deletedCount };
}

async function main() {
  try {
    console.log("🚀 Starting Storage Migration and Cleanup\n");
    
    // Step 1: Initial analysis
    await runStorageAnalysis();
    
    // Step 2: Migrate PNG images to JPG
    await migrateAllImages();
    
    // Step 3: Cleanup orphaned PNGs
    await cleanupOrphanedPngs();
    
    // Step 4: Final analysis
    console.log("\n=== FINAL STORAGE STATE ===");
    await runStorageAnalysis();
    
    console.log("\n✅ Storage migration and cleanup complete!");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error:", error);
    process.exit(1);
  }
}

main();
