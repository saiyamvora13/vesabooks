import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface StoryPage {
  pageNumber: number;
  text: string;
  imageUrl: string;
}

interface FlipbookViewerProps {
  pages: StoryPage[];
  title: string;
  author?: string;
  coverImageUrl?: string;
}

const PageFace = ({ 
  className = '', 
  isBack = false, 
  children 
}: {
  className?: string;
  isBack?: boolean;
  children: React.ReactNode;
}) => (
  <div
    className={`absolute top-0 left-0 w-full h-full bg-white dark:bg-slate-900 overflow-hidden ${className}`}
    style={{
      backfaceVisibility: 'hidden',
      transform: isBack ? 'rotateY(180deg)' : 'rotateY(0deg)',
    }}
  >
    {children}
  </div>
);

const Cover = ({ title, author, coverImageUrl }: { title: string; author: string; coverImageUrl?: string }) => (
  <div className="w-full h-full bg-slate-700 dark:bg-slate-800 rounded-r-lg shadow-2xl flex flex-col text-center relative overflow-hidden">
    {coverImageUrl && (
      <img 
        src={coverImageUrl} 
        alt="Story cover" 
        className="absolute inset-0 w-full h-full object-cover" 
      />
    )}
    <div className="absolute inset-0 w-full h-full bg-black/10"></div>
    <div className="absolute bottom-0 left-0 right-0 p-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm">
      <h1 className="text-3xl md:text-4xl font-bold font-serif text-slate-800 dark:text-white">{title}</h1>
      <p className="text-md md:text-lg text-slate-600 dark:text-slate-300 mt-2">By {author}</p>
    </div>
    <div className="absolute left-[-24px] top-0 bottom-0 w-6 bg-gradient-to-r from-slate-800 to-slate-600 shadow-md"></div>
  </div>
);

const ImagePage = ({ page, pageNum }: { page: StoryPage; pageNum: number }) => (
  <div className="w-full h-full relative">
    {page.imageUrl ? (
      <img 
        src={page.imageUrl} 
        alt={`Illustration for page ${pageNum}`} 
        className="w-full h-full object-cover" 
      />
    ) : (
      <div className="w-full h-full flex items-center justify-center p-4 bg-slate-100 dark:bg-slate-800">
        <p className="text-muted-foreground">Missing image</p>
      </div>
    )}
    <span className="absolute bottom-4 left-8 text-base font-semibold text-slate-800 bg-white/60 backdrop-blur-sm rounded-full px-3 py-1 shadow-sm">
      {pageNum}
    </span>
  </div>
);

const TextPage = ({ 
  page, 
  author, 
  pageNum, 
  onTurn 
}: { 
  page: StoryPage; 
  author: string; 
  pageNum: number; 
  onTurn: () => void;
}) => (
  <div 
    className="w-full h-full flex flex-col justify-center p-8 md:p-12 relative cursor-pointer group bg-white dark:bg-slate-900" 
    onClick={onTurn}
  >
    <div className="absolute top-4 right-8 text-xs text-slate-400 tracking-widest uppercase">{author}</div>
    <div className="overflow-y-auto">
      <p className="text-slate-700 dark:text-slate-200 text-base md:text-lg leading-relaxed first-letter:text-7xl first-letter:font-serif first-letter:text-slate-900 dark:first-letter:text-white first-letter:mr-3 first-letter:float-left">
        {page.text}
      </p>
    </div>
    <div className="absolute bottom-6 right-6 w-16 h-16 bg-gradient-to-tl from-slate-200/50 to-transparent rounded-full pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
    <span className="absolute bottom-4 right-8 text-base font-semibold text-slate-700 dark:text-slate-300">
      {pageNum}
    </span>
  </div>
);

const EndPage = ({ totalPages }: { totalPages: number }) => (
  <div className="w-full h-full flex flex-col items-center justify-center p-4 relative bg-white dark:bg-slate-900">
    <p className="font-serif text-2xl md:text-3xl text-slate-800 dark:text-white">The End</p>
    {totalPages > 0 && (
      <span className="absolute bottom-4 left-8 text-base font-semibold text-slate-700 dark:text-slate-300">
        {totalPages}
      </span>
    )}
  </div>
);

