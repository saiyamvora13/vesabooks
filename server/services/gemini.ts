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
    
    const systemInstruction = hasCustomStyle
      ? `You are a creative storyteller. Your task is to generate a complete ${pagesPerBook}-page story based on a user's prompt${hasImages ? ' and optional inspirational images' : ''}. Respect the user's style preferences and tone specified in their prompt. You must respond with a JSON object that strictly follows the provided schema. Ensure you create a compelling 'coverImagePrompt' and that the 'pages' array contains exactly ${pagesPerBook} elements. The imagePrompts should match the style and tone requested by the user.`
      : `You are a creative and whimsical children's storybook author. Your task is to generate a complete ${pagesPerBook}-page story based on a user's prompt${hasImages ? ' and optional inspirational images' : ''}. The story should be suitable for children aged 5-7. You must respond with a JSON object that strictly follows the provided schema. Ensure you create a compelling 'coverImagePrompt' and that the 'pages' array contains exactly ${pagesPerBook} elements.`;

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
        coverImagePrompt: {
          type: Type.STRING,
          description: "A detailed, descriptive prompt for an AI image generator to create the cover image for the book. This should be a single, compelling scene that represents the entire story's theme and main character."
        },
        pages: {
          type: Type.ARRAY,
          description: `An array of ${pagesPerBook} pages for the storybook.`,
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
                  ? "The text for one page of the story, between 100 and 150 words. Match the tone and style specified in the user's prompt."
                  : "The text for one page of the story, between 100 and 150 words. It should be engaging for a child.",
              },
              imagePrompt: {
                type: Type.STRING,
                description: hasCustomStyle
                  ? "A detailed, descriptive prompt for an AI image generator to create an illustration for this page. Describe the scene, characters, actions, style, and colors clearly. The style should match what the user requested in their prompt."
                  : "A detailed, descriptive prompt for an AI image generator to create an illustration for this page. Describe the scene, characters, actions, style, and colors clearly. The style should be consistent with a whimsical, illustrated children's book.",
              },
            },
            required: ["pageNumber", "text", "imagePrompt"],
          },
        },
      },
      required: ["title", "author", "coverImagePrompt", "pages"],
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
