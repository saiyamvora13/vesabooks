import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, Maximize2, Minimize2, Info } from 'lucide-react';
import { Button } from './button';
import { Progress } from './progress';

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
  backCoverImageUrl?: string;
  isOwner?: boolean;
  onRegeneratePage?: (pageNumber: number) => void;
  regeneratingPageNumber?: number | null;
  onPageChange?: (pageNumber: number) => void;
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
    className={`absolute top-0 left-0 w-full h-full overflow-hidden ${className}`}
    style={{
      backfaceVisibility: 'hidden',
      transform: isBack ? 'rotateY(180deg)' : 'rotateY(0deg)',
      background: 'linear-gradient(135deg, #f9f7f3 0%, #faf8f5 50%, #f7f5f1 100%)',
    }}
  >
    {children}
  </div>
);

const Cover = ({ title, author, coverImageUrl }: { title: string; author: string; coverImageUrl?: string }) => {
  const [imageError, setImageError] = useState(false);
  const showOverlays = !coverImageUrl || imageError;

  return (
    <div className="w-full h-full bg-slate-700 dark:bg-slate-800 rounded-r-lg shadow-2xl flex flex-col text-center relative overflow-hidden">
      {coverImageUrl && !imageError && (
        <img 
          src={coverImageUrl} 
          alt="Story cover" 
          className="absolute inset-0 w-full h-full object-contain" 
          loading="lazy"
          onError={() => setImageError(true)}
        />
      )}
      {showOverlays && (
        <>
          {/* Fallback: Show title/author overlays if no cover image or image failed to load */}
          <div className="absolute top-0 left-0 right-0 h-[25%] bg-gradient-to-b from-black/70 to-transparent"></div>
          <div className="absolute bottom-0 left-0 right-0 h-[25%] bg-gradient-to-t from-black/70 to-transparent"></div>
          <div className="absolute top-0 left-0 right-0 p-4 flex flex-col items-center justify-center h-[25%]">
            <h1 className="text-3xl md:text-4xl font-bold font-serif text-white drop-shadow-[0_2px_3px_rgba(0,0,0,0.8)]">{title}</h1>
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-4 flex items-center justify-center h-[15%]">
            <p className="text-md md:text-lg text-white drop-shadow-[0_2px_3px_rgba(0,0,0,0.8)]">By {author}</p>
          </div>
        </>
      )}
      <div className="absolute left-[-24px] top-0 bottom-0 w-6 bg-gradient-to-r from-slate-800 to-slate-600 shadow-md"></div>
    </div>
  );
};

const ImagePage = ({ 
  page, 
  pageNum,
  isOwner,
  onRegeneratePage,
  isRegenerating,
  isMobile = false,
  zoom = 1,
  position = { x: 0, y: 0 }
}: { 
  page: StoryPage; 
  pageNum: number;
  isOwner?: boolean;
  onRegeneratePage?: (pageNumber: number) => void;
  isRegenerating?: boolean;
  isMobile?: boolean;
  zoom?: number;
  position?: { x: number; y: number };
}) => (
  <div className="w-full h-full relative group overflow-hidden">
    {page.imageUrl ? (
      <img 
        src={page.imageUrl} 
        alt={`Illustration for page ${pageNum}`} 
        className="w-full h-full object-contain md:object-cover transition-transform duration-200" 
        loading="lazy"
        style={{
          transform: `scale(${zoom}) translate(${position.x}px, ${position.y}px)`
        }}
      />
    ) : (
      <div className="w-full h-full flex items-center justify-center p-4 bg-slate-100 dark:bg-slate-800">
        <p className="text-muted-foreground">Missing image</p>
      </div>
    )}
    {isOwner && onRegeneratePage && (
      <div className={`absolute ${isMobile ? 'bottom-2 right-2 opacity-100' : 'top-2 right-2 opacity-0 group-hover:opacity-100'} transition-opacity z-20`}>
        <Button
          size={isMobile ? "default" : "sm"}
          variant="secondary"
          onClick={(e) => {
            e.stopPropagation();
            onRegeneratePage(page.pageNumber);
          }}
          disabled={isRegenerating}
          data-testid={`button-regenerate-page-${page.pageNumber}`}
          className={`shadow-lg ${isMobile ? 'min-h-[48px] min-w-[48px] px-4' : ''}`}
        >
          <RefreshCw className={`${isMobile ? 'w-5 h-5' : 'w-4 h-4'} ${isMobile ? '' : 'mr-1'} ${isRegenerating ? 'animate-spin' : ''}`} />
          {isMobile ? '' : (isRegenerating ? 'Regenerating...' : 'Regenerate')}
        </Button>
      </div>
    )}
  </div>
);

