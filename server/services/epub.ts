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
  
  // Match the viewer's author name
  const author = "AI Storyteller";

  // Add cover page - matches the app's cover design with fallback
  const coverImageUrl = storybook.coverImageUrl || storybook.pages[0]?.imageUrl;
  if (coverImageUrl) {
    const coverUrl = `${baseUrl}${coverImageUrl}`;
    content.push({
      title: "Cover",
      content: `
        <div class="cover-page">
          <div class="cover-image-container">
            <img src="${coverUrl}" alt="Cover" class="cover-image" />
            <div class="cover-overlay"></div>
          </div>
          <div class="cover-text">
            <h1 class="cover-title">${storybook.title}</h1>
            <p class="cover-author">By ${author}</p>
          </div>
        </div>`,
      beforeToc: true,
    });
  }

  // Add pages exactly like the flipbook viewer: alternating text and image pages
  for (const page of storybook.pages) {
    const pageIndex = page.pageNumber - 1;
    const textPageNum = pageIndex * 2 + 1;
    const imagePageNum = pageIndex * 2 + 2;
    
    // Text page (odd page number) - matches TextPage component
    const firstLetter = page.text.charAt(0);
    const restOfText = page.text.slice(1);
    
    content.push({
      title: `Page ${textPageNum}`,
      content: `
        <div class="text-page">
          <div class="author-name">${author.toUpperCase()}</div>
          <div class="text-content">
            <p class="story-text">
              <span class="first-letter">${firstLetter}</span>${restOfText}
            </p>
          </div>
          <div class="page-number">${textPageNum}</div>
        </div>`,
    });
    
    // Image page (even page number) - matches ImagePage component
    const pageImageUrl = `${baseUrl}${page.imageUrl}`;
    content.push({
      title: `Page ${imagePageNum}`,
      content: `
        <div class="image-page">
          <img src="${pageImageUrl}" alt="Illustration for page ${imagePageNum}" class="page-image" />
          <div class="image-page-number">${imagePageNum}</div>
        </div>`,
    });
  }

  // Add end page - matches EndPage component
  const totalPages = storybook.pages.length * 2;
  content.push({
    title: "The End",
    content: `
      <div class="end-page">
        <p class="end-text">The End</p>
        <div class="end-page-number">${totalPages}</div>
      </div>`,
  });

  const options = {
    title: storybook.title,
    author: author,
    css: `
      body {
        font-family: Georgia, serif;
        margin: 0;
        padding: 0;
        color: #1e293b;
      }
      
      /* Cover Page Styling */
      .cover-page {
        position: relative;
        width: 100%;
        height: 100vh;
        display: flex;
        flex-direction: column;
        page-break-after: always;
      }
      
      .cover-image-container {
        position: relative;
        width: 100%;
        height: 100%;
        overflow: hidden;
      }
      
      .cover-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      
      .cover-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.1);
      }
      
      .cover-text {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        background: rgba(255, 255, 255, 0.9);
        backdrop-filter: blur(10px);
        padding: 2rem;
        text-align: center;
      }
      
      .cover-title {
        font-size: 2.5rem;
        font-weight: bold;
        color: #1e293b;
        margin: 0 0 0.5rem 0;
      }
      
      .cover-author {
        font-size: 1.25rem;
        color: #475569;
        margin: 0;
      }
      
      /* Text Page Styling */
      .text-page {
        position: relative;
        width: 100%;
        min-height: 100vh;
        background: white;
        display: flex;
        flex-direction: column;
        justify-content: center;
        padding: 3rem;
        page-break-after: always;
      }
      
      .author-name {
        position: absolute;
        top: 1.5rem;
        right: 2rem;
        font-size: 0.75rem;
        color: #94a3b8;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }
      
      .text-content {
        overflow-y: auto;
      }
      
      .story-text {
        color: #334155;
        font-size: 1.125rem;
        line-height: 1.75;
        margin: 0;
      }
      
      .first-letter {
        font-size: 4.5rem;
        font-family: Georgia, serif;
        color: #1e293b;
        margin-right: 0.75rem;
        float: left;
        line-height: 1;
      }
      
      .page-number {
        position: absolute;
        bottom: 1.5rem;
        right: 2rem;
        font-size: 1rem;
        font-weight: 600;
        color: #475569;
      }
      
      /* Image Page Styling */
      .image-page {
        position: relative;
        width: 100%;
        height: 100vh;
        page-break-after: always;
      }
      
      .page-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      
      .image-page-number {
        position: absolute;
        bottom: 1.5rem;
        left: 2rem;
        font-size: 1rem;
        font-weight: 600;
        color: #1e293b;
        background: rgba(255, 255, 255, 0.6);
        backdrop-filter: blur(4px);
        border-radius: 9999px;
        padding: 0.25rem 0.75rem;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      }
      
      /* End Page Styling */
      .end-page {
        position: relative;
        width: 100%;
        min-height: 100vh;
        background: white;
        display: flex;
        align-items: center;
        justify-content: center;
        page-break-after: always;
      }
      
      .end-text {
        font-family: Georgia, serif;
        font-size: 2.5rem;
        color: #1e293b;
        margin: 0;
      }
      
      .end-page-number {
        position: absolute;
        bottom: 1.5rem;
        left: 2rem;
        font-size: 1rem;
        font-weight: 600;
        color: #475569;
      }
    `,
  };

  // Generate EPUB and return as Buffer
  return await epub(options, content);
}
