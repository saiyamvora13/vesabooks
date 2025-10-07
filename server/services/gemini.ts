import * as fs from "fs";
import { GoogleGenAI, Modality } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface StoryPage {
  pageNumber: number;
  text: string;
  imagePrompt: string;
}

export interface GeneratedStory {
  title: string;
  pages: StoryPage[];
}

export async function generateStoryFromPrompt(
  prompt: string,
  inspirationImagePaths: string[]
): Promise<GeneratedStory> {
  try {
    // First, analyze the inspiration images to understand the style
    let styleDescription = "";
    if (inspirationImagePaths.length > 0) {
      styleDescription = await analyzeImageStyle(inspirationImagePaths[0]);
    }

    const systemPrompt = `You are a creative children's storybook writer. Create an engaging 6-page story based on the user's prompt.

Style inspiration: ${styleDescription}

Return your response as JSON in this exact format:
{
  "title": "Story Title",
  "pages": [
    {
      "pageNumber": 1,
      "text": "Page text content (2-3 sentences suitable for children)",
      "imagePrompt": "Detailed description for AI image generation that matches the style"
    }
  ]
}

Make sure the story is age-appropriate, engaging, and has a clear beginning, middle, and end. Each page should have vivid, descriptive image prompts that would create beautiful illustrations.`;

    const contents = [];
    
    // Add inspiration images if available
    for (const imagePath of inspirationImagePaths) {
      const imageBytes = fs.readFileSync(imagePath);
      contents.push({
        inlineData: {
          data: imageBytes.toString("base64"),
          mimeType: "image/jpeg",
        },
      });
    }
    
    contents.push(prompt);

    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            title: { type: "string" },
            pages: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  pageNumber: { type: "number" },
                  text: { type: "string" },
                  imagePrompt: { type: "string" }
                },
                required: ["pageNumber", "text", "imagePrompt"]
              }
            }
          },
          required: ["title", "pages"]
        },
      },
      contents: contents,
    });

    const rawJson = response.text;
    if (!rawJson) {
      throw new Error("Empty response from Gemini");
    }

    const generatedStory: GeneratedStory = JSON.parse(rawJson);
    return generatedStory;
  } catch (error) {
    throw new Error(`Failed to generate story: ${error}`);
  }
}

async function analyzeImageStyle(imagePath: string): Promise<string> {
  try {
    const imageBytes = fs.readFileSync(imagePath);
    
    const contents = [
      {
        inlineData: {
          data: imageBytes.toString("base64"),
          mimeType: "image/jpeg",
        },
      },
      "Analyze the visual style of this image. Describe the art style, color palette, mood, and any distinctive visual elements that could be replicated in children's storybook illustrations. Be specific about artistic techniques, composition, and visual themes.",
    ];

    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: contents,
    });

    return response.text || "";
  } catch (error) {
    console.error("Failed to analyze image style:", error);
    return "";
  }
}

export async function generateIllustration(
  imagePrompt: string,
  outputPath: string,
  styleContext: string = ""
): Promise<void> {
  try {
    const enhancedPrompt = styleContext 
      ? `${imagePrompt}. Style: ${styleContext}. Children's book illustration style, colorful, whimsical, safe for children.`
      : `${imagePrompt}. Children's book illustration style, colorful, whimsical, safe for children.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-preview-image-generation",
      contents: [{ role: "user", parts: [{ text: enhancedPrompt }] }],
      config: {
        responseModalities: [Modality.TEXT, Modality.IMAGE],
      },
    });

    const candidates = response.candidates;
    if (!candidates || candidates.length === 0) {
      throw new Error("No image generated");
    }

    const content = candidates[0].content;
    if (!content || !content.parts) {
      throw new Error("No content parts in response");
    }

    for (const part of content.parts) {
      if (part.inlineData && part.inlineData.data) {
        const imageData = Buffer.from(part.inlineData.data, "base64");
        fs.writeFileSync(outputPath, imageData);
        return;
      }
    }

    throw new Error("No image data found in response");
  } catch (error) {
    throw new Error(`Failed to generate illustration: ${error}`);
  }
}
