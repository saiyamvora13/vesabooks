import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation, Trans } from "react-i18next";

interface Metrics {
  storiesCreated: number;
  activeUsers: number;
}

interface Storybook {
  id: string;
  title: string;
  pages: Array<{
    pageNumber: number;
    text: string;
    imageUrl: string;
  }>;
}

function AnimatedCounter({ value, duration = 1000 }: { value: number; duration?: number }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (value === 0) {
      setCount(0);
      return;
    }

    const startTime = Date.now();
    const endTime = startTime + duration;
    
    const timer = setInterval(() => {
      const now = Date.now();
      const progress = Math.min((now - startTime) / duration, 1);
      const currentCount = Math.floor(progress * value);
      
      setCount(currentCount);
      
      if (now >= endTime) {
        setCount(value);
        clearInterval(timer);
      }
    }, 16);

    return () => clearInterval(timer);
  }, [value, duration]);

  return <span>{count}</span>;
}

export default function HeroSection() {
  const { t } = useTranslation();
  const { data: metrics, isLoading } = useQuery<Metrics>({
    queryKey: ['/api/metrics'],
    staleTime: 60000, // 60 seconds cache
  });

  const { data: exampleBooks, isLoading: booksLoading } = useQuery<Storybook[]>({
    queryKey: ['/api/storybooks/examples'],
    staleTime: 300000, // 5 minutes cache
  });

  return (
    <section className="relative overflow-hidden py-12 sm:py-20 lg:py-32">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 right-0 w-64 h-64 sm:w-96 sm:h-96 bg-primary/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 sm:w-96 sm:h-96 bg-secondary/10 rounded-full blur-3xl"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-6 sm:gap-8 lg:gap-12 items-center">
          {/* Hero Content */}
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center space-x-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-primary/10 rounded-full mb-4 sm:mb-6">
              <i className="fas fa-sparkles text-primary text-sm"></i>
              <span className="text-xs sm:text-sm font-medium text-primary">Powered by Gen AI</span>
            </div>
            
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6 leading-tight">
              Create <span className="gradient-text">YOUR</span> Storybook in Minutes
            </h1>
            
            <p className="text-base sm:text-lg text-muted-foreground mb-6 sm:mb-8 max-w-xl mx-auto lg:mx-0">
              {t('home.hero.subtitle')}
            </p>

            {/* CTA Button */}
            <div className="flex justify-center lg:justify-start">
              <Link href="/create">
                <Button 
                  size="lg" 
                  className="px-8 py-4 rounded-full font-semibold text-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg hover:shadow-xl"
                  data-testid="button-create-story-hero"
                >
                  <i className="fas fa-magic mr-2"></i>
                  {t('home.hero.createStory')}
                </Button>
              </Link>
            </div>

            {/* Stats */}
            <div className="mt-8 sm:mt-12 grid grid-cols-3 gap-3 sm:gap-6">
              <div>
                <div className="text-2xl sm:text-3xl font-bold text-primary" data-testid="metric-stories">
                  {isLoading ? (
                    <Skeleton className="h-8 w-16 inline-block" />
                  ) : (
                    <AnimatedCounter value={metrics?.storiesCreated || 0} />
                  )}
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground">{t('home.hero.stats.storiesCreated')}</div>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-bold text-primary" data-testid="metric-users">
                  {isLoading ? (
                    <Skeleton className="h-8 w-16 inline-block" />
                  ) : (
                    <AnimatedCounter value={metrics?.activeUsers || 0} />
                  )}
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground">{t('home.hero.stats.activeUsers')}</div>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-bold text-primary" data-testid="metric-rating">
                  {t('home.hero.stats.rating')}
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground">{t('home.hero.stats.reviewPrompt')}</div>
              </div>
            </div>
          </div>

          {/* Example Storybooks Showcase */}
          <div className="relative mt-6 sm:mt-8 lg:mt-0">
            {booksLoading ? (
              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-64 w-full rounded-2xl" />
                <Skeleton className="h-64 w-full rounded-2xl" />
              </div>
            ) : exampleBooks && exampleBooks.length > 0 ? (
              <div className="relative">
                {/* Main featured book (larger) */}
                <div className="relative z-10">
                  <img 
                    src={exampleBooks[0].pages[0].imageUrl} 
                    alt={exampleBooks[0].title}
                    className="rounded-2xl sm:rounded-3xl shadow-2xl w-full object-cover aspect-[4/5]" 
                    loading="lazy"
                  />
                  {/* Top gradient overlay for title */}
                  <div className="absolute top-0 left-0 right-0 h-[25%] bg-gradient-to-b from-black/70 to-transparent rounded-t-2xl sm:rounded-t-3xl"></div>
                  {/* Bottom gradient overlay for author */}
                  <div className="absolute bottom-0 left-0 right-0 h-[20%] bg-gradient-to-t from-black/70 to-transparent rounded-b-2xl sm:rounded-b-3xl"></div>
                  {/* Title at top */}
                  <div className="absolute top-4 left-4 right-4">
                    <div className="text-sm sm:text-base font-bold text-white drop-shadow-[0_2px_3px_rgba(0,0,0,0.8)] truncate">{exampleBooks[0].title}</div>
                  </div>
                  {/* Author/label at bottom */}
                  <div className="absolute bottom-4 left-4 right-4">
                    <div className="text-xs sm:text-sm text-white drop-shadow-[0_2px_3px_rgba(0,0,0,0.8)]">AI Generated Storybook</div>
                  </div>
                </div>

                {/* Second book (overlapping, smaller) */}
                {exampleBooks[1] && (
                  <div className="absolute -right-4 top-8 w-1/2 z-0 hidden lg:block transform rotate-6 hover:rotate-0 transition-transform">
                    <img 
                      src={exampleBooks[1].pages[0].imageUrl} 
                      alt={exampleBooks[1].title}
                      className="rounded-xl shadow-xl w-full object-cover aspect-[4/5]" 
                      loading="lazy"
                    />
                  </div>
                )}

                {/* Third book (overlapping, smaller) */}
                {exampleBooks[2] && (
                  <div className="absolute -left-4 bottom-8 w-1/2 z-0 hidden lg:block transform -rotate-6 hover:rotate-0 transition-transform">
                    <img 
                      src={exampleBooks[2].pages[0].imageUrl} 
                      alt={exampleBooks[2].title}
                      className="rounded-xl shadow-xl w-full object-cover aspect-[4/5]" 
                      loading="lazy"
                    />
                  </div>
                )}

                {/* Floating cards */}
                <div className="absolute -top-4 -left-4 bg-card p-4 rounded-2xl shadow-xl animate-bounce-subtle hidden xl:block z-20">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 gradient-bg rounded-xl flex items-center justify-center">
                      <i className="fas fa-wand-magic-sparkles text-[hsl(258,90%,20%)]"></i>
                    </div>
                    <div>
                      <div className="text-sm font-semibold">AI Generated</div>
                      <div className="text-xs text-muted-foreground">In 2-3 minutes</div>
                    </div>
                  </div>
                </div>

                <div className="absolute -bottom-4 -right-4 bg-card p-4 rounded-2xl shadow-xl hidden xl:block z-20">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-accent to-primary rounded-xl flex items-center justify-center">
                      <i className="fas fa-palette text-[hsl(258,90%,20%)]"></i>
                    </div>
                    <div>
                      <div className="text-sm font-semibold">Custom Art</div>
                      <div className="text-xs text-muted-foreground">Your style</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl sm:rounded-3xl shadow-2xl w-full aspect-[4/5] bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                <div className="text-center p-8">
                  <i className="fas fa-book-open text-6xl text-primary mb-4"></i>
                  <p className="text-muted-foreground">Create your first storybook!</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