const TextPage = ({ 
  page, 
  author, 
  pageNum, 
  onTurn,
  isOwner,
  onRegeneratePage,
  isRegenerating,
  isMobile = false
}: { 
  page: StoryPage; 
  author: string; 
  pageNum: number; 
  onTurn: () => void;
  isOwner?: boolean;
  onRegeneratePage?: (pageNumber: number) => void;
  isRegenerating?: boolean;
  isMobile?: boolean;
}) => (
  <div 
    className={`w-full h-full flex flex-col ${isMobile ? 'p-6' : 'justify-center p-8 md:p-12'} relative cursor-pointer group`}
    onClick={onTurn}
    style={{
      background: 'linear-gradient(135deg, #f9f7f3 0%, #faf8f5 50%, #f7f5f1 100%)',
    }}
  >
    <div className={`absolute top-4 ${isMobile ? 'right-6' : 'right-8'} text-xs text-slate-500 tracking-widest uppercase font-serif`}>{author}</div>
    <div className={`overflow-y-auto ${isMobile ? 'flex-1 mt-8 mb-16' : 'max-w-2xl mx-auto'} scrollbar-thin scrollbar-thumb-slate-300`}>
      <p 
        className={`text-slate-800 dark:text-slate-200 ${
          isMobile 
            ? 'text-base leading-relaxed' 
            : 'text-lg md:text-xl leading-loose'
        } tracking-wide first-letter:text-5xl ${
          isMobile ? '' : 'md:first-letter:text-7xl'
        } first-letter:font-serif first-letter:text-slate-900 dark:first-letter:text-slate-100 first-letter:mr-2 first-letter:float-left first-letter:leading-[0.9]`}
        style={{ 
          fontFamily: '"EB Garamond", "Merriweather", Georgia, serif',
          textAlign: 'justify',
          hyphens: 'auto',
          fontSize: isMobile ? '17px' : undefined,
          lineHeight: isMobile ? '1.8' : undefined
        }}
      >
        {page.text}
      </p>
    </div>
    {isOwner && onRegeneratePage && (
      <div className={`absolute ${isMobile ? 'bottom-2 right-2 opacity-100' : 'top-2 right-2 opacity-0 group-hover:opacity-100'} transition-opacity z-10`}>
        <Button
          size={isMobile ? "default" : "sm"}
          variant="secondary"
          onClick={(e) => {
            e.stopPropagation();
            onRegeneratePage(page.pageNumber);
          }}
          disabled={isRegenerating}
          data-testid={`button-regenerate-page-${page.pageNumber}`}
          className={`shadow-lg ${isMobile ? 'min-h-[48px] min-w-[48px] px-4' : ''}`}
        >
          <RefreshCw className={`${isMobile ? 'w-5 h-5' : 'w-4 h-4'} ${isMobile ? '' : 'mr-1'} ${isRegenerating ? 'animate-spin' : ''}`} />
          {isMobile ? '' : (isRegenerating ? 'Regenerating...' : 'Regenerate')}
        </Button>
      </div>
    )}
    {!isMobile && (
      <div className="absolute bottom-6 right-6 w-16 h-16 bg-gradient-to-tl from-amber-100/30 to-transparent rounded-full pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
    )}
    <span className={`absolute bottom-4 ${isMobile ? 'left-6' : 'right-8'} text-sm font-serif text-slate-600`}>
      {pageNum}
    </span>
  </div>
);

