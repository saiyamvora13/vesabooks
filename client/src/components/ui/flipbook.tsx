import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface FlipbookPage {
  pageNumber: number;
  text: string;
  imageUrl: string;
}

interface FlipbookProps {
  pages: FlipbookPage[];
  title: string;
  className?: string;
  "data-testid"?: string;
}

export function Flipbook({ pages, title, className, "data-testid": testId }: FlipbookProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && currentPage > 0) {
        setCurrentPage(currentPage - 1);
      } else if (e.key === "ArrowRight" && currentPage < pages.length - 1) {
        setCurrentPage(currentPage + 1);
      } else if (e.key === "f" || e.key === "F") {
        setIsFullscreen(true);
      } else if (e.key === "Escape") {
        setIsFullscreen(false);
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [currentPage, pages.length]);

  const goToPage = (pageIndex: number) => {
    setCurrentPage(pageIndex);
  };

  const nextPage = () => {
    if (currentPage < pages.length - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const previousPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const FlipbookContent = ({ isFullscreenMode = false }) => (
    <div className={cn("space-y-6", className)} data-testid={testId}>
      {/* Book Display Area */}
      <div className="relative aspect-[16/10] bg-muted/20 rounded-2xl overflow-hidden">
        {/* Current Page */}
        <div className="absolute inset-0 flex items-center justify-center">
          <img
            src={pages[currentPage]?.imageUrl}
            alt={`${title} page ${currentPage + 1}`}
            className="max-h-full max-w-full object-contain rounded-xl shadow-2xl"
            loading="lazy"
            data-testid={`img-page-${currentPage + 1}`}
          />
        </div>

        {/* Navigation Controls */}
        <Button
          onClick={previousPage}
          disabled={currentPage === 0}
          className={cn(
            "absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full shadow-lg",
            "bg-card/90 backdrop-blur hover:bg-primary hover:text-primary-foreground",
            currentPage === 0 && "opacity-50 cursor-not-allowed"
          )}
          data-testid="button-previous-page"
        >
          <i className="fas fa-chevron-left"></i>
        </Button>

        <Button
          onClick={nextPage}
          disabled={currentPage === pages.length - 1}
          className={cn(
            "absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full shadow-lg",
            "bg-card/90 backdrop-blur hover:bg-primary hover:text-primary-foreground",
            currentPage === pages.length - 1 && "opacity-50 cursor-not-allowed"
          )}
          data-testid="button-next-page"
        >
          <i className="fas fa-chevron-right"></i>
        </Button>

        {/* Fullscreen Button */}
        {!isFullscreenMode && (
          <Button
            onClick={() => setIsFullscreen(true)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-card/90 backdrop-blur hover:bg-primary hover:text-primary-foreground shadow-lg"
            data-testid="button-fullscreen"
          >
            <i className="fas fa-expand"></i>
          </Button>
        )}
      </div>

      {/* Page Navigation */}
      <div className="flex items-center justify-between">
        {/* Page Indicator */}
        <div className="flex items-center space-x-2">
          <span className="text-sm text-muted-foreground">Page</span>
          <span className="text-lg font-bold" data-testid="text-current-page">{currentPage + 1}</span>
          <span className="text-sm text-muted-foreground">of {pages.length}</span>
        </div>

        {/* Thumbnail Navigation */}
        <div className="flex space-x-2 overflow-x-auto">
          {pages.map((page, index) => (
            <Button
              key={page.pageNumber}
              onClick={() => goToPage(index)}
              className={cn(
                "w-16 h-20 p-0 rounded-lg overflow-hidden border-2 flex-shrink-0",
                currentPage === index 
                  ? "border-primary shadow-lg" 
                  : "border-border hover:border-primary"
              )}
              data-testid={`button-page-thumbnail-${index + 1}`}
            >
              <img
                src={page.imageUrl}
                alt={`Page ${page.pageNumber}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </Button>
          ))}
        </div>

        {/* Reading Progress */}
        <div className="hidden sm:flex items-center space-x-2">
          <i className="fas fa-book-open text-primary"></i>
          <span className="text-sm text-muted-foreground">
            {Math.round(((currentPage + 1) / pages.length) * 100)}%
          </span>
        </div>
      </div>

      {/* Keyboard Hints */}
      <div className="pt-6 border-t border-border flex flex-wrap gap-4 justify-center text-sm text-muted-foreground">
        <div className="flex items-center space-x-2">
          <kbd className="px-2 py-1 bg-muted rounded text-xs">←</kbd>
          <span>Previous</span>
        </div>
        <div className="flex items-center space-x-2">
          <kbd className="px-2 py-1 bg-muted rounded text-xs">→</kbd>
          <span>Next</span>
        </div>
        <div className="flex items-center space-x-2">
          <kbd className="px-2 py-1 bg-muted rounded text-xs">F</kbd>
          <span>Fullscreen</span>
        </div>
        <div className="flex items-center space-x-2">
          <kbd className="px-2 py-1 bg-muted rounded text-xs">ESC</kbd>
          <span>Exit</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <FlipbookContent />
      
      {/* Story Text */}
      <div className="mt-8 bg-card rounded-3xl p-8 border">
        <h3 className="text-xl font-bold mb-4" data-testid="text-page-title">
          Page {currentPage + 1}: {pages[currentPage]?.text.split('.')[0]}
        </h3>
        <p className="text-lg leading-relaxed text-muted-foreground" data-testid="text-page-content">
          {pages[currentPage]?.text}
        </p>
      </div>

      {/* Fullscreen Modal */}
      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent className="max-w-7xl w-full h-full max-h-screen p-6 bg-black/95">
          <div className="h-full">
            <FlipbookContent isFullscreenMode={true} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
