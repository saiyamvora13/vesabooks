// Professional hardcover book size specifications
// Based on Prodigi hardcover photo book specifications

export type BookOrientation = 'portrait' | 'landscape';

export interface BookSize {
  id: string;
  name: string;
  orientation: BookOrientation;
  widthMM: number;
  heightMM: number;
  widthInches: number;
  heightInches: number;
}

// Convert MM to points (1 inch = 72 points, 1 inch = 25.4 mm)
const MM_TO_POINTS = 72 / 25.4;

export const BOOK_SIZES: Record<string, BookSize> = {
  'a5-landscape': {
    id: 'a5-landscape',
    name: 'A5 Landscape',
    orientation: 'landscape',
    widthMM: 210,
    heightMM: 148,
    widthInches: 8.3,
    heightInches: 5.8,
  },
  'a5-portrait': {
    id: 'a5-portrait',
    name: 'A5 Portrait',
    orientation: 'portrait',
    widthMM: 148,
    heightMM: 210,
    widthInches: 5.8,
    heightInches: 8.3,
  },
  'a4-landscape': {
    id: 'a4-landscape',
    name: 'A4 Landscape',
    orientation: 'landscape',
    widthMM: 297,
    heightMM: 210,
    widthInches: 11.7,
    heightInches: 8.3,
  },
  'a4-portrait': {
    id: 'a4-portrait',
    name: 'A4 Portrait',
    orientation: 'portrait',
    widthMM: 210,
    heightMM: 297,
    widthInches: 8.3,
    heightInches: 11.7,
  },
};

// Default book size
export const DEFAULT_BOOK_SIZE = BOOK_SIZES['a4-portrait'];

// Safety margin (10mm from edge as per specifications)
export const SAFETY_MARGIN_MM = 10;
export const SAFETY_MARGIN_POINTS = SAFETY_MARGIN_MM * MM_TO_POINTS;

// Required specifications
export const REQUIRED_DPI = 300;
export const COLOR_PROFILE = 'RGB';
export const MIN_PAGES_FINAL_BOOK = 24; // Final book (including Prodigi's binding pages)
export const MAX_PAGES_FINAL_BOOK = 300; // Final book (including Prodigi's binding pages)
export const PRODIGI_BINDING_PAGES = 6; // Pages Prodigi adds automatically (binding sheets + inside covers)

// Helper function to get book dimensions in points
export function getBookDimensionsInPoints(bookSizeId: string): { width: number; height: number } {
  const bookSize = BOOK_SIZES[bookSizeId] || DEFAULT_BOOK_SIZE;
  return {
    width: bookSize.widthMM * MM_TO_POINTS,
    height: bookSize.heightMM * MM_TO_POINTS,
  };
}

// Helper function to get all book sizes as array
export function getAllBookSizes(): BookSize[] {
  return Object.values(BOOK_SIZES);
}

// Helper function to get book sizes filtered by orientation
export function getBookSizesByOrientation(orientation: BookOrientation): BookSize[] {
  return Object.values(BOOK_SIZES).filter(size => size.orientation === orientation);
}

// Validate page count for our PDF (Prodigi adds ~6 pages automatically)
export function validatePageCount(pdfPageCount: number): { valid: boolean; message?: string } {
  const finalBookPages = pdfPageCount + PRODIGI_BINDING_PAGES;
  
  if (finalBookPages < MIN_PAGES_FINAL_BOOK) {
    return { 
      valid: false, 
      message: `PDF has ${pdfPageCount} pages. Final book will have ${finalBookPages} pages (including Prodigi's ${PRODIGI_BINDING_PAGES} binding pages). Minimum ${MIN_PAGES_FINAL_BOOK} pages required.` 
    };
  }
  if (finalBookPages > MAX_PAGES_FINAL_BOOK) {
    return { 
      valid: false, 
      message: `PDF has ${pdfPageCount} pages. Final book will have ${finalBookPages} pages. Maximum ${MAX_PAGES_FINAL_BOOK} pages allowed.` 
    };
  }
  if (pdfPageCount % 2 !== 0) {
    return { 
      valid: true, 
      message: `PDF has odd page count (${pdfPageCount}). Even number recommended.` 
    };
  }
  return { valid: true };
}
