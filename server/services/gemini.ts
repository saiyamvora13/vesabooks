import * as fs from "fs";
import { GoogleGenAI, Modality, Type } from "@google/genai";
import sharp from "sharp";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface StoryPage {
  pageNumber: number;
  text: string;
  imagePrompt: string;
  mood?: string;
}

export interface GeneratedStory {
  title: string;
  author: string;
  coverImagePrompt: string;
  mainCharacterDescription: string;
  defaultClothing: string;
  storyArc: string;
  pages: StoryPage[];
  artStyle?: string; // User-selected illustration style from dropdown for consistency across all images
}

function getMimeType(filePath: string): string {
  const ext = filePath.toLowerCase().split('.').pop();
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  return 'image/jpeg'; // default fallback
}


// Import and re-export from shared utility
import { optimizeImageForWeb } from '../utils/imageOptimization';
export { optimizeImageForWeb };

// Detect the mood/emotion of a page's text for audio selection
export async function detectPageMood(pageText: string): Promise<string> {
  try {
    const systemInstruction = `You are an emotion and mood analyzer. Analyze the given text and determine its overall mood/emotional tone. 
    
Choose ONLY ONE of these moods:
- calm: Peaceful, serene, gentle, relaxing scenes
- adventure: Exciting, energetic, action-filled, exploring
- mystery: Curious, intriguing, puzzling, discovering
- happy: Joyful, cheerful, fun, celebrating
- suspense: Tense, uncertain, anticipating, nerve-wracking
- dramatic: Intense, powerful, climactic, emotional

Return ONLY the single mood word that best matches the text.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [{ text: `Analyze this text and return the mood: ${pageText}` }],
      },
      config: {
        systemInstruction: systemInstruction,
      },
    });

    const mood = response.text?.trim().toLowerCase();
    
    // Validate and default to calm if invalid
    const validMoods = ['calm', 'adventure', 'mystery', 'happy', 'suspense', 'dramatic'];
    if (mood && validMoods.includes(mood)) {
      return mood;
    }
    
    return 'calm'; // Default fallback
  } catch (error) {
    console.error('Failed to detect page mood:', error);
    return 'calm'; // Default fallback on error
  }
}

// Detect moods for all pages in a storybook (runs in background for performance)
export async function detectMoodsForStorybook(storybookId: string, pages: Array<{ pageNumber: number; text: string }>): Promise<void> {
  try {
    console.log(`[Background] Detecting moods for storybook ${storybookId}...`);
    
    // Detect moods for all pages in parallel
    const moodPromises = pages.map(async (page) => ({
      pageNumber: page.pageNumber,
      mood: await detectPageMood(page.text),
    }));
    
    const moodResults = await Promise.all(moodPromises);
    
    // Update the storybook with detected moods
    const { db } = await import('../db');
    const { storybooks } = await import('@shared/schema');
    const { eq } = await import('drizzle-orm');
    
    // Get current storybook to preserve other page data
    const [currentStorybook] = await db
      .select()
      .from(storybooks)
      .where(eq(storybooks.id, storybookId))
      .limit(1);
    
    if (!currentStorybook) {
      console.error(`[Background] Storybook ${storybookId} not found for mood detection`);
      return;
    }
    
    // Merge moods into existing pages
    const updatedPages = currentStorybook.pages.map((page: any) => {
      const moodResult = moodResults.find(m => m.pageNumber === page.pageNumber);
      return {
        ...page,
        mood: moodResult?.mood || 'calm',
      };
    });
    
    // Update database
    await db
      .update(storybooks)
      .set({ pages: updatedPages as any })
      .where(eq(storybooks.id, storybookId));
    
    console.log(`[Background] ✅ Mood detection completed for storybook ${storybookId}`);
  } catch (error) {
    console.error(`[Background] Failed to detect moods for storybook ${storybookId}:`, error);
    // Don't throw - this is a background task
  }
}

// Generate story in batches for performance optimization
// Returns partial story with metadata + first batch of pages, then remaining pages
export async function* generateStoryInBatches(
  prompt: string,
  inspirationImagePaths: string[],
  pagesPerBook: number = 3,
  illustrationStyle: string = "vibrant and colorful children's book illustration",
  age?: string,
  author?: string
): AsyncGenerator<{ batch: number; story: GeneratedStory; isComplete: boolean }> {
  // For books with 2 or fewer pages, don't batch - just generate everything at once
  if (pagesPerBook <= 2) {
    const fullStory = await generateStoryFromPrompt(prompt, inspirationImagePaths, pagesPerBook, illustrationStyle, age, author);
    yield { batch: 1, story: fullStory, isComplete: true };
    return;
  }

  // For larger books, generate in 2 batches:
  // Batch 1: First half of pages (setup + early conflict)
  // Batch 2: Second half of pages (resolution + ending)
  const batch1Size = Math.ceil(pagesPerBook / 2);
  const batch2Size = pagesPerBook - batch1Size;

  console.log(`[Batched Generation] Generating ${pagesPerBook} pages in 2 batches: [${batch1Size} + ${batch2Size}]`);

  // Generate first batch
  console.time('[Batched Generation] Batch 1');
  const batch1Story = await generateStoryFromPrompt(prompt, inspirationImagePaths, batch1Size, illustrationStyle, age, author);
  console.timeEnd('[Batched Generation] Batch 1');
  
  yield { batch: 1, story: batch1Story, isComplete: false };

  // Generate second batch with context from first batch
  console.time('[Batched Generation] Batch 2');
  const continuationPrompt = `${prompt}

Continue the story from where it left off. The story so far:
- Title: ${batch1Story.title}
- Character: ${batch1Story.mainCharacterDescription}
- Story arc: ${batch1Story.storyArc}
- Previous pages: ${batch1Story.pages.map(p => `Page ${p.pageNumber}: ${p.text}`).join('\n')}

Generate the REMAINING ${batch2Size} pages (pages ${batch1Size + 1}-${pagesPerBook}) that complete the story arc and provide a satisfying resolution.`;

  const batch2Story = await generateStoryFromPrompt(
    continuationPrompt, 
    inspirationImagePaths, 
    batch2Size, 
    illustrationStyle, 
    age, 
    author
  );
  console.timeEnd('[Batched Generation] Batch 2');

  // Merge the two batches - renumber pages in batch 2 to continue from batch 1
  const mergedPages = [
    ...batch1Story.pages,
    ...batch2Story.pages.map(p => ({
      ...p,
      pageNumber: p.pageNumber + batch1Size,
    })),
  ];

  const completeStory: GeneratedStory = {
    ...batch1Story, // Use metadata from first batch
    pages: mergedPages,
  };

  yield { batch: 2, story: completeStory, isComplete: true };
}

export async function generateStoryFromPrompt(
  prompt: string,
  inspirationImagePaths: string[],
  pagesPerBook: number = 3,
  illustrationStyle: string = "vibrant and colorful children's book illustration",
  age?: string,
  author?: string
): Promise<GeneratedStory> {
  try {
    const hasImages = inspirationImagePaths && inspirationImagePaths.length > 0;
    
    // Calculate story structure pacing - simple and robust for all page counts
    let beginningPages: number, middlePages: number, endPages: number;
    
    if (pagesPerBook <= 2) {
      // Very short books: simplified structure
      beginningPages = 1;
      middlePages = 0;
      endPages = Math.max(0, pagesPerBook - 1);
    } else {
      // 3+ pages: ensure each act gets at least 1 page, distribute rest to middle
      beginningPages = Math.max(1, Math.round(pagesPerBook * 0.25)); // ~25%
      endPages = Math.max(1, Math.round(pagesPerBook * 0.25));        // ~25%
      middlePages = pagesPerBook - beginningPages - endPages;          // ~50% (remainder)
      
      // Ensure middle has at least 1 page for books with 3+ pages
      if (middlePages < 1) {
        middlePages = 1;
        // Reduce beginning or end to make room
        if (beginningPages > 1) beginningPages--;
        else if (endPages > 1) endPages--;
      }
    }
    
    // Build narrative structure guidance based on page count
    let narrativeStructure = '';
    if (pagesPerBook === 1) {
      narrativeStructure = `Single page format: Combine introduction, challenge, and resolution into one cohesive scene.`;
    } else if (pagesPerBook === 2) {
      narrativeStructure = `Two-page format:
   - Page 1: Introduce the character and present the challenge/adventure
   - Page 2: Show the resolution and what was learned`;
    } else {
      narrativeStructure = `Three-act structure:
   - BEGINNING (pages 1-${beginningPages}): Introduce the main character, setting, and normal world
   - MIDDLE (pages ${beginningPages + 1}-${beginningPages + middlePages}): Present conflict/challenge, show struggles and attempts to overcome obstacles
   - END (pages ${beginningPages + middlePages + 1}-${pagesPerBook}): Resolve the conflict, show growth/learning, provide closure`;
    }
    
    // Build age-appropriate content guidance
    let ageGuidance = '';
    if (age) {
      const ageRanges = {
        '3-5': 'Very simple vocabulary, short sentences, focus on basic concepts and colors. Stories should be about familiar experiences like playing, family, and animals. Keep themes light and positive.',
        '6-8': 'Elementary vocabulary with some challenging words, clear narrative structure. Stories can include simple adventures, problem-solving, and beginning character development. Introduce basic moral lessons.',
        '9-12': 'More advanced vocabulary and complex sentence structures. Stories can include deeper themes, multiple characters, and more sophisticated plots. Can handle mild suspense and emotional complexity.'
      };
      ageGuidance = ` The target reader age is ${age} years old. ${ageRanges[age as keyof typeof ageRanges] || 'Adapt the content appropriately for the specified age group.'}`;
    }

    const systemInstruction = `You are a storybook author creating a ${pagesPerBook}-page illustrated story${hasImages ? ' using the provided reference photos for character inspiration' : ''}.${ageGuidance} ${hasImages ? 'IMPORTANT: Maintain the actual age and appearance of people from the reference photos - if an adult is shown, keep them as an adult; if a child is shown, keep them as a child.' : ''}

Create a cohesive story following ${narrativeStructure}

CRITICAL INSTRUCTIONS FOR IMAGE DESCRIPTIONS:
- For the COVER: describe a compelling scene showing the main character (title and author text will be added automatically)
- For INTERIOR PAGES: create MAXIMALLY DIVERSE AND VISUALLY DISTINCT scenes - EACH PAGE MUST BE UNIQUE:
  * MANDATORY: Use a DIFFERENT camera angle for EVERY page (close-up, wide shot, over-the-shoulder, bird's eye view, worm's eye view, dutch angle, etc.)
  * MANDATORY: Vary character poses dramatically (sitting, standing, running, reaching, looking away, jumping, etc.)
  * MANDATORY: Change settings/locations between pages when story allows (indoor vs outdoor, different rooms, different lighting)
  * MANDATORY: Vary time of day and lighting (morning sunlight, golden hour, twilight, overcast, dramatic shadows, soft light)
  * MANDATORY: Use different color palettes per page (warm tones, cool tones, vibrant, muted, etc.)
  * MANDATORY: Vary composition and framing (centered, rule of thirds, dynamic diagonal, symmetrical, asymmetrical)
  * AVOID repetition: NO two pages should have similar camera angles, poses, or compositions
- ABSOLUTELY FORBIDDEN: NEVER include title text, author name, book title, or ANY written text in interior page descriptions
- CRITICAL: Each page must be immediately visually distinguishable from all other pages while maintaining character consistency

Return JSON following the schema with exactly ${pagesPerBook} pages.`;

    const imageParts = [];
    
    // Add inspiration images to the content (if provided)
    if (hasImages) {
      for (const imagePath of inspirationImagePaths) {
        try {
          const imageBytes = fs.readFileSync(imagePath);
          const mimeType = getMimeType(imagePath);
          imageParts.push({
            inlineData: {
              data: imageBytes.toString("base64"),
              mimeType: mimeType,
            },
          });
        } catch (error) {
          console.warn(`Failed to read image ${imagePath}:`, error);
        }
      }
    }

    const contents = {
      parts: [
        ...imageParts,
        { text: `Here is the story idea: ${prompt}` },
      ],
    };

    const storySchema = {
      type: Type.OBJECT,
      properties: {
        title: {
          type: Type.STRING,
          description: "The story title.",
        },
        author: {
          type: Type.STRING,
          description: "The author name.",
        },
        mainCharacterDescription: {
          type: Type.STRING,
          description: "Detailed physical description of the main character.",
        },
        defaultClothing: {
          type: Type.STRING,
          description: "The character's typical outfit.",
        },
        storyArc: {
          type: Type.STRING,
          description: "Brief summary of the story arc.",
        },
        coverImagePrompt: {
          type: Type.STRING,
          description: "Description of the cover scene showing the main character in a key moment (character description will be added automatically). IMPORTANT: This is ONLY for the COVER image. The title and author name will be added to this prompt automatically - do not include them in your description.",
        },
        pages: {
          type: Type.ARRAY,
          description: `An array of exactly ${pagesPerBook} pages that follow the story arc from beginning to end.`,
          items: {
            type: Type.OBJECT,
            properties: {
              pageNumber: {
                type: Type.NUMBER,
                description: "Page number.",
              },
              text: {
                type: Type.STRING,
                description: "Page narrative text (100-150 words).",
              },
              main_action: {
                type: Type.STRING,
                description: "Primary action in this scene.",
              },
              setting: {
                type: Type.STRING,
                description: "Location and environment.",
              },
              key_objects: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Important objects or characters to include.",
              },
              emotional_tone: {
                type: Type.STRING,
                description: "Emotional atmosphere.",
              },
              imagePrompt: {
                type: Type.STRING,
                description: "Scene description for illustration. IMPORTANT: This is for an INTERIOR PAGE, NOT the cover. Do NOT include any title text, author name, or book title in this description. Only describe the visual scene and action.",
              },
            },
            required: ["pageNumber", "text", "main_action", "setting", "key_objects", "emotional_tone", "imagePrompt"],
          },
        },
      },
      required: ["title", "author", "mainCharacterDescription", "defaultClothing", "storyArc", "coverImagePrompt", "pages"],
    };

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: storySchema,
      },
    });

    const rawJson = response.text?.trim();
    if (!rawJson) {
      throw new Error("Empty response from Gemini");
    }

    const parsedJson = JSON.parse(rawJson);
    // Always prefer user-provided author, then AI-generated, then fallback to "AI Storyteller"
    parsedJson.author = author || parsedJson.author || "AI Storyteller";

    // Store the user-selected illustration style from dropdown for consistency across all images
    parsedJson.artStyle = illustrationStyle;
    
    // Update cover prompt to explicitly include the correct title and author
    // This ensures the AI generates the cover with the user's specified author name
    parsedJson.coverImagePrompt = `${parsedJson.coverImagePrompt}. IMPORTANT: Include the title "${parsedJson.title}" prominently at the top and the author name "${parsedJson.author}" at the bottom as decorative text integrated into the illustration.`;

    // Analyze mood for each page and log structured scene details
    // NOTE: Mood detection is SKIPPED during initial generation for speed
    // Mood will be detected later in the background after images are generated
    if (parsedJson.pages && Array.isArray(parsedJson.pages)) {
      console.log(`\n[Story Generation] Processing ${parsedJson.pages.length} pages with structured scene extraction:`);
      
      for (const page of parsedJson.pages) {
        if (page.text) {
          // Skip mood detection for now - will be done in background
          page.mood = 'calm'; // Default placeholder
          
          // CRITICAL: Sanitize page imagePrompts to remove any title/author text mentions
          // This prevents the AI from adding title/author overlays to interior pages
          if (page.imagePrompt) {
            const originalPrompt = page.imagePrompt;
            
            // Helper function to canonicalize punctuation for consistent matching
            const canonicalizePunctuation = (str: string) => {
              return str
                .replace(/[\u2018\u2019]/g, "'")   // Curly apostrophes (U+2018, U+2019) → ASCII apostrophe
                .replace(/[\u201C\u201D]/g, '"')    // Curly quotes (U+201C, U+201D) → ASCII quotes
                .replace(/[\u2010-\u2015]/g, '-')   // Various dashes → ASCII hyphen
                .replace(/\u2026/g, '...')          // Ellipsis (U+2026) → three dots
                .replace(/\s+/g, ' ')               // Normalize whitespace
                .trim();
            };
            
            // Step 1: Canonicalize punctuation in BOTH prompt AND title/author for consistent matching
            page.imagePrompt = canonicalizePunctuation(page.imagePrompt);
            const canonicalTitle = canonicalizePunctuation(parsedJson.title);
            const canonicalAuthor = canonicalizePunctuation(parsedJson.author);
            
            // Step 2: Create whitespace-tolerant regex patterns for title and author
            // This handles variations like "Sara  Beheray" or "Sara\nBeheray"
            const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const titleEscaped = escapeRegex(canonicalTitle).replace(/\s+/g, '\\s+');
            const authorEscaped = escapeRegex(canonicalAuthor).replace(/\s+/g, '\\s+');
            
            // Step 3: Remove the actual title and author strings (with various forms)
            page.imagePrompt = page.imagePrompt
              // Remove exact title (with optional quotes and whitespace variations)
              .replace(new RegExp(`["']?${titleEscaped}["']?`, 'gi'), '')
              // Remove exact author (with optional quotes, "by" prefix, and whitespace variations)
              .replace(new RegExp(`(by\\s+)?["']?${authorEscaped}["']?`, 'gi'), '')
              // Remove generic title/author keywords that might trigger text rendering
              .replace(/\b(title|author|book title|story title)\b\s*(text|name)?/gi, '')
              .replace(/\b(written by|illustrated by|by)\b/gi, '')
              .replace(/\btitle\s+(displayed|shown|visible|appears|written)/gi, '')
              .replace(/\bauthor\s+(displayed|shown|visible|appears|written)/gi, '')
              // Remove quoted text followed by display verbs (catches any remaining quoted strings)
              .replace(/["']([^"']{1,100})["']\s*(displayed|shown|visible|appears|written|text|at the top|at the bottom)/gi, '')
              .trim();
            
            // Step 4: Clean up punctuation artifacts
            page.imagePrompt = page.imagePrompt
              .replace(/\s+/g, ' ')
              .replace(/\s*,\s*,/g, ',')
              .replace(/\s*\.\s*\./g, '.')
              .trim();
            
            // Step 5: FINAL VERIFICATION - Ensure title/author don't appear anywhere in the prompt
            // Use the canonicalized versions for comparison to catch punctuation variants
            const normalizedPrompt = page.imagePrompt.toLowerCase();
            const normalizedTitle = canonicalTitle.toLowerCase();
            const normalizedAuthor = canonicalAuthor.toLowerCase();
            
            if (normalizedPrompt.includes(normalizedTitle) || normalizedPrompt.includes(normalizedAuthor)) {
              console.warn(`  - [WARNING] Page ${page.pageNumber} prompt still contains title/author after sanitization!`);
              console.warn(`    Original: ${originalPrompt.substring(0, 150)}...`);
              console.warn(`    Sanitized: ${page.imagePrompt.substring(0, 150)}...`);
              
              // Fallback: Replace the entire prompt with a generic safe description from scene metadata
              let fallbackPrompt = `${page.main_action} in ${page.setting}. ${page.key_objects.join(', ')}. ${page.emotional_tone} mood.`;
              
              // CRITICAL: Sanitize the fallback too in case metadata contains title/author
              // Canonicalize punctuation first, then remove title/author
              fallbackPrompt = canonicalizePunctuation(fallbackPrompt);
              fallbackPrompt = fallbackPrompt
                .replace(new RegExp(`["']?${titleEscaped}["']?`, 'gi'), '')
                .replace(new RegExp(`(by\\s+)?["']?${authorEscaped}["']?`, 'gi'), '')
                .replace(/\s+/g, ' ')
                .trim();
              
              page.imagePrompt = fallbackPrompt;
              console.warn(`    Fallback (before final check): ${page.imagePrompt}`);
              
              // FINAL POST-FALLBACK VERIFICATION: Ensure fallback is truly clean
              const finalNormalized = page.imagePrompt.toLowerCase();
              if (finalNormalized.includes(normalizedTitle) || finalNormalized.includes(normalizedAuthor)) {
                console.error(`  - [ERROR] Fallback still contains title/author! Using minimal safe prompt.`);
                // Last resort: ultra-minimal safe description
                page.imagePrompt = `Character in a scene. ${page.emotional_tone} atmosphere.`;
              }
            }
            
            // Log if we sanitized anything (for debugging)
            if (originalPrompt !== page.imagePrompt) {
              console.log(`  - [SANITIZED] Removed title/author text from page ${page.pageNumber} prompt`);
            }
          }
          
          // Log the extracted scene metadata for debugging
          console.log(`\n[Page ${page.pageNumber}] Scene Details:`);
          console.log(`  - Main Action: ${page.main_action}`);
          console.log(`  - Setting: ${page.setting}`);
          console.log(`  - Key Objects: ${page.key_objects ? page.key_objects.join(', ') : 'none'}`);
          console.log(`  - Emotional Tone: ${page.emotional_tone}`);
          console.log(`  - Audio Mood: ${page.mood}`);
          console.log(`  - Final Image Prompt: ${page.imagePrompt.substring(0, 200)}...`);
        }
      }
      
      console.log(`\n[Story Generation] All pages processed with structured scene metadata.\n`);
    }

    return parsedJson as GeneratedStory;
  } catch (error) {
    throw new Error(`Failed to generate story: ${error}`);
  }
}

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export async function generateIllustration(
  imagePrompt: string,
  outputPath: string,
  referenceImagePaths?: string[], // Multiple reference images for better consistency
  explicitStyle?: string, // Optional: explicit art style from user prompt for consistency
  allowText?: boolean // Optional: allow text in the image (for cover with title/author)
): Promise<void> {
  let retries = 3;
  let waitTime = 2000; // Start with a 2-second delay

  // Filter out any invalid reference images
  const validReferences = (referenceImagePaths || []).filter(path => path && fs.existsSync(path));
  const hasReferences = validReferences.length > 0;

  // Log the generation for debugging character consistency
  console.log(`[generateIllustration] Starting image generation`);
  console.log(`[generateIllustration] Image prompt: ${imagePrompt.substring(0, 200)}...`);
  console.log(`[generateIllustration] Reference images: ${hasReferences ? validReferences.length : 'NONE'}`);
  console.log(`[generateIllustration] Art style: ${explicitStyle || 'default'}`);

  while (retries > 0) {
    try {
      // Build the full prompt with consistent style application
      let fullPrompt: string;
      
      // Step 1: Add photo-matching instructions if we have reference images
      const photoMatchingPrefix = hasReferences
        ? `Reference images provided for character inspiration. IMPORTANT: Maintain the actual age and appearance of people from the reference photos - if an adult is shown, keep them as an adult with appropriate adult features and proportions; if a child is shown, keep them as a child.\n\n`
        : '';
      
      // Step 2: Add the scene description
      const sceneDescription = imagePrompt;
      
      // Step 3: Add the style directive (CRITICAL: this must be consistent for ALL images)
      let styleDirective: string;
      if (explicitStyle) {
        // Use the extracted style (e.g., "photo-realistic, lifelike..." or "watercolor painting style")
        styleDirective = `\n\nSTYLE: ${explicitStyle}`;
      } else {
        // Default illustrated storybook style
        styleDirective = ', in the style of a vibrant and colorful illustrated storybook';
      }
      
      // Step 4: Add explicit NO TEXT constraint (prevents AI from rendering text/titles/author names)
      // UNLESS this is a cover image that should have title/author text
      const noTextConstraint = allowText
        ? '' // Allow text for cover images with title/author
        : '\n\nCRITICAL CONSTRAINT: This is a pure visual illustration with NO text, NO words, NO letters, NO title, NO author name, NO book title visible anywhere in the image. Do not render any typography, captions, labels, or written content whatsoever. This image should contain only the illustrated scene described above.';
      
      // Step 5: Combine everything
      fullPrompt = photoMatchingPrefix + sceneDescription + styleDirective + noTextConstraint;
      
      console.log(`[generateIllustration] Full prompt sent to Gemini: ${fullPrompt.substring(0, 250)}...`);
      
      const contentParts: any[] = [];
      
      // Add all reference images to help maintain consistency
      for (const refPath of validReferences) {
        const refImageBytes = fs.readFileSync(refPath);
        const refImageMimeType = getMimeType(refPath);
        
        contentParts.push({
          inlineData: {
            mimeType: refImageMimeType,
            data: refImageBytes.toString("base64"),
          },
        });
      }
      
      // Always add the text prompt
      contentParts.push({ text: fullPrompt });

      const contents = {
        parts: contentParts,
      };

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: contents,
        config: {
          responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
      });

      if (response.candidates && response.candidates.length > 0) {
        const content = response.candidates[0].content;
        if (content?.parts) {
          for (const part of content.parts) {
            if (part.inlineData?.data) {
              const imageData = Buffer.from(part.inlineData.data, "base64");
              // Optimize image for web: reduce size by ~90% with no visible quality loss
              const optimizedImage = await optimizeImageForWeb(imageData);
              fs.writeFileSync(outputPath, optimizedImage);
              return;
            }
          }
        }
      }
      
      throw new Error("Image generation failed to return an image part.");

    } catch (error: any) {
      retries--;
      const errorMessage = error.toString();
      
      if (retries > 0 && (errorMessage.includes("429") || errorMessage.includes("RESOURCE_EXHAUSTED"))) {
        console.warn(`Rate limit hit. Retrying in ${waitTime / 1000}s... (${retries} retries left)`);
        await delay(waitTime);
        waitTime *= 2; 
      } else {
        if (errorMessage.includes("429") || errorMessage.includes("RESOURCE_EXHAUSTED") || errorMessage.includes("Quota exceeded")) {
          console.error("Image generation failed due to quota limit.", error);
          throw new Error("You have exceeded your API quota for the day. Please check your plan details and try again tomorrow.");
        }
        console.error("Image generation failed.", error);
        throw new Error("Image generation failed. The AI service may be temporarily unavailable or overloaded.");
      }
    }
  }
  
  throw new Error("Image generation failed after all retries.");
}

