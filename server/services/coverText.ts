import sharp from "sharp";

// Helper function to escape XML special characters
function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case "'": return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

// Helper function to split long titles into multiple lines with character-level wrapping
function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  
  for (let word of words) {
    // If a single word is too long, break it at character level
    while (word.length > maxCharsPerLine) {
      // If we have a current line, push it first
      if (currentLine) {
        lines.push(currentLine);
        currentLine = '';
      }
      // Break the word at maxCharsPerLine with a hyphen
      lines.push(word.substring(0, maxCharsPerLine - 1) + '-');
      word = word.substring(maxCharsPerLine - 1);
    }
    
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (testLine.length <= maxCharsPerLine) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

export async function addTextToCoverImage(
  imageBuffer: Buffer,
  title: string,
  author: string,
  width: number,
  height: number
): Promise<Buffer> {
  try {
    // Calculate positions for overlay and text
    const overlayHeight = Math.floor(height * 0.25); // 25% of image height
    
    // Calculate maximum characters per line with safety margin
    const safeWidth = width * 0.85; // Use 85% of width for safety margin
    const maxCharsPerLine = Math.floor(safeWidth / 45); // Adjusted divisor for better fit
    const titleLines = wrapText(title, Math.max(maxCharsPerLine, 12)); // Minimum 12 chars per line
    
    // Find the longest line to calculate appropriate font size
    const longestLineLength = Math.max(...titleLines.map(line => line.length));
    
    // Calculate font sizes based on both number of lines and longest line length
    const fontSizeByLines = titleLines.length > 3 ? 40 : 
                           titleLines.length > 2 ? 45 : 
                           titleLines.length > 1 ? 50 : 60;
    
    // Calculate font size based on longest line to ensure it fits width
    const fontSizeByWidth = Math.floor((safeWidth / longestLineLength) * 1.8);
    
    // Calculate font size based on height - title at top 20% area
    const availableHeightForTitle = height * 0.18; // Use top 18% for title
    const fontSizeByHeight = Math.floor(availableHeightForTitle / (titleLines.length * 1.2));
    
    // Use the smallest of all three constraints to ensure text fits in all dimensions
    const baseFontSize = Math.min(fontSizeByLines, fontSizeByWidth, fontSizeByHeight, 70); // Cap at 70
    
    // Ensure minimum readable font size
    const minFontSize = 25;
    const finalBaseFontSize = Math.max(baseFontSize, minFontSize);
    
    const authorFontSize = Math.floor(finalBaseFontSize * 0.4); // Smaller author font
    
    // Calculate line height and starting position for multi-line title at TOP
    const lineHeight = finalBaseFontSize * 1.2;
    const topPadding = height * 0.05; // Start 5% from top
    const startTitleY = topPadding; // Title starts near top
    
    // Build SVG text elements for each line of the title with white text and shadow
    const titleSvgElements = titleLines.map((line, index) => {
      const y = startTitleY + (index + 1) * lineHeight;
      return `<text x="50%" y="${y}" text-anchor="middle" font-family="Georgia, serif" font-size="${finalBaseFontSize}" font-weight="bold" fill="white" filter="url(#textShadow)">${escapeXml(line)}</text>`;
    }).join('\n      ');
    
    // Position author text at bottom
    const authorY = height * 0.92; // Position author at 92% from top (near bottom)

    // Create SVG overlay with transparent gradients at top and bottom
    const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="topGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:rgb(0,0,0);stop-opacity:0.7" />
          <stop offset="100%" style="stop-color:rgb(0,0,0);stop-opacity:0" />
        </linearGradient>
        <linearGradient id="bottomGradient" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" style="stop-color:rgb(0,0,0);stop-opacity:0.7" />
          <stop offset="100%" style="stop-color:rgb(0,0,0);stop-opacity:0" />
        </linearGradient>
        <filter id="textShadow">
          <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.8"/>
        </filter>
      </defs>
      <!-- Top gradient for title -->
      <rect x="0" y="0" width="${width}" height="${height * 0.25}" fill="url(#topGradient)"/>
      <!-- Bottom gradient for author -->
      <rect x="0" y="${height * 0.75}" width="${width}" height="${height * 0.25}" fill="url(#bottomGradient)"/>
      ${titleSvgElements}
      <text x="50%" y="${authorY}" text-anchor="middle" font-family="Georgia, serif" font-size="${authorFontSize}" fill="white" filter="url(#textShadow)">By ${escapeXml(author)}</text>
    </svg>`;

    // Create composite image
    const compositeBuffer = await sharp(imageBuffer)
      .composite([
        {
          input: Buffer.from(svg),
          top: 0,
          left: 0,
        },
      ])
      .jpeg({ quality: 90 })
      .toBuffer();

    return compositeBuffer;
  } catch (error) {
    console.error('Error adding text to cover image:', error);
    throw error;
  }
}
