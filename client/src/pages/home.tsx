import Navigation from "@/components/navigation";
import HeroSection from "@/components/hero-section";
import FeaturesSection from "@/components/features-section";
import GalleryCarousel from "@/components/gallery-carousel";
import { SEO } from "@/components/SEO";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title="AI Storybook Builder - Create Personalized Children's Stories with AI"
        description="Create magical, personalized children's storybooks with AI-generated illustrations. Design unique stories in minutes with consistent characters and beautiful artwork."
        path="/"
      />
      <Navigation />
      <HeroSection />
      <FeaturesSection />
      <GalleryCarousel />
    </div>
  );
}
