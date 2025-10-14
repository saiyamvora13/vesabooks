import type { Storybook } from "@shared/schema";
import type { Chapter } from "epub-gen-memory";
import sharp from "sharp";
import { ObjectStorageService } from "../objectStorage";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { randomUUID } from "crypto";

// Helper function to convert image buffer to base64 data URL
async function getImageDataUrl(imageUrl: string): Promise<string> {
  try {
    const filename = imageUrl.split('/').pop();
    if (!filename) {
      throw new Error('Invalid image URL');
    }

    const objectStorageService = new ObjectStorageService();
    const imageBuffer = await objectStorageService.getFileBuffer(filename);
    
    // Convert to base64
    const base64 = imageBuffer.toString('base64');
    const mimeType = filename.endsWith('.png') ? 'image/png' : 'image/jpeg';
    
    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.error('Error fetching image for data URL:', error);
    throw error;
  }
}

export async function generateEpub(storybook: Storybook): Promise<Buffer> {
  // Use dynamic import for CommonJS module
  const epubModule = await import("epub-gen-memory");
  const epub = epubModule.default || epubModule;
  
  // Prepare content array for EPUB
  const content: Chapter[] = [];

  // Generate composite cover image with title/author overlay for external cover
  const coverImageUrl = storybook.coverImageUrl || storybook.pages[0]?.imageUrl;
  let compositeCoverPath: string | undefined;
  
  if (coverImageUrl) {
    const compositeBuffer = await generateCompositeCoverImage(coverImageUrl, storybook.title);
    if (compositeBuffer) {
      // Save composite cover to uniquely named temporary file to avoid race conditions
      const tempDir = os.tmpdir();
      const uniqueId = randomUUID();
      compositeCoverPath = path.join(tempDir, `epub-cover-${storybook.id}-${uniqueId}.png`);
      fs.writeFileSync(compositeCoverPath, compositeBuffer);
    }
    
    // Add internal cover page with title and author overlay using base64 data URL
    const coverDataUrl = await getImageDataUrl(coverImageUrl);
    content.push({
      content: `<div class="cover-page">
  <img src="${coverDataUrl}" alt="Cover" class="cover-image" />
  <div class="cover-overlay"></div>
  <div class="cover-text">
    <h1>${escapeHtml(storybook.title)}</h1>
    <p>By AI Storyteller</p>
  </div>
</div>`,
      beforeToc: true,
      excludeFromToc: true,
    });
  }

  // Add each story page with base64 data URLs - mobile-first responsive layout
  for (const page of storybook.pages) {
    const pageDataUrl = await getImageDataUrl(page.imageUrl);
    
    content.push({
      content: `<div class="story-page">
  <div class="page-image">
    <img src="${pageDataUrl}" alt="Illustration for page ${page.pageNumber}" />
  </div>
  <div class="page-text">
    <p>${escapeHtml(page.text)}</p>
  </div>
</div>`,
      excludeFromToc: true,
    });
  }

  // Add back cover if it exists
  if (storybook.backCoverImageUrl) {
    const backCoverDataUrl = await getImageDataUrl(storybook.backCoverImageUrl);
    content.push({
      content: `<div class="back-cover-page">
  <img src="${backCoverDataUrl}" alt="Back Cover" class="back-cover-image" />
</div>`,
      excludeFromToc: true,
    });
  }

  const options = {
    title: storybook.title,
    author: "AI Storyteller",
    cover: compositeCoverPath, // Composite cover image file path with title/author overlay
    tocTitle: "", // Empty TOC title to hide Table of Contents
    tocInTOC: false, // Hide TOC from appearing in itself (EPUB2)
    appendChapterTitles: false, // Don't add chapter titles to content
    prependChapterTitles: false, // Don't prepend titles before content
    numberChaptersInTOC: false, // Don't number chapters in TOC
    css: `
      body {
        font-family: Georgia, serif;
        margin: 0;
        padding: 0;
        line-height: 1.6;
      }
      
      /* Cover page with title and author overlay */
      .cover-page {
        position: relative;
        margin: 0;
        padding: 0;
        page-break-after: always;
        height: 100vh;
      }
      
      .cover-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      
      .cover-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.1);
      }
      
      .cover-text {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        padding: 2rem;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(8px);
        text-align: center;
      }
      
      .cover-text h1 {
        font-size: 2.5rem;
        font-weight: bold;
        font-family: Georgia, serif;
        color: #1e293b;
        margin: 0 0 0.5rem 0;
      }
      
      .cover-text p {
        font-size: 1.2rem;
        color: #475569;
        margin: 0;
      }
      
      /* Story page styles - mobile-first: image first, text below */
      .story-page {
        display: flex;
        flex-direction: column;
        page-break-after: always;
        min-height: 100vh;
      }
      
      /* On larger screens: image left, text right */
      @media (min-width: 768px) {
        .story-page {
          flex-direction: row;
          align-items: flex-start;
        }
      }
      
      .page-image {
        width: 100%;
      }
      
      @media (min-width: 768px) {
        .page-image {
          flex: 1;
          max-width: 50%;
        }
      }
      
      .page-image img {
        width: 100%;
        height: auto;
        display: block;
      }
      
      .page-text {
        width: 100%;
        padding: 1.5rem;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      @media (min-width: 768px) {
        .page-text {
          flex: 1;
          padding: 2rem;
        }
      }
      
      .page-text p {
        font-size: 1.1rem;
        line-height: 1.8;
        margin: 0;
        padding: 2rem;
        background: #f5f1e8;
        border-radius: 12px;
        color: #334155;
        text-align: left;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }
      
      /* Back cover page */
      .back-cover-page {
        margin: 0;
        padding: 0;
        page-break-after: always;
        height: 100vh;
      }
      
      .back-cover-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
    `,
  };

  // Generate EPUB and return as Buffer
  try {
    const epubBuffer = await epub(options, content);
    
    // Clean up temporary cover file
    if (compositeCoverPath && fs.existsSync(compositeCoverPath)) {
      fs.unlinkSync(compositeCoverPath);
    }
    
    return epubBuffer;
  } catch (error) {
    // Clean up temporary cover file even on error
    if (compositeCoverPath && fs.existsSync(compositeCoverPath)) {
      fs.unlinkSync(compositeCoverPath);
    }
    throw error;
  }
}

