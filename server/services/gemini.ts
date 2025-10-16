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
  artStyle?: string; // Optional: extracted art style from user prompt for consistency across all images
}

function getMimeType(filePath: string): string {
  const ext = filePath.toLowerCase().split('.').pop();
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  return 'image/jpeg'; // default fallback
}

// Helper function to detect if the prompt already contains style instructions
function hasStyleInstructions(prompt: string): boolean {
  const lowerPrompt = prompt.toLowerCase();
  
  // Check for explicit style keywords
  const styleKeywords = [
    'style', 'realistic', 'photorealistic', 'photo-realistic', 'photograph',
    'cartoon', 'animated', 'anime', 'manga',
    'oil painting', 'watercolor', 'sketch', 'drawing', 'pencil',
    '3d', 'cgi', 'rendered', 'render',
    'vintage', 'retro', 'modern', 'contemporary',
    'abstract', 'surreal', 'impressionist',
    'noir', 'black and white', 'monochrome',
    'cinematic', 'dramatic lighting',
    'minimalist', 'detailed', 'hyper-realistic'
  ];
  
  return styleKeywords.some(keyword => lowerPrompt.includes(keyword));
}

// Helper function to extract the art style directive from user prompt for consistency
function extractArtStyle(prompt: string, hasPhotos: boolean = false): string | undefined {
  if (!hasStyleInstructions(prompt)) {
    // If photos are uploaded but no style specified, default to photo-realistic
    if (hasPhotos) {
      return "photo-realistic, lifelike, natural lighting, high quality photographic style";
    }
    // No custom style and no photos, return undefined so we use the default children's book style
    return undefined;
  }
  
  // User has specified a custom style - extract it from the prompt
  const lowerPrompt = prompt.toLowerCase();
  
  // Look for common style patterns
  const stylePatterns = [
    /in\s+(?:the\s+)?style\s+of\s+([^.,;!?]+)/i,
    /(?:as|like)\s+(?:a\s+)?([^.,;!?]*(?:painting|illustration|photo|photograph|cartoon|anime|drawing|sketch)[^.,;!?]*)/i,
    /(photo-?realistic|photorealistic|realistic|cinematic|dramatic|noir|vintage|retro|modern|contemporary|minimalist|abstract|surreal|impressionist|watercolor|oil\s+painting|3d\s+render(?:ed)?|animated|cartoon|anime|manga)(?:\s+style)?/i,
  ];
  
  for (const pattern of stylePatterns) {
    const match = prompt.match(pattern);
    if (match && match[1]) {
      const extractedStyle = match[1].trim();
      // Return the extracted style with "style" suffix if not already present
      return extractedStyle.toLowerCase().includes('style') ? extractedStyle : `${extractedStyle} style`;
    }
  }
  
  // If we detected style keywords but couldn't extract specific style, return a generic description
  if (lowerPrompt.includes('realistic') || lowerPrompt.includes('photo')) {
    return "realistic, detailed, high quality style";
  }
  if (lowerPrompt.includes('cartoon') || lowerPrompt.includes('animated')) {
    return "vibrant cartoon style, colorful, animated look";
  }
  if (lowerPrompt.includes('watercolor')) {
    return "watercolor painting style, soft, artistic";
  }
  if (lowerPrompt.includes('cinematic')) {
    return "cinematic style, dramatic lighting, movie-like quality";
  }
  
  // Fallback: return undefined to use Gemini's interpretation
  return undefined;
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

export async function generateStoryFromPrompt(
  prompt: string,
  inspirationImagePaths: string[],
  pagesPerBook: number = 3
): Promise<GeneratedStory> {
  try {
    // Adapt system instruction based on whether user specified a style
    const hasCustomStyle = hasStyleInstructions(prompt);
    
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
    
    // Special instruction when photos are uploaded
    const photoReferenceInstruction = hasImages 
      ? `\n\n🔴 CRITICAL PHOTO REFERENCE INSTRUCTIONS 🔴
${inspirationImagePaths.length} reference photo(s) have been provided. You MUST:
1. DESCRIBE EXACTLY WHAT YOU SEE in the photos - same age, same physical features, same appearance
2. If the photo shows adults, the character MUST be an adult (do NOT change to children)
3. If the photo shows children, the character MUST be a child (do NOT change to adults)
4. Match ALL physical details from the photo: age, gender, hair, eyes, skin tone, facial features, build
5. The character description should read like a detailed description of the ACTUAL PERSON in the photo
6. Only deviate from the photo if the user's prompt EXPLICITLY requests changes (e.g., "make me a superhero")

These photos are NOT just "inspiration" - they are EXACT VISUAL REFERENCES for how characters should look.\n`
      : '';

    const systemInstruction = hasCustomStyle
      ? `You are a master storyteller crafting a complete ${pagesPerBook}-page narrative based on a user's prompt${hasImages ? ' and EXACT reference photos' : ''}. ${photoReferenceInstruction}

CRITICAL STORY STRUCTURE REQUIREMENTS:
1. NARRATIVE ARC - ${narrativeStructure}

2. CONTINUITY - Each page must flow naturally from the previous one. Avoid random disconnected scenes.

3. CHARACTER CONSISTENCY - This is CRITICAL for visual consistency across all ${pagesPerBook}+ illustrations:
   - In 'mainCharacterDescription': Create an EXTREMELY DETAILED description of PERMANENT physical features ONLY
   - Front-load the most important features first (hair color/style, eye color, facial features)
   - Include ONLY features that NEVER change: hair, eyes, skin tone, unique marks (freckles, birthmarks, scars, gaps in teeth), body type, facial structure
   - In 'defaultClothing': Describe the character's STANDARD outfit they wear in normal scenes
   - The default clothing will be maintained throughout the story UNLESS the scene context requires different clothing
   - For imagePrompts: Describe ONLY the scene, action, and setting. Do NOT describe clothing unless it DIFFERS from the default
   - NEVER repeat character features or default clothing in imagePrompts - they will be prepended automatically
   - Context-appropriate clothing changes (ONLY mention these in imagePrompts when needed):
     * Swimming/beach/pool scenes → "wearing a swimsuit"
     * Bedtime/sleeping scenes → "wearing pajamas"
     * Rain/storm scenes → "wearing a raincoat and boots"
     * Winter/snow scenes → "wearing a winter coat, hat, and gloves"
     * Formal events → "wearing formal attire" or "wearing a fancy dress/suit"
     * Sports/exercise → "wearing athletic clothes"
   - If the scene doesn't require special clothing, say NOTHING about clothing

4. STORY ELEMENTS - Include: clear protagonist, conflict/problem, rising action, climax, and resolution.

Respect the user's style preferences. Return JSON following the schema with exactly ${pagesPerBook} pages.`
      : `You are a master children's storybook author crafting a complete ${pagesPerBook}-page story based on a user's prompt${hasImages ? ' and EXACT reference photos' : ''}. Stories should be suitable for children aged 5-7.${photoReferenceInstruction}

CRITICAL STORY STRUCTURE REQUIREMENTS:
1. NARRATIVE ARC - ${narrativeStructure}

2. CONTINUITY - Each page must connect to the previous one. No random jumps. Use transitions like "Then...", "Next...", "Suddenly...".

3. CHARACTER CONSISTENCY - This is CRITICAL for visual consistency across all ${pagesPerBook}+ illustrations:
   - In 'mainCharacterDescription': Create an EXTREMELY DETAILED description of PERMANENT physical features ONLY
   - Front-load the most important features first (hair color/style, eye color, facial features)
   - Include ONLY features that NEVER change: hair, eyes, skin tone, unique marks (freckles, birthmarks, scars, gaps in teeth), body type, facial structure
   - In 'defaultClothing': Describe the character's STANDARD outfit they wear in normal scenes
   - The default clothing will be maintained throughout the story UNLESS the scene context requires different clothing
   - For imagePrompts: Describe ONLY the scene, action, and setting. Do NOT describe clothing unless it DIFFERS from the default
   - NEVER repeat character features or default clothing in imagePrompts - they will be prepended automatically
   - Context-appropriate clothing changes (ONLY mention these in imagePrompts when needed):
     * Swimming/beach/pool scenes → "wearing a swimsuit"
     * Bedtime/sleeping scenes → "wearing pajamas"
     * Rain/storm scenes → "wearing a raincoat and boots"
     * Winter/snow scenes → "wearing a winter coat, hat, and gloves"
     * Formal events → "wearing formal attire" or "wearing a fancy dress/suit"
     * Sports/exercise → "wearing athletic clothes"
   - If the scene doesn't require special clothing, say NOTHING about clothing

4. STORY ELEMENTS - Include: lovable protagonist, clear problem, attempts to solve it, moment of success, happy ending with lesson.

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
          description: hasCustomStyle 
            ? "A creative and catchy title for the story that matches the requested style and tone."
            : "A creative and catchy title for the children's story.",
        },
        author: {
          type: Type.STRING,
          description: "The author's name for the storybook.",
        },
        mainCharacterDescription: {
          type: Type.STRING,
          description: hasImages 
            ? `A VERY DETAILED physical description of the main character's PERMANENT features EXACTLY AS THEY APPEAR IN THE PROVIDED REFERENCE PHOTO(S). CRITICAL: Describe the ACTUAL PERSON in the photo - same age, same features, same appearance. Include: (1) EXACT age and gender AS SHOWN in the photo, (2) Specific hair color and exact hairstyle AS SEEN in the photo, (3) Eye color, (4) Skin tone with any unique marks (facial features, distinctive characteristics), (5) Body type/build, (6) Any other distinctive permanent features. DO NOT describe clothing here. DO NOT change their age (adults stay adults, children stay children). Example: 'A woman in her mid-30s with shoulder-length straight dark brown hair, warm brown eyes, medium olive skin tone, a friendly smile, slender build, and defined cheekbones.' This description will be used in ALL illustrations, so accuracy to the photo is CRITICAL.`
            : "A VERY DETAILED physical description of the main character's PERMANENT features that will be used in ALL image prompts for visual consistency. CRITICAL: The character's core physical appearance must remain IDENTICAL across all 10+ illustrations. Front-load the most important features first. Include ONLY permanent features: (1) Age/type and gender, (2) Specific hair color and exact hairstyle, (3) Eye color, (4) Skin tone/fur color with any unique marks (freckles, birthmarks, scars, gaps in teeth, distinctive facial features), (5) Body type/build, (6) Any permanent distinctive features. DO NOT describe clothing here - clothing will be handled separately. Be extremely specific about permanent visual details that never change. Example: 'A 7-year-old girl with long curly bright red hair tied in two high pigtails, large emerald green eyes, fair skin with three small freckles across her nose, a small gap between her two front teeth, petite build, round face with a button nose.'"
        },
        defaultClothing: {
          type: Type.STRING,
          description: "The character's DEFAULT clothing that they wear in MOST scenes. This will be applied automatically to maintain consistency across illustrations unless a specific scene requires different clothing (swimming, sleeping, etc.). Be specific about colors, patterns, and style. Example: 'wearing a bright yellow sundress with small white daisies, white sandals, and a matching yellow headband' or 'wearing a blue t-shirt with a rocket ship logo, red shorts, and white sneakers with green laces'. This clothing will be used throughout the story except when the scene context explicitly requires different attire."
        },
        storyArc: {
          type: Type.STRING,
          description: `A brief summary of the story's narrative arc in 2-3 sentences. Describe: (1) The beginning - who is the character and their normal world, (2) The middle - what problem/adventure they encounter, (3) The end - how it resolves and what they learn. This ensures the ${pagesPerBook} pages follow a cohesive storyline.`
        },
        coverImagePrompt: {
          type: Type.STRING,
          description: "A detailed, descriptive prompt for an AI image generator to create the cover image. Describe a compelling scene representing the story's theme, specify the setting, and include artistic style details. (Note: The character description will be added automatically, so focus on the scene, action, and environment.)"
        },
        pages: {
          type: Type.ARRAY,
          description: `An array of exactly ${pagesPerBook} pages that follow the story arc from beginning to end.`,
          items: {
            type: Type.OBJECT,
            properties: {
              pageNumber: {
                type: Type.NUMBER,
                description: `The page number (1 to ${pagesPerBook}).`,
              },
              text: {
                type: Type.STRING,
                description: hasCustomStyle
                  ? "The narrative text for this page (100-150 words). Ensure it flows naturally from the previous page and advances the story arc. Match the tone specified in the user's prompt."
                  : "The narrative text for this page (100-150 words). Ensure it flows naturally from the previous page and advances the story arc. Use clear, engaging language for children aged 5-7.",
              },
              main_action: {
                type: Type.STRING,
                description: "The PRIMARY action happening in this page's text. Be very specific about what the character(s) are doing. Examples: 'discovering a glowing time machine', 'running through a forest chasing butterflies', 'meeting Abraham Lincoln in his office'. This should be a specific action verb and what they're doing.",
              },
              setting: {
                type: Type.STRING,
                description: "The SPECIFIC location where this scene takes place. Include descriptive details about the environment. Examples: 'a dusty basement with cobwebs and old furniture', 'busy Victorian street with horse carriages and gas lamps', 'Lincoln's presidential office with tall windows and a large wooden desk'. Be as detailed as possible.",
              },
              key_objects: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "List of IMPORTANT objects, items, or secondary characters that appear in this scene and should be visible in the illustration. Examples: ['ornate brass time machine with swirling energy', 'old yellowed paper with mysterious writing', 'Abraham Lincoln in his black suit', 'glowing blue crystal', 'wooden telescope']. Include descriptive details for each object.",
              },
              emotional_tone: {
                type: Type.STRING,
                description: "The emotional context or atmosphere of this scene. Examples: 'excited discovery', 'worried confusion', 'joyful celebration', 'tense anticipation', 'peaceful contentment'. This helps set the mood of the illustration.",
              },
              imagePrompt: {
                type: Type.STRING,
                description: hasCustomStyle
                  ? "AUTOMATICALLY CONSTRUCTED from the structured metadata. Format: '[main_action] in [setting], featuring [key_objects]. [emotional_tone] atmosphere.' DO NOT mention character appearance or default clothing - they will be prepended. Only specify different clothing if the scene REQUIRES it (e.g., 'wearing pajamas' for bedtime)."
                  : "AUTOMATICALLY CONSTRUCTED from the structured metadata. Format: '[main_action] in [setting], featuring [key_objects]. [emotional_tone] atmosphere.' The children's book illustration style will be added. DO NOT mention character appearance or default clothing - they will be prepended. Only specify different clothing if the scene REQUIRES it.",
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
    if (!parsedJson.author) {
      parsedJson.author = "AI Storyteller";
    }

    // Extract and store the art style from the original user prompt for consistency across all images
    // If photos are uploaded and no style specified, default to photo-realistic
    parsedJson.artStyle = extractArtStyle(prompt, hasImages);

    // Analyze mood for each page and log structured scene details
    if (parsedJson.pages && Array.isArray(parsedJson.pages)) {
      console.log(`\n[Story Generation] Processing ${parsedJson.pages.length} pages with structured scene extraction:`);
      
      for (const page of parsedJson.pages) {
        if (page.text) {
          page.mood = await detectPageMood(page.text);
          
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
  baseImagePath?: string,
  explicitStyle?: string // Optional: explicit art style from user prompt for consistency
): Promise<void> {
  let retries = 3;
  let waitTime = 2000; // Start with a 2-second delay

  // Log the generation for debugging character consistency
  console.log(`[generateIllustration] Starting image generation`);
  console.log(`[generateIllustration] Image prompt: ${imagePrompt.substring(0, 200)}...`);
  console.log(`[generateIllustration] Base image: ${baseImagePath ? 'PROVIDED' : 'NONE'}`);
  console.log(`[generateIllustration] Art style: ${explicitStyle || 'default'}`);

  while (retries > 0) {
    try {
      // Build the full prompt with consistent style application
      let fullPrompt: string;
      
      // Step 1: Add photo-matching instructions if we have a reference photo
      const photoMatchingPrefix = (baseImagePath && fs.existsSync(baseImagePath))
        ? `🔴 CRITICAL: The reference image shows the EXACT person who should appear in this illustration.

MATCH THE REFERENCE PHOTO EXACTLY:
- Same age (if adult in photo, show adult - do NOT change to child)
- Same facial features, hair, eyes, skin tone
- Same physical appearance and build
- Recreate this EXACT person in the scene described below

SCENE: `
        : '';
      
      // Step 2: Add the scene description
      const sceneDescription = imagePrompt;
      
      // Step 3: Add the style directive (CRITICAL: this must be consistent for ALL images)
      let styleDirective: string;
      if (explicitStyle) {
        // Use the extracted style (e.g., "photo-realistic, lifelike..." or "watercolor painting style")
        styleDirective = `\n\nSTYLE: ${explicitStyle}`;
      } else {
        // Default children's book style
        styleDirective = ', in the style of a vibrant and colorful children\'s book illustration, whimsical and gentle';
      }
      
      // Step 4: Combine everything
      fullPrompt = photoMatchingPrefix + sceneDescription + styleDirective;
      
      // Add extra emphasis for photo matching
      if (baseImagePath && fs.existsSync(baseImagePath)) {
        fullPrompt += '\n\nIMPORTANT: The person in your generated image MUST look like the person in the reference photo - same age, same features, same appearance. Only the scene/setting should match the description, but the person must match the photo EXACTLY.';
      }
      
      console.log(`[generateIllustration] Full prompt sent to Gemini: ${fullPrompt.substring(0, 250)}...`);
      
      const contentParts: any[] = [];
      
      // Add base image if provided (reference photo for character matching)
      if (baseImagePath && fs.existsSync(baseImagePath)) {
        const baseImageBytes = fs.readFileSync(baseImagePath);
        const baseImageMimeType = getMimeType(baseImagePath);
        
        contentParts.push({
          inlineData: {
            mimeType: baseImageMimeType,
            data: baseImageBytes.toString("base64"),
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
