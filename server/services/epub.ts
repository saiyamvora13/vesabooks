import type { Storybook } from "@shared/schema";
import type { Chapter } from "epub-gen-memory";
import sharp from "sharp";
import { ObjectStorageService } from "../objectStorage";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { randomUUID } from "crypto";

export async function generateEpub(storybook: Storybook): Promise<Buffer> {
  // Use dynamic import for CommonJS module
  const epubModule = await import("epub-gen-memory");
  const epub = epubModule.default || epubModule;
  
  // Prepare content array for EPUB
  const content: Chapter[] = [];

  // Use localhost HTTP URLs - epub-gen-memory will fetch and package images automatically
  const baseUrl = "http://localhost:5000";

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
    
    // Add internal cover page with title and author overlay
    const coverUrl = `${baseUrl}${coverImageUrl}`;
    content.push({
      content: `<div class="cover-page">
  <img src="${coverUrl}" alt="Cover" class="cover-image" />
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

  // Add each story page - mobile-first responsive layout: image first on mobile, side-by-side on larger screens
  for (const page of storybook.pages) {
    const pageImageUrl = `${baseUrl}${page.imageUrl}`;
    
    content.push({
      content: `<div class="story-page">
  <div class="page-image">
    <img src="${pageImageUrl}" alt="Illustration for page ${page.pageNumber}" />
  </div>
  <div class="page-text">
    <p>${escapeHtml(page.text)}</p>
  </div>
</div>`,
      excludeFromToc: true, // Exclude from Table of Contents
    });
  }

  // Add back cover if it exists
  if (storybook.backCoverImageUrl) {
    const backCoverUrl = `${baseUrl}${storybook.backCoverImageUrl}`;
    content.push({
      content: `<div class="back-cover-page">
  <img src="${backCoverUrl}" alt="Back Cover" class="back-cover-image" />
</div>`,
      excludeFromToc: true,
    });
  }

  const options = {
    title: storybook.title,
    author: "AI Storyteller",
    cover: compositeCoverPath ? `file://${compositeCoverPath}` : undefined, // Use file:// URL for cover image
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
      
      /* On larger screens (tablets/desktops): image left, text right */
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
    // Extract the path after /api/storage/ to handle both flat and date-based paths
    // Example: /api/storage/2025/10/14/xxx_cover.jpg → 2025/10/14/xxx_cover.jpg
    // Example: /api/storage/xxx_cover.jpg → xxx_cover.jpg
    const filePath = coverImageUrl.replace('/api/storage/', '');
    if (!filePath) {
      return null;
    }

    // Download the cover image using ObjectStorageService
    const objectStorageService = new ObjectStorageService();
    const imageBuffer = await objectStorageService.getFileBuffer(filePath);

    // Get image dimensions
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    const width = metadata.width || 800;
    const height = metadata.height || 1200;

    // Calculate positions for overlay and text
    const overlayHeight = Math.floor(height * 0.25); // 25% of image height
    const overlayY = height - overlayHeight;
    
    // Helper function to split long titles into multiple lines with character-level wrapping
    const wrapText = (text: string, maxCharsPerLine: number): string[] => {
      const words = text.split(' ');
      const lines: string[] = [];
      let currentLine = '';
      
      for (let word of words) {
        // If a single word is too long, break it at character level
        while (word.length > maxCharsPerLine) {
          // If we have a current line, push it first
          if (currentLine) {
            lines.push(currentLine);
            currentLine = '';
          }
          // Break the word at maxCharsPerLine with a hyphen
          lines.push(word.substring(0, maxCharsPerLine - 1) + '-');
          word = word.substring(maxCharsPerLine - 1);
        }
        
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        if (testLine.length <= maxCharsPerLine) {
          currentLine = testLine;
        } else {
          if (currentLine) lines.push(currentLine);
          currentLine = word;
        }
      }
      if (currentLine) lines.push(currentLine);
      return lines;
    };
    
    // Calculate maximum characters per line with safety margin
    // Use a more conservative estimate to ensure text fits
    const safeWidth = width * 0.85; // Use 85% of width for safety margin
    const maxCharsPerLine = Math.floor(safeWidth / 45); // Adjusted divisor for better fit
    const titleLines = wrapText(title, Math.max(maxCharsPerLine, 12)); // Minimum 12 chars per line
    
    // Find the longest line to calculate appropriate font size
    const longestLineLength = Math.max(...titleLines.map(line => line.length));
    
    // Calculate font sizes based on both number of lines and longest line length
    // Ensure text fits horizontally by scaling based on longest line
    const fontSizeByLines = titleLines.length > 3 ? 40 : 
                           titleLines.length > 2 ? 45 : 
                           titleLines.length > 1 ? 50 : 60;
    
    // Calculate font size based on longest line to ensure it fits width
    const fontSizeByWidth = Math.floor((safeWidth / longestLineLength) * 1.8);
    
    // Calculate font size based on height - title at top 20% area
    const availableHeightForTitle = height * 0.18; // Use top 18% for title
    const fontSizeByHeight = Math.floor(availableHeightForTitle / (titleLines.length * 1.2));
    
    // Use the smallest of all three constraints to ensure text fits in all dimensions
    const baseFontSize = Math.min(fontSizeByLines, fontSizeByWidth, fontSizeByHeight, 70); // Cap at 70
    
    // Ensure minimum readable font size
    const minFontSize = 25;
    const finalBaseFontSize = Math.max(baseFontSize, minFontSize);
    
    const authorFontSize = Math.floor(finalBaseFontSize * 0.4); // Smaller author font
    
    // Calculate line height and starting position for multi-line title at TOP
    const lineHeight = finalBaseFontSize * 1.2;
    const totalTitleHeight = titleLines.length * lineHeight;
    const topPadding = height * 0.05; // Start 5% from top
    const startTitleY = topPadding; // Title starts near top
    
    // Build SVG text elements for each line of the title with white text and shadow
    const titleSvgElements = titleLines.map((line, index) => {
      const y = startTitleY + (index + 1) * lineHeight;
      return `<text x="50%" y="${y}" text-anchor="middle" font-family="Georgia, serif" font-size="${finalBaseFontSize}" font-weight="bold" fill="white" filter="url(#textShadow)">${escapeXml(line)}</text>`;
    }).join('\n      ');
    
    // Position author text at bottom
    const authorY = height * 0.92; // Position author at 92% from top (near bottom)

    // Create SVG overlay with transparent gradients at top and bottom
    // Title at top, author at bottom with high-contrast white text and shadows
    const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="topGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:rgb(0,0,0);stop-opacity:0.7" />
          <stop offset="100%" style="stop-color:rgb(0,0,0);stop-opacity:0" />
        </linearGradient>
        <linearGradient id="bottomGradient" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" style="stop-color:rgb(0,0,0);stop-opacity:0.7" />
          <stop offset="100%" style="stop-color:rgb(0,0,0);stop-opacity:0" />
        </linearGradient>
        <filter id="textShadow">
          <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.8"/>
        </filter>
      </defs>
      <!-- Top gradient for title -->
      <rect x="0" y="0" width="${width}" height="${height * 0.25}" fill="url(#topGradient)"/>
      <!-- Bottom gradient for author -->
      <rect x="0" y="${height * 0.75}" width="${width}" height="${height * 0.25}" fill="url(#bottomGradient)"/>
      ${titleSvgElements}
      <text x="50%" y="${authorY}" text-anchor="middle" font-family="Georgia, serif" font-size="${authorFontSize}" fill="white" filter="url(#textShadow)">By AI Storyteller</text>
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
