import { db } from '../server/db';
import { storybooks } from '../shared/schema';
import { eq, isNull, or, like } from 'drizzle-orm';
import { ObjectStorageService } from '../server/objectStorage';
import { optimizeImageForWeb } from '../server/services/gemini';
import * as path from 'path';
import * as fs from 'fs';

const objectStorage = new ObjectStorageService();

const generatedDir = path.join(process.cwd(), 'generated');

async function migrateImages() {
  console.log('🔍 Finding storybooks with PNG images...\n');

  // Find all storybooks with PNG images
  const storybooksToMigrate = await db
    .select()
    .from(storybooks)
    .where(
      or(
        like(storybooks.coverImageUrl, '%.png'),
        like(storybooks.backCoverImageUrl, '%.png')
      )
    );

  if (storybooksToMigrate.length === 0) {
    console.log('✅ No storybooks with PNG images found!');
    return;
  }

  console.log(`📚 Found ${storybooksToMigrate.length} storybooks to migrate\n`);

  let totalMigratedImages = 0;
  const results: Array<{
    storybookId: string;
    title: string;
    migratedImages: string[];
    count: number;
    failed: boolean;
    failureReason?: string;
  }> = [];

  for (const storybook of storybooksToMigrate) {
    console.log(`\n📖 Processing: ${storybook.title}`);
    console.log(`   ID: ${storybook.id}`);

    const migratedImages: string[] = [];
    const filesToDelete: string[] = [];
    const uploadedNewFiles: string[] = [];
    let migrationFailed = false;
    let failureReason = '';

    let newCoverUrl = storybook.coverImageUrl;
    let newBackCoverUrl = storybook.backCoverImageUrl;
    const updatedPages = [...storybook.pages];

    try {
      // Migrate cover image
      if (storybook.coverImageUrl?.endsWith('.png')) {
        console.log('   🖼️  Migrating cover image...');
        const oldFilename = storybook.coverImageUrl.split('/').pop()!;
        const newFilename = oldFilename.replace('.png', '.jpg');
        
        const imageBuffer = await objectStorage.getFileBuffer(oldFilename);
        const optimizedBuffer = await optimizeImageForWeb(imageBuffer);
        
        const tempPath = path.join(generatedDir, newFilename);
        fs.writeFileSync(tempPath, optimizedBuffer);
        
        newCoverUrl = await objectStorage.uploadFile(tempPath, newFilename);
        uploadedNewFiles.push(newFilename);
        fs.unlinkSync(tempPath);
        
        filesToDelete.push(oldFilename);
        migratedImages.push(`Cover: ${oldFilename} → ${newFilename}`);
        console.log(`      ✓ ${oldFilename} → ${newFilename}`);
      }

      // Migrate back cover image
      if (storybook.backCoverImageUrl?.endsWith('.png')) {
        console.log('   🖼️  Migrating back cover image...');
        const oldFilename = storybook.backCoverImageUrl.split('/').pop()!;
        const newFilename = oldFilename.replace('.png', '.jpg');
        
        const imageBuffer = await objectStorage.getFileBuffer(oldFilename);
        const optimizedBuffer = await optimizeImageForWeb(imageBuffer);
        
        const tempPath = path.join(generatedDir, newFilename);
        fs.writeFileSync(tempPath, optimizedBuffer);
        
        newBackCoverUrl = await objectStorage.uploadFile(tempPath, newFilename);
        uploadedNewFiles.push(newFilename);
        fs.unlinkSync(tempPath);
        
        filesToDelete.push(oldFilename);
        migratedImages.push(`Back Cover: ${oldFilename} → ${newFilename}`);
        console.log(`      ✓ ${oldFilename} → ${newFilename}`);
      }

      // Migrate page images
      for (let i = 0; i < storybook.pages.length; i++) {
        const page = storybook.pages[i];
        if (page.imageUrl?.endsWith('.png')) {
          console.log(`   📄 Migrating page ${page.pageNumber} image...`);
          const oldFilename = page.imageUrl.split('/').pop()!;
          const newFilename = oldFilename.replace('.png', '.jpg');
          
          const imageBuffer = await objectStorage.getFileBuffer(oldFilename);
          const optimizedBuffer = await optimizeImageForWeb(imageBuffer);
          
          const tempPath = path.join(generatedDir, newFilename);
          fs.writeFileSync(tempPath, optimizedBuffer);
          
          const newUrl = await objectStorage.uploadFile(tempPath, newFilename);
          uploadedNewFiles.push(newFilename);
          fs.unlinkSync(tempPath);
          
          filesToDelete.push(oldFilename);
          updatedPages[i] = { ...page, imageUrl: newUrl };
          migratedImages.push(`Page ${page.pageNumber}: ${oldFilename} → ${newFilename}`);
          console.log(`      ✓ ${oldFilename} → ${newFilename}`);
        }
      }

      // Update database atomically
      if (migratedImages.length > 0) {
        console.log('   💾 Updating database...');
        await db.update(storybooks)
          .set({ 
            coverImageUrl: newCoverUrl,
            backCoverImageUrl: newBackCoverUrl,
            pages: updatedPages
          })
          .where(eq(storybooks.id, storybook.id));

        totalMigratedImages += migratedImages.length;

        // Delete old PNG files after successful DB update
        console.log('   🗑️  Cleaning up old PNG files...');
        for (const oldFile of filesToDelete) {
          try {
            await objectStorage.deleteFile(oldFile);
            console.log(`      ✓ Deleted ${oldFile}`);
          } catch (deleteError) {
            console.error(`      ⚠️  Failed to delete ${oldFile}:`, deleteError);
          }
        }
      }

      console.log(`   ✅ Successfully migrated ${migratedImages.length} images`);

    } catch (error) {
      migrationFailed = true;
      failureReason = String(error);
      console.error(`   ❌ Migration failed:`, error);
      
      // Clean up uploaded new files on failure
      console.log('   🧹 Rolling back uploaded files...');
      for (const newFile of uploadedNewFiles) {
        try {
          await objectStorage.deleteFile(newFile);
          console.log(`      ✓ Deleted ${newFile}`);
        } catch (cleanupError) {
          console.error(`      ⚠️  Failed to cleanup ${newFile}:`, cleanupError);
        }
      }
    }

    results.push({
      storybookId: storybook.id,
      title: storybook.title,
      migratedImages: migrationFailed ? [] : migratedImages,
      count: migrationFailed ? 0 : migratedImages.length,
      failed: migrationFailed,
      failureReason: migrationFailed ? failureReason : undefined
    });
  }

  // Print summary
  console.log('\n\n📊 Migration Summary');
  console.log('═'.repeat(60));
  console.log(`Total storybooks processed: ${storybooksToMigrate.length}`);
  console.log(`Total images migrated: ${totalMigratedImages}`);
  console.log();

  results.forEach((result) => {
    if (result.failed) {
      console.log(`❌ ${result.title}`);
      console.log(`   Failed: ${result.failureReason}`);
    } else {
      console.log(`✅ ${result.title} (${result.count} images)`);
      result.migratedImages.forEach((img) => {
        console.log(`   - ${img}`);
      });
    }
    console.log();
  });

  console.log('✨ Migration complete!\n');
  process.exit(0);
}

migrateImages().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
