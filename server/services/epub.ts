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

  // Set cover image URL (no text overlay, just the image)
  const coverImageUrl = storybook.coverImageUrl || storybook.pages[0]?.imageUrl;
  const coverUrl = coverImageUrl ? `${baseUrl}${coverImageUrl}` : undefined;

  // Add each page - responsive layout: image left, text right (stacks on small screens)
  for (const page of storybook.pages) {
    const pageImageUrl = `${baseUrl}${page.imageUrl}`;
    
    content.push({
      content: `<div class="story-page">
  <div class="page-image">
    <img src="${pageImageUrl}" alt="Illustration for page ${page.pageNumber}" />
  </div>
  <div class="page-text">
    <p>${page.text}</p>
  </div>
</div>`,
      excludeFromToc: true, // Exclude from Table of Contents
    });
  }

  const options = {
    title: storybook.title,
    author: "AI Storyteller",
    cover: coverUrl, // Use actual cover image
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
      
      /* Story page styles - two-page spread: image left, text right */
      .story-page {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-start;
        page-break-after: always;
        min-height: 100vh;
      }
      
      .page-image {
        flex: 1;
        min-width: 300px;
        max-width: 50%;
      }
      
      @media (max-width: 600px) {
        .page-image {
          max-width: 100%;
          width: 100%;
        }
      }
      
      .page-image img {
        width: 100%;
        height: auto;
        display: block;
      }
      
      .page-text {
        flex: 1;
        min-width: 300px;
        padding: 2rem;
        display: flex;
        align-items: center;
      }
      
      @media (max-width: 600px) {
        .page-text {
          width: 100%;
          padding: 1.5rem;
        }
      }
      
      .page-text p {
        font-size: 1.1rem;
        line-height: 1.8;
        margin: 0;
        text-align: justify;
        color: #334155;
      }
    `,
  };

  // Generate EPUB and return as Buffer
  return await epub(options, content);
}
