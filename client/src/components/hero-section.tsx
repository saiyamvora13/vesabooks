import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "react-i18next";
import StackedBookCarousel from "@/components/stacked-book-carousel";

interface Metrics {
  storiesCreated: number;
  activeUsers: number;
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
              <span className="text-xs sm:text-sm font-medium text-primary">{t('home.hero.poweredByGenAI')}</span>
            </div>
            
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6 leading-tight">
              {t('home.hero.mainTitle')}
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

          {/* Stacked Book Carousel */}
          <div className="relative mt-6 sm:mt-8 lg:mt-0">
            <StackedBookCarousel />
          </div>
        </div>
      </div>
    </section>
  );
}
