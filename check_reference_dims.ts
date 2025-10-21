import { ObjectStorageService } from "./server/objectStorage";
import sharp from 'sharp';

async function checkReferenceDimensions() {
  const objectStorage = new ObjectStorageService();
  
  const images = [
    { book: "Sara's Diwali Lights", path: "2025/10/21/621a82c7-af9a-4b6d-8f27-18132f2959be_inspiration_0.jpg" },
    { book: "The Tapestry of Two Hearts", path: "2025/10/20/14212f9d-fc16-4010-a5cd-a07642cdc424_inspiration_0.jpg" },
  ];
  
  console.log('Checking reference image dimensions...\n');
  
  for (const img of images) {
    try {
      const buffer = await objectStorage.getFileBuffer(img.path);
      const metadata = await sharp(buffer).metadata();
      
      const aspectRatio = ((metadata.width || 0) / (metadata.height || 1)).toFixed(2);
      let orientation = 'square';
      if (parseFloat(aspectRatio) > 1.1) orientation = 'landscape';
      else if (parseFloat(aspectRatio) < 0.9) orientation = 'portrait';
      
      console.log(`Book: ${img.book}`);
      console.log(`  Reference image dimensions: ${metadata.width} x ${metadata.height}`);
      console.log(`  Aspect Ratio: ${aspectRatio} (${orientation})`);
      console.log('');
    } catch (error: any) {
      console.error(`Error checking ${img.path}:`, error.message);
    }
  }
}

checkReferenceDimensions().catch(console.error);
