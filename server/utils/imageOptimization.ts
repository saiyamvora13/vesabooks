import sharp from 'sharp';

export type ImageOptimizationPreset = 'web' | 'pdf' | 'custom';

export interface ImageOptimizationOptions {
  preset?: ImageOptimizationPreset;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  background?: string;
}

/**
 * Optimizes images for web or print using Sharp
 * Reduces file size by ~90% with no visible quality loss
 * 
 * @param imageBuffer - The input image buffer
 * @param options - Optimization options
 * @returns Optimized image buffer as JPEG
 */
export async function optimizeImage(
  imageBuffer: Buffer,
  options: ImageOptimizationOptions = {}
): Promise<Buffer> {
  const {
    preset = 'web',
    maxWidth,
    maxHeight,
    quality = 90,
    background = '#ffffff'
  } = options;

  // Determine dimensions based on preset
  let width: number | null = null;
  let height: number | null = null;

  if (preset === 'web') {
    // Optimal web resolution: 1200px max width while maintaining aspect ratio
    width = maxWidth ?? 1200;
    height = maxHeight ?? null;
  } else if (preset === 'pdf') {
    // Optimal print resolution: 300 DPI for 6" × 9" page = 1800 × 2700 pixels
    width = maxWidth ?? 1800;
    height = maxHeight ?? 2700;
  } else {
    // Custom preset uses provided dimensions
    width = maxWidth ?? null;
    height = maxHeight ?? null;
  }

  // Build Sharp pipeline
  let pipeline = sharp(imageBuffer);

  // Resize if dimensions provided
  if (width || height) {
    pipeline = pipeline.resize(width, height, {
      fit: 'inside', // Maintain aspect ratio, fit within dimensions
      withoutEnlargement: true // Don't upscale smaller images
    });
  }

  // Convert to JPEG with optimization
  return await pipeline
    .flatten({ background }) // Replace transparency with background color
    .jpeg({
      quality, // High quality (visually identical to original)
      mozjpeg: true // Use mozjpeg for better compression
    })
    .toBuffer();
}

/**
 * Optimizes image for web display
 * Resizes to max 1200px width, converts to JPEG at 90% quality
 */
export async function optimizeImageForWeb(imageBuffer: Buffer): Promise<Buffer> {
  return optimizeImage(imageBuffer, { preset: 'web' });
}

/**
 * Optimizes image for PDF/print
 * Resizes to max 1800x2700px (300 DPI for 6" × 9"), converts to JPEG at 90% quality
 */
export async function optimizeImageForPDF(imageBuffer: Buffer): Promise<Buffer> {
  return optimizeImage(imageBuffer, { preset: 'pdf' });
}
