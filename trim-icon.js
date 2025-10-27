import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

async function trimAndResizeIcon() {
  try {
    // Read the original 512px icon
    const inputPath = 'attached_assets/vesabooks_favicon_transparent_512 (1)_1761546117494.png';
    
    // First, trim the transparent padding
    const trimmed = await sharp(inputPath)
      .trim() // This removes transparent pixels from edges
      .toBuffer();
    
    // Create all necessary sizes from the trimmed version
    // Add a small padding (10%) to avoid cutting too close
    const sizes = [
      { size: 16, name: 'favicon-16x16.png' },
      { size: 32, name: 'favicon-32x32.png' },
      { size: 64, name: 'favicon-64.png' },
      { size: 180, name: 'apple-touch-icon.png' },
      { size: 512, name: 'favicon.png' }
    ];
    
    for (const { size, name } of sizes) {
      // Calculate padding (10% of size)
      const padding = Math.round(size * 0.05);
      const innerSize = size - (padding * 2);
      
      await sharp(trimmed)
        .resize(innerSize, innerSize, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .extend({
          top: padding,
          bottom: padding,
          left: padding,
          right: padding,
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toFile(path.join('public', name));
        
      // Also copy to client/public
      await sharp(trimmed)
        .resize(innerSize, innerSize, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .extend({
          top: padding,
          bottom: padding,
          left: padding,
          right: padding,
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toFile(path.join('client/public', name));
        
      console.log(`Generated ${name} (${size}x${size})`);
    }
    
    // Also update the logo used in React components
    await sharp(trimmed)
      .resize(480, 480, { // Slightly smaller than 512 to add padding
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .extend({
        top: 16,
        bottom: 16,
        left: 16,
        right: 16,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile('client/src/assets/logo.png');
    
    console.log('All icons generated successfully with maximized visual size!');
  } catch (error) {
    console.error('Error processing icons:', error);
  }
}

trimAndResizeIcon();