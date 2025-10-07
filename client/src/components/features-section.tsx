import { Card, CardContent } from "@/components/ui/card";

export default function FeaturesSection() {
  return (
    <section className="py-20 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">How It Works</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Create your personalized storybook in three simple steps
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Step 1 */}
          <div className="relative">
            <Card className="rounded-3xl p-8 hover:shadow-xl transition-shadow">
              <CardContent className="p-0">
                <div className="w-16 h-16 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center mb-6">
                  <i className="fas fa-pen-fancy text-white text-2xl"></i>
                </div>
                <div className="absolute top-4 right-4 w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                  <span className="text-primary font-bold">1</span>
                </div>
                <h3 className="text-xl font-bold mb-3">Describe Your Story</h3>
                <p className="text-muted-foreground">
                  Tell us about your story idea—characters, themes, and adventures. Be as creative as you want!
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Step 2 */}
          <div className="relative">
            <Card className="rounded-3xl p-8 hover:shadow-xl transition-shadow">
              <CardContent className="p-0">
                <div className="w-16 h-16 bg-gradient-to-br from-secondary to-accent rounded-2xl flex items-center justify-center mb-6">
                  <i className="fas fa-images text-white text-2xl"></i>
                </div>
                <div className="absolute top-4 right-4 w-10 h-10 bg-secondary/10 rounded-full flex items-center justify-center">
                  <span className="text-secondary font-bold">2</span>
                </div>
                <h3 className="text-xl font-bold mb-3">Upload Inspiration</h3>
                <p className="text-muted-foreground">
                  Add 1-5 photos for visual inspiration. The AI will use them to create a unique art style.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Step 3 */}
          <div className="relative">
            <Card className="rounded-3xl p-8 hover:shadow-xl transition-shadow">
              <CardContent className="p-0">
                <div className="w-16 h-16 bg-gradient-to-br from-accent to-primary rounded-2xl flex items-center justify-center mb-6">
                  <i className="fas fa-book-open text-white text-2xl"></i>
                </div>
                <div className="absolute top-4 right-4 w-10 h-10 bg-accent/10 rounded-full flex items-center justify-center">
                  <span className="text-accent font-bold">3</span>
                </div>
                <h3 className="text-xl font-bold mb-3">Get Your Storybook</h3>
                <p className="text-muted-foreground">
                  Watch the magic happen! Your illustrated storybook will be ready in just 2-3 minutes.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}
