import type { Storybook } from "@shared/schema";
import type { Chapter } from "epub-gen-memory";
import { ObjectStorageService } from "../objectStorage";

export async function generateEpub(storybook: Storybook): Promise<Buffer> {
  // Use dynamic import for CommonJS module
  const epubModule = await import("epub-gen-memory");
  const epub = epubModule.default || epubModule;
  const objectStorage = new ObjectStorageService();
  
  // Prepare content array for EPUB
  const content: Chapter[] = [];

  // Use localhost HTTP URLs to serve images from Object Storage
  const baseUrl = "http://localhost:5000";

  // Add cover page
  if (storybook.coverImageUrl) {
    const coverUrl = `${baseUrl}${storybook.coverImageUrl}`;
    content.push({
      title: "Cover",
      content: `<div style="text-align: center; padding: 2rem;">
        <h1 style="font-size: 2.5rem; margin-bottom: 2rem; font-family: Georgia, serif;">${storybook.title}</h1>
        <img src="${coverUrl}" alt="Cover" style="max-width: 100%; height: auto; border-radius: 10px;" />
      </div>`,
      beforeToc: true,
    });
  }

  // Add each page
  for (const page of storybook.pages) {
    const pageImageUrl = `${baseUrl}${page.imageUrl}`;
    
    content.push({
      title: `Page ${page.pageNumber}`,
      content: `<div style="page-break-after: always; padding: 2rem;">
        <div style="text-align: center; margin-bottom: 2rem;">
          <img src="${pageImageUrl}" alt="Page ${page.pageNumber}" style="max-width: 100%; height: auto; border-radius: 10px;" />
        </div>
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
