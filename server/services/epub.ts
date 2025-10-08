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

  // Add custom cover page with title and author overlay
  const coverImageUrl = storybook.coverImageUrl || storybook.pages[0]?.imageUrl;
  if (coverImageUrl) {
    const coverUrl = `${baseUrl}${coverImageUrl}`;
    content.push({
      content: `<div class="cover-page">
  <img src="${coverUrl}" alt="Cover" class="cover-image" />
  <div class="cover-overlay"></div>
  <div class="cover-text">
    <h1>${storybook.title}</h1>
    <p>By AI Storyteller</p>
  </div>
</div>`,
      beforeToc: true,
      excludeFromToc: true,
    });
  }

  // Add each story page - responsive layout: image left, text right (stacks on small screens)
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
    // No cover option - let readers use first content page (with title/author overlay) as cover
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
        justify-content: center;
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
        padding: 2rem;
        background: #f5f1e8;
        border-radius: 12px;
        color: #334155;
        text-align: left;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }
    `,
  };

  // Generate EPUB and return as Buffer
  return await epub(options, content);
}
