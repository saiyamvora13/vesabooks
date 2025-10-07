import pako from 'pako';

export function compressData(data: any): string {
  try {
    const jsonString = JSON.stringify(data);
    const compressed = pako.deflate(jsonString);
    return btoa(String.fromCharCode.apply(null, Array.from(compressed)));
  } catch (error) {
    console.error('Compression failed:', error);
    throw new Error('Failed to compress data');
  }
}

export function decompressData(compressedData: string): any {
  try {
    const binaryData = atob(compressedData);
    const bytes = new Uint8Array(binaryData.length);
    for (let i = 0; i < binaryData.length; i++) {
      bytes[i] = binaryData.charCodeAt(i);
    }
    
    const decompressed = pako.inflate(bytes);
    const jsonString = String.fromCharCode.apply(null, Array.from(decompressed));
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Decompression failed:', error);
    throw new Error('Failed to decompress data');
  }
}

export function generateShareableUrl(storybook: any, baseUrl: string): string {
  try {
    const compressed = compressData(storybook);
    return `${baseUrl}/shared/${compressed}`;
  } catch (error) {
    console.error('URL generation failed:', error);
    throw new Error('Failed to generate shareable URL');
  }
}
