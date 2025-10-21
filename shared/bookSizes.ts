// Professional hardcover book size specifications
// Based on Prodigi hardcover photo book specifications

export type BookOrientation = 'portrait' | 'landscape' | 'square';

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
  'us-letter-landscape': {
    id: 'us-letter-landscape',
    name: '8.5" × 11" Landscape',
    orientation: 'landscape',
    widthMM: 280,
    heightMM: 216,
    widthInches: 11.0,
    heightInches: 8.5,
  },
  'us-letter-portrait': {
    id: 'us-letter-portrait',
    name: '8.5" × 11" Portrait',
    orientation: 'portrait',
    widthMM: 216,
    heightMM: 280,
    widthInches: 8.5,
    heightInches: 11.0,
  },
  'square-small': {
    id: 'square-small',
    name: '8.3" × 8.3" Square',
    orientation: 'square',
    widthMM: 210,
    heightMM: 210,
    widthInches: 8.3,
    heightInches: 8.3,
  },
  'square-large': {
    id: 'square-large',
    name: '11.6" × 11.6" Square',
    orientation: 'square',
    widthMM: 294,
    heightMM: 294,
    widthInches: 11.6,
    heightInches: 11.6,
  },
};

// Default book size
export const DEFAULT_BOOK_SIZE = BOOK_SIZES['a5-portrait'];

// Safety margin (10mm from edge as per specifications)
export const SAFETY_MARGIN_MM = 10;
export const SAFETY_MARGIN_POINTS = SAFETY_MARGIN_MM * MM_TO_POINTS;

// Required specifications
export const REQUIRED_DPI = 300;
export const COLOR_PROFILE = 'RGB';
export const MIN_PAGES = 24;
export const MAX_PAGES = 300;

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

// Validate page count
export function validatePageCount(pageCount: number): { valid: boolean; message?: string } {
  if (pageCount < MIN_PAGES) {
    return { valid: false, message: `Minimum ${MIN_PAGES} pages required for professional printing` };
  }
  if (pageCount > MAX_PAGES) {
    return { valid: false, message: `Maximum ${MAX_PAGES} pages allowed` };
  }
  if (pageCount % 2 !== 0) {
    return { valid: true, message: `Odd page count (${pageCount}). Even number recommended for professional printing` };
  }
  return { valid: true };
}
