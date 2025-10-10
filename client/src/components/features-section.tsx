import { Card, CardContent } from "@/components/ui/card";
import { useTranslation } from "react-i18next";

export default function FeaturesSection() {
  const { t } = useTranslation();
  
  return (
    <section className="py-20 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">{t('home.features.title')}</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('home.features.subtitle')}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Step 1 */}
          <div className="relative">
            <Card className="rounded-3xl p-8 hover:shadow-xl transition-shadow">
              <CardContent className="p-0">
                <div className="w-16 h-16 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center mb-6 animate-float-slow relative">
                  <i className="fas fa-lightbulb text-[hsl(258,90%,20%)] text-2xl animate-pulse-slow"></i>
                  <span className="absolute -top-1 -right-1 text-yellow-300 text-sm">✨</span>
                </div>
                <div className="absolute top-4 right-4 w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                  <span className="text-primary font-bold">1</span>
                </div>
                <h3 className="text-xl font-bold mb-3">{t('home.features.step1.title')}</h3>
                <p className="text-muted-foreground">
                  {t('home.features.step1.description')}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Step 2 */}
          <div className="relative">
            <Card className="rounded-3xl p-8 hover:shadow-xl transition-shadow">
              <CardContent className="p-0">
                <div className="w-16 h-16 bg-gradient-to-br from-secondary to-accent rounded-2xl flex items-center justify-center mb-6 animate-float-slow relative" style={{ animationDelay: '0.5s' }}>
                  <i className="fas fa-wand-sparkles text-[hsl(258,90%,20%)] text-2xl animate-sparkle"></i>
                  <span className="absolute top-0 right-0 text-yellow-300 text-xs animate-ping">⭐</span>
                </div>
                <div className="absolute top-4 right-4 w-10 h-10 bg-secondary/10 rounded-full flex items-center justify-center">
                  <span className="text-secondary font-bold">2</span>
                </div>
                <h3 className="text-xl font-bold mb-3">{t('home.features.step2.title')}</h3>
                <p className="text-muted-foreground">
                  {t('home.features.step2.description')}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Step 3 */}
          <div className="relative">
            <Card className="rounded-3xl p-8 hover:shadow-xl transition-shadow">
              <CardContent className="p-0">
                <div className="w-16 h-16 bg-gradient-to-br from-accent to-primary rounded-2xl flex items-center justify-center mb-6 animate-float-slow relative" style={{ animationDelay: '1s' }}>
                  <i className="fas fa-book-open text-[hsl(258,90%,20%)] text-2xl animate-wiggle"></i>
                  <span className="absolute bottom-0 right-0 text-yellow-300 text-sm animate-bounce">💫</span>
                </div>
                <div className="absolute top-4 right-4 w-10 h-10 bg-accent/10 rounded-full flex items-center justify-center">
                  <span className="text-accent font-bold">3</span>
                </div>
                <h3 className="text-xl font-bold mb-3">{t('home.features.step3.title')}</h3>
                <p className="text-muted-foreground">
                  {t('home.features.step3.description')}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}