export async function generateCompositeCoverImage(
  coverImageUrl: string,
  title: string
): Promise<Buffer | null> {
  try {
    // Extract filename from coverImageUrl (e.g., "/api/storage/xxx_cover.png" → "xxx_cover.png")
    const filename = coverImageUrl.split('/').pop();
    if (!filename) {
      return null;
    }

    // Download the cover image using ObjectStorageService
    const objectStorageService = new ObjectStorageService();
    const imageBuffer = await objectStorageService.getFileBuffer(filename);

    // Get image dimensions
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    const width = metadata.width || 800;
    const height = metadata.height || 1200;

    // Calculate positions for overlay and text
    const overlayHeight = Math.floor(height * 0.25); // 25% of image height
    const overlayY = height - overlayHeight;
    
    // Position text in the bottom 20% area
    const titleY = height - Math.floor(height * 0.15); // Title at 15% from bottom
    const authorY = height - Math.floor(height * 0.08); // Author at 8% from bottom

    // Create SVG overlay with semi-transparent background and text
    const svg = `<svg width="${width}" height="${height}">
      <rect x="0" y="${overlayY}" width="${width}" height="${overlayHeight}" fill="rgba(255,255,255,0.95)"/>
      <text x="50%" y="${titleY}" text-anchor="middle" font-size="80" font-weight="bold" fill="#1e293b">${escapeXml(title)}</text>
      <text x="50%" y="${authorY}" text-anchor="middle" font-size="40" fill="#475569">By AI Storyteller</text>
    </svg>`;

    // Create composite image
    const compositeBuffer = await sharp(imageBuffer)
      .composite([
        {
          input: Buffer.from(svg),
          top: 0,
          left: 0,
        },
      ])
      .png()
      .toBuffer();

    return compositeBuffer;
  } catch (error) {
    console.error('Error generating composite cover image:', error);
    return null;
  }
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