const EndPage = ({ totalPages, backCoverImageUrl }: { totalPages: number; backCoverImageUrl?: string }) => {
  if (backCoverImageUrl) {
    return (
      <div className="w-full h-full relative">
        <img 
          src={backCoverImageUrl} 
          alt="Story back cover" 
          className="w-full h-full object-cover" 
          loading="lazy"
        />
        {totalPages > 0 && (
          <span className="absolute bottom-4 left-8 text-sm font-serif text-slate-600 bg-white/80 px-2 py-1 rounded">
            {totalPages}
          </span>
        )}
      </div>
    );
  }

  return (
    <div 
      className="w-full h-full flex flex-col items-center justify-center p-4 relative"
      style={{
        background: 'linear-gradient(135deg, #f9f7f3 0%, #faf8f5 50%, #f7f5f1 100%)',
      }}
    >
      <p 
        className="text-3xl md:text-4xl text-slate-800"
        style={{ fontFamily: '"EB Garamond", "Merriweather", Georgia, serif' }}
      >
        The End
      </p>
      {totalPages > 0 && (
        <span className="absolute bottom-4 left-8 text-sm font-serif text-slate-600">
          {totalPages}
        </span>
      )}
    </div>
  );
};

export function FlipbookViewer({ pages, title, author = "AI Author", coverImageUrl, backCoverImageUrl, isOwner = false, onRegeneratePage, regeneratingPageNumber, onPageChange }: FlipbookViewerProps) {
  const numPages = pages.length;
  const numSheets = numPages + 1;
  const [currentPage, setCurrentPage] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSwipeHint, setShowSwipeHint] = useState(true);
  const [imageZoom, setImageZoom] = useState(1);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [isPinching, setIsPinching] = useState(false);
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const touchEndY = useRef<number>(0);
  const pinchStartDistance = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Call onPageChange callback when page changes
  useEffect(() => {
    if (onPageChange && currentPage >= 0) {
      onPageChange(currentPage);
    }
  }, [currentPage, onPageChange]);

  const totalMobilePages = (pages.length * 2) + 1; // cover + (text + image) per story page
  const maxPage = isMobile ? totalMobilePages : numSheets;
  
  const goToPrevPage = useCallback(() => setCurrentPage((p) => Math.max(0, p - 1)), []);
  const goToNextPage = useCallback(() => setCurrentPage((p) => Math.min(p + 1, maxPage)), [maxPage]);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'ArrowLeft') goToPrevPage();
    if (event.key === 'ArrowRight') goToNextPage();
  }, [goToPrevPage, goToNextPage]);

  // Toggle fullscreen mode
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(err => {
        console.error('Error attempting to enable fullscreen:', err);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      });
    }
  }, []);

  // Provide haptic feedback when available
  const provideHapticFeedback = useCallback(() => {
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
  }, []);

  // Calculate distance between two touch points (for pinch-to-zoom)
  const getTouchDistance = (touches: React.TouchList): number => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
      setIsPinching(false);
    } else if (e.touches.length === 2) {
      setIsPinching(true);
      pinchStartDistance.current = getTouchDistance(e.touches);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isPinching && e.touches.length === 2) {
      const currentDistance = getTouchDistance(e.touches);
      const scale = currentDistance / pinchStartDistance.current;
      const newZoom = Math.min(Math.max(1, imageZoom * scale), 3);
      setImageZoom(newZoom);
      pinchStartDistance.current = currentDistance;
    } else if (!isPinching && e.touches.length === 1) {
      touchEndX.current = e.touches[0].clientX;
      touchEndY.current = e.touches[0].clientY;
    }
  };

  const handleTouchEnd = () => {
    if (!isPinching) {
      const swipeDistanceX = touchStartX.current - touchEndX.current;
      const swipeDistanceY = touchStartY.current - touchEndY.current;
      const minSwipeDistance = 50;
      
      // Only process horizontal swipes if vertical movement is minimal
      if (Math.abs(swipeDistanceX) > minSwipeDistance && Math.abs(swipeDistanceY) < 30) {
        if (swipeDistanceX > 0) {
          goToNextPage();
          provideHapticFeedback();
        } else {
          goToPrevPage();
          provideHapticFeedback();
        }
      }
    }
    
    setIsPinching(false);
    setImageZoom(1);
    setImagePosition({ x: 0, y: 0 });
  };

  // Hide swipe hint after first interaction
  useEffect(() => {
    if (currentPage > 0 && showSwipeHint) {
      setShowSwipeHint(false);
    }
  }, [currentPage, showSwipeHint]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const bookSheets = useMemo(() => {
    const sheets = [];

    sheets.push({
      front: <Cover title={title} author={author} coverImageUrl={coverImageUrl} />,
      back: pages.length > 0 ? (
        <ImagePage 
          page={pages[0]} 
          pageNum={1} 
          isOwner={isOwner}
          onRegeneratePage={onRegeneratePage}
          isRegenerating={regeneratingPageNumber === pages[0].pageNumber}
        />
      ) : <EndPage totalPages={0} backCoverImageUrl={backCoverImageUrl} />,
    });

    for (let i = 0; i < numPages; i++) {
      const page = pages[i];
      const frontContent = (
        <TextPage 
          page={page} 
          author={author} 
          pageNum={i + 1} 
          onTurn={goToNextPage}
          isOwner={isOwner}
          onRegeneratePage={onRegeneratePage}
          isRegenerating={regeneratingPageNumber === page.pageNumber}
        />
      );
      const backContent = (i < numPages - 1)
        ? (
          <ImagePage 
            page={pages[i + 1]} 
            pageNum={i + 2}
            isOwner={isOwner}
            onRegeneratePage={onRegeneratePage}
            isRegenerating={regeneratingPageNumber === pages[i + 1].pageNumber}
          />
        )
        : <EndPage totalPages={numPages * 2} backCoverImageUrl={backCoverImageUrl} />;

      sheets.push({ front: frontContent, back: backContent });
    }

    return sheets;
  }, [pages, title, author, coverImageUrl, backCoverImageUrl, goToNextPage, numPages, isOwner, onRegeneratePage, regeneratingPageNumber]);

  const isBookOpen = currentPage > 0;

  const pageDisplayText = useMemo(() => {
    if (currentPage === 0) return "Cover";
    
    if (isMobile) {
      // Mobile single-page display
      if (currentPage >= totalMobilePages) return "The End";
      const pageIndex = currentPage - 1;
      const storyPageIndex = Math.floor(pageIndex / 2);
      if (storyPageIndex >= pages.length) return "The End";
      
      const isTextPage = pageIndex % 2 === 1;
      const pageNum = storyPageIndex + 1;
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
      
      // Calculate which actual page we're on (alternating between image and text)
      const pageIndex = currentPage - 1;
      const isTextPage = pageIndex % 2 === 1;
      const storyPageIndex = Math.floor(pageIndex / 2);
      
      if (storyPageIndex >= pages.length) {
        return <EndPage totalPages={numPages * 2} backCoverImageUrl={backCoverImageUrl} />;
      }
      
      const page = pages[storyPageIndex];
      
      if (isTextPage) {
        // Show text page
        return (
          <TextPage 
            page={page} 
            author={author} 
            pageNum={storyPageIndex + 1} 
            onTurn={goToNextPage}
            isOwner={isOwner}
            onRegeneratePage={onRegeneratePage}
            isRegenerating={regeneratingPageNumber === page.pageNumber}
            isMobile={true}
          />
        );
      } else {
        // Show image page
        return (
          <ImagePage 
            page={page} 
            pageNum={storyPageIndex + 1}
            isOwner={isOwner}
            onRegeneratePage={onRegeneratePage}
            isRegenerating={regeneratingPageNumber === page.pageNumber}
            isMobile={true}
            zoom={imageZoom}
            position={imagePosition}
          />
        );
      }
    };

    const progressPercentage = (currentPage / totalMobilePages) * 100;
    const actualPageNum = Math.floor((currentPage - 1) / 2) + 1;
    const totalPageCount = Math.ceil(pages.length);

    return (
      <div ref={containerRef} className={`w-full h-full flex flex-col ${isFullscreen ? 'fixed inset-0 z-50 bg-black' : ''}`}>
        {/* Top Controls Bar */}
        <div className={`flex items-center justify-between p-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm ${isFullscreen ? 'absolute top-0 left-0 right-0 z-50' : ''}`}>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200" data-testid="text-page-counter">
              {currentPage === 0 ? 'Cover' : currentPage >= totalMobilePages ? 'The End' : `${actualPageNum} of ${totalPageCount}`}
            </span>
          </div>
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            aria-label={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            data-testid="button-fullscreen-toggle"
          >
            {isFullscreen ? (
              <Minimize2 className="w-5 h-5 text-slate-700 dark:text-slate-200" />
            ) : (
              <Maximize2 className="w-5 h-5 text-slate-700 dark:text-slate-200" />
            )}
          </button>
        </div>

        {/* Main Content Area */}
        <div 
          className={`flex-1 relative ${isFullscreen ? 'mt-14' : ''}`}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-full h-full relative bg-white dark:bg-slate-900 overflow-hidden">
            {getCurrentPageContent()}
          </div>

          {/* Swipe Hint (shows only on first page) */}
          {showSwipeHint && currentPage === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-black/60 text-white px-4 py-2 rounded-full flex items-center gap-2 animate-pulse">
                <ChevronLeft className="w-4 h-4" />
                <span className="text-sm">Swipe to read</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </div>
          )}
        </div>

        {/* Bottom Navigation Bar */}
        <div className={`${isFullscreen ? 'absolute bottom-0 left-0 right-0' : ''} bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm`}>
          {/* Progress Bar */}
          <div className="h-1 bg-slate-200 dark:bg-slate-700">
            <div 
              className="h-full bg-primary transition-all duration-300 ease-out"
              style={{ width: `${progressPercentage}%` }}
              data-testid="progress-bar"
            />
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center justify-between p-4">
            <button
              onClick={() => {
                goToPrevPage();
                provideHapticFeedback();
              }}
              disabled={currentPage === 0}
              className="min-w-[60px] min-h-[48px] px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center"
              aria-label="Previous Page"
              data-testid="button-previous-page-mobile"
            >
              <ChevronLeft className="w-6 h-6 text-slate-700 dark:text-slate-200" />
            </button>

            <div className="flex-1 text-center">
              <span className="text-lg font-bold text-slate-700 dark:text-slate-200" aria-live="polite" data-testid="text-page-display">
                {pageDisplayText}
              </span>
              {currentPage > 0 && currentPage < totalMobilePages && (
                <p className="text-xs text-muted-foreground mt-1">Swipe or tap to navigate</p>
              )}
            </div>

            <button
              onClick={() => {
                goToNextPage();
                provideHapticFeedback();
              }}
              disabled={currentPage >= totalMobilePages}
              className="min-w-[60px] min-h-[48px] px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center"
              aria-label="Next Page"
              data-testid="button-next-page-mobile"
            >
              <ChevronRight className="w-6 h-6 text-slate-700 dark:text-slate-200" />
            </button>
          </div>
        </div>
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
