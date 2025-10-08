import epub from "epub-gen-memory";
import type { Storybook } from "@shared/schema";
import type { Chapter } from "epub-gen-memory";
import * as fs from "fs";
import * as path from "path";

export async function generateEpub(storybook: Storybook): Promise<Buffer> {
  // Prepare content array for EPUB
  const content: Chapter[] = [];

  // Add cover page
  if (storybook.coverImageUrl) {
    const coverPath = path.join(process.cwd(), "uploads", path.basename(storybook.coverImageUrl));
    if (fs.existsSync(coverPath)) {
      const coverImage = fs.readFileSync(coverPath).toString('base64');
      content.push({
        title: "Cover",
        content: `<div style="text-align: center; padding: 2rem;">
          <h1 style="font-size: 2.5rem; margin-bottom: 2rem; font-family: Georgia, serif;">${storybook.title}</h1>
          <img src="data:image/png;base64,${coverImage}" alt="Cover" style="max-width: 100%; height: auto; border-radius: 10px;" />
        </div>`,
        beforeToc: true,
      });
    }
  }

  // Add each page
  for (const page of storybook.pages) {
    const imagePath = path.join(process.cwd(), "uploads", path.basename(page.imageUrl));
    let imageData = '';
    
    if (fs.existsSync(imagePath)) {
      const imageBuffer = fs.readFileSync(imagePath);
      imageData = imageBuffer.toString('base64');
    }

    content.push({
      title: `Page ${page.pageNumber}`,
      content: `<div style="page-break-after: always; padding: 2rem;">
        ${imageData ? `<div style="text-align: center; margin-bottom: 2rem;">
          <img src="data:image/png;base64,${imageData}" alt="Page ${page.pageNumber}" style="max-width: 100%; height: auto; border-radius: 10px;" />
        </div>` : ''}
        <p style="font-size: 1.2rem; line-height: 1.8; text-align: justify; font-family: Georgia, serif; margin: 1rem 0;">
          ${page.text}
        </p>
      </div>`,
    });
  }

  const options = {
    title: storybook.title,
    author: "StoryBook AI",
    css: `
      body {
        font-family: Georgia, serif;
        line-height: 1.6;
        color: #333;
      }
      h1 {
        font-size: 2rem;
        margin-bottom: 1rem;
      }
      p {
        margin: 1rem 0;
      }
      img {
        max-width: 100%;
        height: auto;
      }
    `,
  };

  // Generate EPUB and return as Buffer
  return await epub(options, content);
}
