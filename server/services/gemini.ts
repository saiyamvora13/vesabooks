import * as fs from "fs";
import { GoogleGenAI, Modality, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface StoryPage {
  pageNumber: number;
  text: string;
  imagePrompt: string;
}

export interface GeneratedStory {
  title: string;
  author: string;
  coverImagePrompt: string;
  mainCharacterDescription: string;
  storyArc: string;
  pages: StoryPage[];
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
    
    const systemInstruction = hasCustomStyle
      ? `You are a master storyteller crafting a complete ${pagesPerBook}-page narrative based on a user's prompt${hasImages ? ' and optional inspirational images' : ''}. 

CRITICAL STORY STRUCTURE REQUIREMENTS:
1. NARRATIVE ARC - ${narrativeStructure}

2. CONTINUITY - Each page must flow naturally from the previous one. Avoid random disconnected scenes.

3. CHARACTER CONSISTENCY - This is CRITICAL for visual consistency across all ${pagesPerBook}+ illustrations:
   - In 'mainCharacterDescription': Create an EXTREMELY DETAILED description of PERMANENT physical features ONLY
   - Front-load the most important features first (hair color/style, eye color, facial features)
   - Include ONLY features that NEVER change: hair, eyes, skin tone, unique marks (freckles, birthmarks, scars, gaps in teeth), body type, facial structure
   - DO NOT include clothing in the character description - clothing can change contextually (pajamas at bedtime, swimsuit at pool, etc.)
   - For imagePrompts: Describe the scene, action, setting, and what the character is wearing/doing in that specific scene
   - NEVER repeat the permanent character features in imagePrompts - they will be prepended automatically

4. STORY ELEMENTS - Include: clear protagonist, conflict/problem, rising action, climax, and resolution.

Respect the user's style preferences. Return JSON following the schema with exactly ${pagesPerBook} pages.`
      : `You are a master children's storybook author crafting a complete ${pagesPerBook}-page story based on a user's prompt${hasImages ? ' and optional inspirational images' : ''}. Stories should be suitable for children aged 5-7.

CRITICAL STORY STRUCTURE REQUIREMENTS:
1. NARRATIVE ARC - ${narrativeStructure}

2. CONTINUITY - Each page must connect to the previous one. No random jumps. Use transitions like "Then...", "Next...", "Suddenly...".

3. CHARACTER CONSISTENCY - This is CRITICAL for visual consistency across all ${pagesPerBook}+ illustrations:
   - In 'mainCharacterDescription': Create an EXTREMELY DETAILED description of PERMANENT physical features ONLY
   - Front-load the most important features first (hair color/style, eye color, facial features)
   - Include ONLY features that NEVER change: hair, eyes, skin tone, unique marks (freckles, birthmarks, scars, gaps in teeth), body type, facial structure
   - DO NOT include clothing in the character description - clothing can change contextually (pajamas at bedtime, swimsuit at pool, costume at party, etc.)
   - For imagePrompts: Describe the scene, action, setting, and what the character is wearing/doing in that specific scene
   - NEVER repeat the permanent character features in imagePrompts - they will be prepended automatically

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
          description: "A VERY DETAILED physical description of the main character's PERMANENT features that will be used in ALL image prompts for visual consistency. CRITICAL: The character's core physical appearance must remain IDENTICAL across all 10+ illustrations. Front-load the most important features first. Include ONLY permanent features: (1) Age/type and gender, (2) Specific hair color and exact hairstyle, (3) Eye color, (4) Skin tone/fur color with any unique marks (freckles, birthmarks, scars, gaps in teeth, distinctive facial features), (5) Body type/build, (6) Any permanent distinctive features. DO NOT describe clothing here - clothing can change based on story context (pajamas, swimsuit, costume, etc.). Be extremely specific about permanent visual details that never change. Example: 'A 7-year-old girl with long curly bright red hair tied in two high pigtails, large emerald green eyes, fair skin with three small freckles across her nose, a small gap between her two front teeth, petite build, round face with a button nose.'"
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
              imagePrompt: {
                type: Type.STRING,
                description: hasCustomStyle
                  ? "A detailed image generation prompt. Describe the specific scene, action, setting, and any other characters/objects. Maintain the style requested by the user. (Note: The character description will be added automatically, so focus on what's happening in the scene.)"
                  : "A detailed image generation prompt. Describe the specific scene, action, setting, background, and any other characters/objects. Use vibrant, whimsical children's book illustration style. (Note: The character description will be added automatically, so focus on the scene details.)",
              },
            },
            required: ["pageNumber", "text", "imagePrompt"],
          },
        },
      },
      required: ["title", "author", "mainCharacterDescription", "storyArc", "coverImagePrompt", "pages"],
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

    return parsedJson as GeneratedStory;
  } catch (error) {
    throw new Error(`Failed to generate story: ${error}`);
  }
}

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export async function generateIllustration(
  imagePrompt: string,
  outputPath: string,
  baseImagePath?: string
): Promise<void> {
  let retries = 3;
  let waitTime = 2000; // Start with a 2-second delay

  while (retries > 0) {
    try {
      // Only add children's book style if user hasn't specified their own style
      const fullPrompt = hasStyleInstructions(imagePrompt)
        ? imagePrompt
        : `${imagePrompt}, in the style of a vibrant and colorful children's book illustration, whimsical and gentle.`;
      
      const contentParts: any[] = [];
      
      // Add base image if provided
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
              fs.writeFileSync(outputPath, imageData);
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