export async function regenerateSinglePage(
  storybook: {
    title: string;
    pages: Array<{ pageNumber: number; text: string; imagePrompt: string }>;
    mainCharacterDescription: string;
    defaultClothing: string;
    storyArc: string;
  },
  pageNumber: number
): Promise<{ text: string; imagePrompt: string; main_action?: string; setting?: string; key_objects?: string[]; emotional_tone?: string }> {
  try {
    const totalPages = storybook.pages.length;
    
    // Get surrounding pages for context
    const previousPage = storybook.pages.find(p => p.pageNumber === pageNumber - 1);
    const nextPage = storybook.pages.find(p => p.pageNumber === pageNumber + 1);
    
    // Build context from surrounding pages
    let contextInfo = '';
    if (previousPage) {
      contextInfo += `\n\nPrevious page (${previousPage.pageNumber}): ${previousPage.text}`;
    }
    if (nextPage) {
      contextInfo += `\n\nNext page (${nextPage.pageNumber}): ${nextPage.text}`;
    }
    
    const systemInstruction = `You are regenerating page ${pageNumber} of a ${totalPages}-page storybook titled "${storybook.title}".

CRITICAL REQUIREMENTS:
1. MAINTAIN STORY CONTINUITY - The regenerated page MUST fit naturally between the surrounding pages
2. CHARACTER CONSISTENCY - Use the existing character description and default clothing (they will be prepended to image prompts automatically)
3. PRESERVE STORY ARC - Follow the established story arc: ${storybook.storyArc}
4. STRUCTURED SCENE EXTRACTION - Extract specific scene metadata to ensure illustrations accurately depict the text

CONTEXT:
- Total pages: ${totalPages}
- Regenerating page: ${pageNumber}${contextInfo}

INSTRUCTIONS:
- Generate NEW content that flows naturally from the previous page (if exists) to the next page (if exists)
- The text should be 100-150 words, appropriate for the story's tone
- Extract structured metadata about the scene:
  * main_action: The PRIMARY action happening (e.g., "discovering a time machine", "meeting Abraham Lincoln")
  * setting: The SPECIFIC location with details (e.g., "dusty basement with cobwebs")
  * key_objects: Important objects/characters that should be visible (e.g., ["time machine", "Abraham Lincoln"])
  * emotional_tone: The mood/atmosphere (e.g., "excited discovery", "tense anticipation")
- Build imagePrompt by combining: "[main_action] in [setting], featuring [key_objects]. [emotional_tone] atmosphere."
- Do NOT describe the character's physical features or default clothing in imagePrompt - they will be added automatically
- Only specify different clothing if the scene REQUIRES it (e.g., "wearing pajamas" for bedtime)

Return JSON with structured scene metadata and constructed imagePrompt.`;

    const pageSchema = {
      type: Type.OBJECT,
      properties: {
        text: {
          type: Type.STRING,
          description: `The narrative text for page ${pageNumber} (100-150 words). Must flow naturally from the previous page and lead smoothly to the next page if they exist.`,
        },
        main_action: {
          type: Type.STRING,
          description: "The PRIMARY action happening in this page's text. Be specific about what the character(s) are doing. Examples: 'discovering a glowing time machine', 'meeting Abraham Lincoln in his office'.",
        },
        setting: {
          type: Type.STRING,
          description: "The SPECIFIC location where this scene takes place with descriptive details. Examples: 'dusty basement with cobwebs and old furniture', 'Lincoln's presidential office with tall windows'.",
        },
        key_objects: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "List of IMPORTANT objects, items, or secondary characters that should be visible in the illustration. Include descriptive details for each.",
        },
        emotional_tone: {
          type: Type.STRING,
          description: "The emotional context or atmosphere of this scene. Examples: 'excited discovery', 'worried confusion', 'peaceful contentment'.",
        },
        imagePrompt: {
          type: Type.STRING,
          description: "CONSTRUCTED from the metadata: '[main_action] in [setting], featuring [key_objects]. [emotional_tone] atmosphere.' Character appearance will be added automatically.",
        },
      },
      required: ["text", "main_action", "setting", "key_objects", "emotional_tone", "imagePrompt"],
    };

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [{ text: `Generate a new version of page ${pageNumber}.` }],
      },
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: pageSchema,
      },
    });

    const rawJson = response.text?.trim();
    if (!rawJson) {
      throw new Error("Empty response from Gemini");
    }

    const parsedJson = JSON.parse(rawJson);
    
    // Log the structured scene metadata for debugging
    console.log(`\n[Page Regeneration] Page ${pageNumber} Scene Details:`);
    console.log(`  - Main Action: ${parsedJson.main_action}`);
    console.log(`  - Setting: ${parsedJson.setting}`);
    console.log(`  - Key Objects: ${parsedJson.key_objects ? parsedJson.key_objects.join(', ') : 'none'}`);
    console.log(`  - Emotional Tone: ${parsedJson.emotional_tone}`);
    console.log(`  - Final Image Prompt: ${parsedJson.imagePrompt.substring(0, 200)}...`);
    console.log(`[Page Regeneration] Structured scene metadata extracted successfully.\n`);
    
    return parsedJson;
  } catch (error) {
    throw new Error(`Failed to regenerate page: ${error}`);
  }
}
