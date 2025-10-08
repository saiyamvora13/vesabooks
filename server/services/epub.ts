import type { Storybook } from "@shared/schema";
import type { Chapter } from "epub-gen-memory";

export async function generateEpub(storybook: Storybook): Promise<Buffer> {
  // Use dynamic import for CommonJS module
  const epubModule = await import("epub-gen-memory");
  const epub = epubModule.default || epubModule;
  
  // Prepare content array for EPUB
  const content: Chapter[] = [];

  // Use localhost HTTP URLs - epub-gen-memory will fetch and package images automatically
  const baseUrl = "http://localhost:5000";

  // Add cover page - simple full-page cover image
  const coverImageUrl = storybook.coverImageUrl || storybook.pages[0]?.imageUrl;
  if (coverImageUrl) {
    const coverUrl = `${baseUrl}${coverImageUrl}`;
    content.push({
      title: "Cover",
      content: `<div class="cover-page">
<img src="${coverUrl}" alt="Cover" class="cover-image" />
</div>`,
      beforeToc: true,
    });
  }

  // Add each page - simple structure: image on top, text below
  for (const page of storybook.pages) {
    const pageImageUrl = `${baseUrl}${page.imageUrl}`;
    
    content.push({
      title: `Page ${page.pageNumber}`,
      content: `<div>
<img src="${pageImageUrl}" alt="Illustration for page ${page.pageNumber}" />
<p>${page.text}</p>
</div>`,
    });
  }

  const options = {
    title: storybook.title,
    author: "AI Storyteller",
    css: `
      body {
        font-family: Georgia, serif;
        margin: 0;
        padding: 0;
        line-height: 1.6;
      }
      
      .cover-page {
        margin: 0;
        padding: 0;
        page-break-after: always;
      }
      
      .cover-image {
        width: 100%;
        height: 100vh;
        object-fit: cover;
        display: block;
      }
      
      img {
        width: 100%;
        height: auto;
        display: block;
        margin-bottom: 1rem;
      }
      
      p {
        font-size: 1.1rem;
        line-height: 1.8;
        margin: 1rem;
        text-align: justify;
      }
      
      div {
        page-break-after: always;
      }
    `,
  };

  // Generate EPUB and return as Buffer
  return await epub(options, content);
}