export function FlipbookViewer({ pages, title, author = "AI Author", coverImageUrl }: FlipbookViewerProps) {
  const numPages = pages.length;
  const numSheets = numPages + 1;
  const [currentPage, setCurrentPage] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const totalMobilePages = (pages.length * 2) + 1; // cover + (text + image) per story page
  const maxPage = isMobile ? totalMobilePages : numSheets;
  
  const goToPrevPage = useCallback(() => setCurrentPage((p) => Math.max(0, p - 1)), []);
  const goToNextPage = useCallback(() => setCurrentPage((p) => Math.min(p + 1, maxPage)), [maxPage]);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'ArrowLeft') goToPrevPage();
    if (event.key === 'ArrowRight') goToNextPage();
  }, [goToPrevPage, goToNextPage]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    const swipeDistance = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 50;

    if (Math.abs(swipeDistance) > minSwipeDistance) {
      if (swipeDistance > 0) {
        goToNextPage();
      } else {
        goToPrevPage();
      }
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const bookSheets = useMemo(() => {
    const sheets = [];

    sheets.push({
      front: <Cover title={title} author={author} coverImageUrl={coverImageUrl} />,
      back: pages.length > 0 ? <ImagePage page={pages[0]} pageNum={2} /> : <EndPage totalPages={0} />,
    });

    for (let i = 0; i < numPages; i++) {
      const page = pages[i];
      const frontContent = <TextPage page={page} author={author} pageNum={2 * i + 1} onTurn={goToNextPage} />;
      const backContent = (i < numPages - 1)
        ? <ImagePage page={pages[i + 1]} pageNum={2 * (i + 1) + 2} />
        : <EndPage totalPages={numPages * 2} />;

      sheets.push({ front: frontContent, back: backContent });
    }

    return sheets;
  }, [pages, title, author, coverImageUrl, goToNextPage, numPages]);

  const isBookOpen = currentPage > 0;

  const pageDisplayText = useMemo(() => {
    if (currentPage === 0) return "Cover";
    
    if (isMobile) {
      // Mobile single-page display
      if (currentPage >= totalMobilePages) return "The End";
      const pageIndex = currentPage - 1;
      const storyPageIndex = Math.floor(pageIndex / 2);
      if (storyPageIndex >= pages.length) return "The End";
      
      const isTextPage = pageIndex % 2 === 0;
      const pageNum = storyPageIndex * 2 + (isTextPage ? 1 : 2);
      return `Page ${pageNum}`;
    } else {
      // Desktop dual-page display
      if (currentPage > 0 && currentPage <= numPages) {
        const firstPage = (currentPage - 1) * 2 + 1;
        const secondPage = firstPage + 1;
        return `Pages ${firstPage} - ${secondPage}`;
      }
      return "The End";
    }
  }, [currentPage, numPages, isMobile, pages.length, totalMobilePages]);

  if (isMobile) {
    // Single page view for mobile - shows one page at a time
    const getCurrentPageContent = () => {
      if (currentPage === 0) {
        return <Cover title={title} author={author} coverImageUrl={coverImageUrl} />;
      }
      
      // Calculate which actual page we're on (alternating between text and image)
      const pageIndex = currentPage - 1;
      const isTextPage = pageIndex % 2 === 0;
      const storyPageIndex = Math.floor(pageIndex / 2);
      
      if (storyPageIndex >= pages.length) {
        return <EndPage totalPages={numPages * 2} />;
      }
      
      const page = pages[storyPageIndex];
      
      if (isTextPage) {
        // Show text page
        return <TextPage page={page} author={author} pageNum={storyPageIndex * 2 + 1} onTurn={goToNextPage} />;
      } else {
        // Show image page
        return <ImagePage page={page} pageNum={storyPageIndex * 2 + 2} />;
      }
    };

    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-3">
        <div 
          className="w-full h-[75vh] relative"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-full h-full relative bg-white dark:bg-slate-900 rounded-lg shadow-2xl overflow-hidden">
            {getCurrentPageContent()}
          </div>
        </div>

        <div className="flex items-center justify-center gap-3 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg">
          <button
            onClick={goToPrevPage}
            disabled={currentPage === 0}
            className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Previous Page"
            data-testid="button-previous-page"
          >
            <ChevronLeft className="w-7 h-7 text-slate-700 dark:text-slate-200" />
          </button>
          <span className="text-slate-700 dark:text-slate-200 font-semibold w-28 text-center text-sm" aria-live="polite" data-testid="text-page-indicator">
            {pageDisplayText}
          </span>
          <button
            onClick={goToNextPage}
            disabled={currentPage >= totalMobilePages}
            className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Next Page"
            data-testid="button-next-page"
          >
            <ChevronRight className="w-7 h-7 text-slate-700 dark:text-slate-200" />
          </button>
        </div>

        <p className="text-xs text-muted-foreground">Swipe to turn pages</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-4">
      <div
        className="w-[90vw] h-[60vh] md:w-[800px] md:h-[500px] lg:w-[1000px] lg:h-[600px] relative"
        style={{ perspective: '3000px' }}
      >
        <div
          className="w-full h-full relative transition-transform duration-1000 ease-in-out"
          style={{
            transformStyle: 'preserve-3d',
            transform: `translateX(${isBookOpen ? '0' : '-25%'}) scale(${isBookOpen ? 1 : 0.95})`,
          }}
        >
          <div className="absolute top-0 left-0 w-full h-full" style={{ transformStyle: 'preserve-3d' }}>
            {bookSheets.map((sheet, index) => {
              const isFlipped = currentPage > index;
              const zIndex = isFlipped ? index + 1 : numSheets - index;

              return (
                <div
                  key={index}
                  className="absolute top-0 left-1/2 w-1/2 h-full"
                  style={{
                    transformStyle: 'preserve-3d',
                    transformOrigin: 'left center',
                    transform: isFlipped ? 'rotateY(-180deg)' : 'rotateY(0deg)',
                    transition: 'transform 0.7s ease-in-out',
                    zIndex: zIndex,
                  }}
                >
                  <PageFace className="rounded-r-lg shadow-[-8px_0_15px_-10px_rgba(0,0,0,0.2)]">
                    {sheet.front}
                  </PageFace>
                  <PageFace isBack className="rounded-l-lg shadow-[inset_8px_0_15px_-10px_rgba(0,0,0,0.3)]">
                    {sheet.back}
                  </PageFace>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 md:gap-4 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm p-3 rounded-full shadow-lg">
        <button
          onClick={goToPrevPage}
          disabled={currentPage === 0}
          className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Previous Page"
          data-testid="button-previous-page"
        >
          <ChevronLeft className="w-8 h-8 text-slate-700 dark:text-slate-200" />
        </button>
        <span className="text-slate-700 dark:text-slate-200 font-bold w-28 text-center" aria-live="polite" data-testid="text-page-indicator">
          {pageDisplayText}
        </span>
        <button
          onClick={goToNextPage}
          disabled={currentPage >= numSheets}
          className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Next Page"
          data-testid="button-next-page"
        >
          <ChevronRight className="w-8 h-8 text-slate-700 dark:text-slate-200" />
        </button>
      </div>
    </div>
  );
}
