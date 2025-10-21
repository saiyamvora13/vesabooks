import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight } from "lucide-react";
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

  // Get first 5 books
  const books = data?.storybooks.slice(0, 5) || [];

  if (isLoading) {
    return (
      <section className="py-20 bg-gradient-to-b from-background to-muted/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              {t('home.examples.title')}
            </h2>
            <p className="text-lg text-muted-foreground">
              Loading amazing stories...
            </p>
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

        <div className="relative">
          {/* Carousel */}
          <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex gap-8">
              {books.map((book) => (
                <div
                  key={book.id}
                  className="flex-[0_0_100%] min-w-0 sm:flex-[0_0_50%] lg:flex-[0_0_33.333%]"
                >
                  <Link href={`/view/${book.id}`}>
                    <div className="book-3d-container group cursor-pointer">
                      {/* 3D Book */}
                      <div className="book-3d">
                        {/* Book Spine */}
                        <div className="book-spine"></div>
                        
                        {/* Book Cover */}
                        <div className="book-cover">
                          {book.coverImageUrl ? (
                            <img
                              src={book.coverImageUrl}
                              alt={`Cover of ${book.title}`}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                              <span className="text-4xl">📚</span>
                            </div>
                          )}
                        </div>

                        {/* Book Pages (side view) */}
                        <div className="book-pages"></div>
                      </div>

                      {/* Book Info */}
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

          {/* Navigation Arrows */}
          <Button
            variant="outline"
            size="icon"
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 sm:-translate-x-12 z-10 rounded-full bg-background/80 backdrop-blur-sm shadow-lg hover:bg-background disabled:opacity-30"
            onClick={scrollPrev}
            disabled={!canScrollPrev}
            data-testid="carousel-prev"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 sm:translate-x-12 z-10 rounded-full bg-background/80 backdrop-blur-sm shadow-lg hover:bg-background disabled:opacity-30"
            onClick={scrollNext}
            disabled={!canScrollNext}
            data-testid="carousel-next"
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        </div>
      </div>
    </section>
  );
}
