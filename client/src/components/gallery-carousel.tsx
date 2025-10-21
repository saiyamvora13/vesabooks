import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import useEmblaCarousel from "embla-carousel-react";
import { useCallback, useEffect, useState } from "react";
import type { Storybook } from "@shared/schema";

interface GalleryBook extends Storybook {
  author: string;
  averageRating: number | null;
  ratingCount: number;
  isSaved: boolean;
}

export default function GalleryCarousel() {
  const { t } = useTranslation();
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "center",
    loop: true,
    skipSnaps: false,
    containScroll: "trimSnaps",
  });

  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const { data, isLoading } = useQuery<{
    storybooks: GalleryBook[];
    totalCount: number;
  }>({
    queryKey: ["/api/gallery", 1],
    queryFn: async () => {
      const response = await fetch("/api/gallery?page=1");
      if (!response.ok) throw new Error("Failed to fetch gallery");
      return response.json();
    },
  });

  const scrollPrev = useCallback(() => {
    if (emblaApi) emblaApi.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    if (emblaApi) emblaApi.scrollNext();
  }, [emblaApi]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, onSelect]);

  const books = data?.storybooks.slice(0, 5) || [];

  if (isLoading) {
    return (
      <section 
        className="py-20 bg-gradient-to-b from-background to-muted/20"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              {t('home.examples.title')}
            </h2>
            <p className="text-lg text-muted-foreground">
              Loading amazing stories...
            </p>
            <span className="sr-only">Loading gallery content, please wait</span>
          </div>
        </div>
      </section>
    );
  }

  if (!books || books.length === 0) {
    return null;
  }

  return (
    <section className="py-20 bg-gradient-to-b from-background to-muted/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            {t('home.examples.title')}
          </h2>
          <p className="text-lg text-muted-foreground">
            {t('home.examples.subtitle')}
          </p>
        </div>

        <div 
          className="relative"
          role="region"
          aria-label="Featured storybooks carousel"
          aria-roledescription="carousel"
        >
          <div className="overflow-hidden" ref={emblaRef} aria-live="polite">
            <div className="flex gap-8">
              {books.map((book) => (
                <div
                  key={book.id}
                  className="flex-[0_0_100%] min-w-0 sm:flex-[0_0_50%] lg:flex-[0_0_33.333%]"
                  role="group"
                  aria-label={`Storybook ${books.indexOf(book) + 1} of ${books.length}`}
                >
                  <Link 
                    href={`/view/${book.id}`}
                    aria-label={`View "${book.title}" by ${book.author}`}
                    className="focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-lg block"
                    data-testid={`link-storybook-${book.id}`}
                  >
                    <div className="book-3d-container group cursor-pointer">
                      <div className="book-3d">
                        <div className="book-spine"></div>
                        
                        <div className="book-cover">
                          {book.coverImageUrl ? (
                            <img
                              src={book.coverImageUrl}
                              alt={`Cover of ${book.title}`}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div 
                              className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center"
                              role="img"
                              aria-label="Placeholder book cover"
                            >
                              <BookOpen className="w-16 h-16 text-primary/40" aria-hidden="true" />
                              <span className="sr-only">No cover image available</span>
                            </div>
                          )}
                        </div>

                        <div className="book-pages"></div>
                      </div>

                      <div className="mt-6 text-center">
                        <h3 className="text-lg font-bold mb-1 line-clamp-2">
                          {book.title}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          by {book.author}
                        </p>
                      </div>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          </div>

          <Button
            variant="outline"
            size="icon"
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 sm:-translate-x-12 z-10 rounded-full bg-background/80 backdrop-blur-sm shadow-lg hover:bg-background disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            onClick={scrollPrev}
            disabled={!canScrollPrev}
            aria-label="View previous storybook"
            data-testid="carousel-prev"
          >
            <ChevronLeft className="h-6 w-6" aria-hidden="true" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 sm:translate-x-12 z-10 rounded-full bg-background/80 backdrop-blur-sm shadow-lg hover:bg-background disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            onClick={scrollNext}
            disabled={!canScrollNext}
            aria-label="View next storybook"
            data-testid="carousel-next"
          >
            <ChevronRight className="h-6 w-6" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </section>
  );
}
