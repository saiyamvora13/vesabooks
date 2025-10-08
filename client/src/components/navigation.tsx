import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Menu, X } from "lucide-react";

export default function Navigation() {
  const [location] = useLocation();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-card/95 backdrop-blur-lg border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/">
            <div className="flex items-center space-x-2 sm:space-x-3 cursor-pointer" data-testid="link-home">
              <div className="w-9 h-9 sm:w-10 sm:h-10 gradient-bg rounded-xl flex items-center justify-center">
                <i className="fas fa-book-open text-white text-base sm:text-lg"></i>
              </div>
              <span className="text-lg sm:text-xl font-bold font-display gradient-text">StoryBook AI</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            <Link href="/">
              <span className={`text-foreground/70 hover:text-foreground transition-colors cursor-pointer font-medium ${location === '/' ? 'text-primary' : ''}`}>
                Home
              </span>
            </Link>
            <Link href="/create">
              <span className={`text-foreground/70 hover:text-foreground transition-colors cursor-pointer font-medium ${location === '/create' ? 'text-primary' : ''}`}>
                Create
              </span>
            </Link>
            {isAuthenticated && (
              <Link href="/library">
                <span className={`text-foreground/70 hover:text-foreground transition-colors cursor-pointer font-medium ${location === '/library' ? 'text-primary' : ''}`} data-testid="link-library">
                  My Library
                </span>
              </Link>
            )}
          </div>

          {/* Desktop CTA Buttons */}
          <div className="hidden md:flex items-center space-x-4">
            {!isLoading && !isAuthenticated && (
              <Button 
                onClick={() => window.location.href = '/api/login'}
                variant="outline"
                className="px-4 py-2 text-sm font-medium rounded-full"
                data-testid="button-login"
              >
                Log In
              </Button>
            )}
            
            {!isLoading && isAuthenticated && user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full hover:bg-muted" data-testid="button-user-menu">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={user.profileImageUrl || undefined} alt={user.firstName || user.email || "User"} style={{ objectFit: 'cover' }} />
                      <AvatarFallback className="gradient-bg !text-black">
                        {user.firstName?.[0] || user.email?.[0] || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none !text-foreground" data-testid="text-user-name">
                        {user.firstName && user.lastName 
                          ? `${user.firstName} ${user.lastName}` 
                          : user.firstName || user.email || 'User'}
                      </p>
                      {user.email && (
                        <p className="text-xs leading-none !text-foreground/60" data-testid="text-user-email">
                          {user.email}
                        </p>
                      )}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => window.location.href = '/api/logout'} data-testid="button-logout">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            
            <Link href="/create">
              <Button 
                className="px-4 py-2 text-sm font-medium rounded-full gradient-bg !text-black hover:opacity-90 transition-opacity"
                data-testid="button-get-started"
              >
                Get Started
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center space-x-2">
            {!isLoading && isAuthenticated && user && (
              <Avatar className="h-8 w-8">
                <AvatarImage src={user.profileImageUrl || undefined} alt={user.firstName || user.email || "User"} style={{ objectFit: 'cover' }} />
                <AvatarFallback className="gradient-bg !text-black text-xs">
                  {user.firstName?.[0] || user.email?.[0] || 'U'}
                </AvatarFallback>
              </Avatar>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="p-2 text-foreground"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              data-testid="button-mobile-menu"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-border">
            <div className="flex flex-col space-y-4">
              <Link href="/" onClick={() => setMobileMenuOpen(false)}>
                <div className={`text-base px-3 py-2 rounded-lg ${location === '/' ? 'bg-primary/10 text-primary font-medium' : 'text-foreground/70 font-medium'}`}>
                  Home
                </div>
              </Link>
              <Link href="/create" onClick={() => setMobileMenuOpen(false)}>
                <div className={`text-base px-3 py-2 rounded-lg ${location === '/create' ? 'bg-primary/10 text-primary font-medium' : 'text-foreground/70 font-medium'}`}>
                  Create Story
                </div>
              </Link>
              {isAuthenticated && (
                <Link href="/library" onClick={() => setMobileMenuOpen(false)}>
                  <div className={`text-base px-3 py-2 rounded-lg ${location === '/library' ? 'bg-primary/10 text-primary font-medium' : 'text-foreground/70 font-medium'}`} data-testid="link-library-mobile">
                    My Library
                  </div>
                </Link>
              )}
              
              <div className="pt-4 border-t border-border space-y-3">
                {!isLoading && !isAuthenticated ? (
                  <Button 
                    onClick={() => window.location.href = '/api/login'}
                    variant="outline"
                    className="w-full rounded-full"
                    data-testid="button-login-mobile"
                  >
                    Log In
                  </Button>
                ) : (
                  <Button 
                    onClick={() => window.location.href = '/api/logout'}
                    variant="outline"
                    className="w-full rounded-full"
                    data-testid="button-logout-mobile"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Log Out
                  </Button>
                )}
                
                <Link href="/create" onClick={() => setMobileMenuOpen(false)}>
                  <Button className="w-full rounded-full gradient-bg !text-black">
                    Get Started
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
