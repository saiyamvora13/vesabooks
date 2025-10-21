import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Storybook } from "@shared/schema";

interface GalleryBook extends Storybook {
  author: string;
  averageRating: number | null;
  ratingCount: number;
  isSaved: boolean;
}

export default function StackedBookCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const autoRotateTimer = useRef<NodeJS.Timeout | null>(null);

  const { data, isLoading } = useQuery<{
    storybooks: GalleryBook[];
    totalCount: number;
  }>({
    queryKey: ["/api/gallery", 1],
    queryFn: async () => {
      const response = await fetch("/api/gallery?page=1&limit=5");
      if (!response.ok) throw new Error("Failed to fetch gallery");
      return response.json();
    },
  });

  const books = data?.storybooks.slice(0, 5) || [];

  const goToNext = useCallback(() => {
    if (books.length === 0) return;
    setCurrentIndex((prev) => (prev + 1) % books.length);
    setAnnouncement(`Showing book ${((currentIndex + 1) % books.length) + 1} of ${books.length}`);
  }, [books.length, currentIndex]);

  const goToPrev = useCallback(() => {
    if (books.length === 0) return;
    setCurrentIndex((prev) => (prev - 1 + books.length) % books.length);
    setAnnouncement(`Showing book ${((currentIndex - 1 + books.length) % books.length) + 1} of ${books.length}`);
  }, [books.length, currentIndex]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      goToPrev();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      goToNext();
    }
  }, [goToPrev, goToNext]);

  useEffect(() => {
    if (!isHovered && books.length > 1) {
      autoRotateTimer.current = setInterval(() => {
        goToNext();
      }, 4000);
    } else if (autoRotateTimer.current) {
      clearInterval(autoRotateTimer.current);
      autoRotateTimer.current = null;
    }

    return () => {
      if (autoRotateTimer.current) {
        clearInterval(autoRotateTimer.current);
      }
    };
  }, [isHovered, books.length, goToNext]);

  if (isLoading) {
    return (
      <div className="stacked-carousel-container" aria-live="polite" aria-busy="true">
        <div className="stacked-carousel-wrapper">
          <div className="stacked-book loading-book">
            <div className="book-3d">
              <div className="book-spine"></div>
              <div className="book-cover bg-muted animate-pulse"></div>
              <div className="book-pages"></div>
            </div>
          </div>
        </div>
        <span className="sr-only">Loading storybooks, please wait</span>
      </div>
    );
  }

  if (!books || books.length === 0) {
    return null;
  }

  return (
    <div 
      className="stacked-carousel-container"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="region"
      aria-label="Featured storybooks carousel"
      aria-roledescription="carousel"
    >
      <div 
        className="sr-only" 
        role="status" 
        aria-live="polite" 
        aria-atomic="true"
      >
        {announcement}
      </div>

      <div className="stacked-carousel-wrapper">
        {books.map((book, index) => {
          const position = (index - currentIndex + books.length) % books.length;
          const isActive = position === 0;
          
          return (
            <Link
              key={book.id}
              href={`/view/${book.id}`}
              className={`stacked-book stacked-book-${position}`}
              style={{
                zIndex: books.length - position,
                pointerEvents: isActive ? 'auto' : 'none',
              }}
              aria-label={`View "${book.title}" by ${book.author}`}
              aria-hidden={!isActive}
              tabIndex={isActive ? 0 : -1}
              data-testid={`carousel-book-${book.id}`}
            >
              <div className="book-3d">
                <div className="book-spine"></div>
                <div className="book-back"></div>
                
                <div className="book-cover">
                  {book.coverImageUrl ? (
                    <>
                      <img
                        src={book.coverImageUrl}
                        alt={`Cover of ${book.title}`}
                        className="book-cover-image"
                        loading="lazy"
                      />
                      <div className="cover-image-wrapper"></div>
                    </>
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center rounded-r-xl">
                      <span className="text-4xl font-bold text-primary/40">
                        {book.title.charAt(0)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="book-pages"></div>
                <div className="book-top"></div>
                <div className="book-bottom"></div>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="carousel-controls">
        <Button
          variant="outline"
          size="icon"
          onClick={goToPrev}
          className="carousel-button"
          aria-label="View previous storybook"
          data-testid="carousel-prev-button"
        >
          <ChevronLeft className="h-6 w-6" aria-hidden="true" />
        </Button>

        <div className="carousel-indicators" role="tablist" aria-label="Book carousel navigation">
          {books.map((book, index) => (
            <button
              key={book.id}
              className={`carousel-indicator ${index === currentIndex ? 'active' : ''}`}
              onClick={() => {
                setCurrentIndex(index);
                setAnnouncement(`Showing book ${index + 1} of ${books.length}`);
              }}
              aria-label={`Go to book ${index + 1}: ${book.title}`}
              aria-selected={index === currentIndex}
              role="tab"
              data-testid={`carousel-indicator-${index}`}
            />
          ))}
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={goToNext}
          className="carousel-button"
          aria-label="View next storybook"
          data-testid="carousel-next-button"
        >
          <ChevronRight className="h-6 w-6" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
