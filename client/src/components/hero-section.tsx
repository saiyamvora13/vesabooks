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
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Hero Content */}
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center space-x-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-primary/10 rounded-full mb-4 sm:mb-6">
              <i className="fas fa-sparkles text-primary text-sm"></i>
              <span className="text-xs sm:text-sm font-medium text-primary">{t('home.hero.badge')}</span>
            </div>
            
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6 leading-tight">
              <Trans 
                i18nKey="home.hero.title"
                components={{ gradient: <span className="gradient-text" /> }}
              />
            </h1>
            
            <p className="text-base sm:text-lg text-muted-foreground mb-6 sm:mb-8 max-w-xl mx-auto lg:mx-0">
              {t('home.hero.subtitle')}
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center lg:justify-start">
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
              <Button 
                variant="outline"
                size="lg"
                className="px-8 py-4 rounded-full font-semibold text-lg border-2 hover:border-primary transition-colors"
                data-testid="button-watch-demo"
              >
                <i className="fas fa-play-circle mr-2"></i>
                {t('home.hero.watchDemo')}
              </Button>
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

          {/* Hero Image */}
          <div className="relative mt-8 lg:mt-0">
            <img 
              src="https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600" 
              alt="Children reading storybook" 
              className="rounded-2xl sm:rounded-3xl shadow-2xl w-full" 
            />
            
            {/* Floating cards */}
            <div className="absolute -top-4 -left-4 bg-card p-4 rounded-2xl shadow-xl animate-bounce-subtle hidden lg:block">
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

            <div className="absolute -bottom-4 -right-4 bg-card p-4 rounded-2xl shadow-xl hidden lg:block">
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
        </div>
      </div>
    </section>
  );
}
