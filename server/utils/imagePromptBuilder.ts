/**
 * Utility function to build final image prompts with consistent character description,
 * clothing, scene, and style application.
 * 
 * This centralizes the logic for combining character features with scene descriptions
 * to ensure visual consistency across all illustrations.
 */

export interface ImagePromptComponents {
  mainCharacterDescription?: string;
  defaultClothing?: string;
  scenePrompt: string;
  artStyle?: string;
}

/**
 * Builds a complete image prompt by combining character description, clothing, and scene.
 * 
 * Logic:
 * - Combines character description with default clothing
 * - If the scene mentions clothing (e.g., "wearing pajamas"), default clothing is NOT added
 * - Scene description is appended
 * - Art style is NOT added here (handled separately in generateIllustration)
 * 
 * @param components - The components to combine into a final prompt
 * @returns The final image prompt ready for generation
 */
export function buildFinalImagePrompt(components: ImagePromptComponents): string {
  const { mainCharacterDescription, defaultClothing, scenePrompt, artStyle } = components;
  
  // Start with character description
  const characterDesc = mainCharacterDescription?.trim() || '';
  const defaultClothingDesc = defaultClothing?.trim() || '';
  
  // Check if scene already mentions clothing (to avoid duplication)
  const sceneHasClothing = /wearing\s+|wears\s+|dressed\s+in|in\s+(?:a|an|their)\s+(?:\w+\s+)?(?:pajamas|swimsuit|uniform|suit|dress|coat|outfit)/i.test(scenePrompt);
  
  // Build the character prefix
  let characterPrefix = '';
  
  // Handle character description + clothing combination
  if (characterDesc && defaultClothingDesc && !sceneHasClothing) {
    // Both character and clothing: combine them
    characterPrefix = `${characterDesc}, ${defaultClothingDesc}. `;
  } else if (characterDesc) {
    // Only character description (no clothing or scene has clothing)
    characterPrefix = `${characterDesc}. `;
  } else if (defaultClothingDesc && !sceneHasClothing) {
    // Only clothing, no character description (preserve original behavior)
    characterPrefix = `${defaultClothingDesc}. `;
  }
  // Else: no character, no clothing, or scene has clothing - prefix stays empty
  
  // Combine character prefix with scene
  const finalPrompt = characterPrefix + scenePrompt;
  
  return finalPrompt;
}
