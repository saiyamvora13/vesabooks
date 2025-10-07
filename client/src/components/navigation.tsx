import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";

export default function Navigation() {
  const [location] = useLocation();

  return (
    <nav className="sticky top-0 z-50 bg-card/80 backdrop-blur-lg border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/">
            <div className="flex items-center space-x-3 cursor-pointer" data-testid="link-home">
              <div className="w-10 h-10 gradient-bg rounded-xl flex items-center justify-center">
                <i className="fas fa-book-open text-white text-lg"></i>
              </div>
              <span className="text-xl font-bold font-display gradient-text">StoryBook AI</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            <Link href="/">
              <span className={`text-muted-foreground hover:text-foreground transition-colors cursor-pointer ${location === '/' ? 'text-foreground' : ''}`}>
                Home
              </span>
            </Link>
            <Link href="/create">
              <span className={`text-muted-foreground hover:text-foreground transition-colors cursor-pointer ${location === '/create' ? 'text-foreground' : ''}`}>
                Create
              </span>
            </Link>
          </div>

          {/* CTA Buttons */}
          <div className="flex items-center space-x-4">
            <Link href="/create">
              <Button 
                className="px-4 py-2 text-sm font-medium rounded-full gradient-bg hover:opacity-90 transition-opacity"
                data-testid="button-get-started"
              >
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
