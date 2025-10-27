import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Menu, X, ShoppingCart, Package } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useTranslation } from "react-i18next";
import type { CartItem } from "@shared/schema";
import logoImage from "@/assets/logo.png";

export default function Navigation() {
  const { t } = useTranslation();
  const [location, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.removeQueries({ queryKey: ['/api/cart'] });
      setLocation("/");
      setMobileMenuOpen(false);
    },
  });

  // Fetch cart count from database
  const { data: cartResponse } = useQuery<{ items: CartItem[] }>({
    queryKey: ['/api/cart'],
    enabled: isAuthenticated,
  });

  const cartItems = cartResponse?.items || [];
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <>
      {/* Mobile menu backdrop */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}
      
      <nav className="sticky top-0 z-50 bg-card/95 backdrop-blur-lg border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
          {/* Logo - Optimized for mobile */}
          <Link href="/">
            <div className="flex items-center space-x-2 cursor-pointer" data-testid="link-home">
              <img 
                src={logoImage} 
                alt="StoryBook AI Logo" 
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl"
              />
              <span className="text-base sm:text-xl font-bold font-display gradient-text">StoryBook AI</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            <Link href="/">
              <span className={`text-foreground/70 hover:text-foreground transition-colors cursor-pointer font-medium ${location === '/' ? 'text-primary' : ''}`}>
                {t('navigation.home')}
              </span>
            </Link>
            <Link href="/create">
              <span className={`text-foreground/70 hover:text-foreground transition-colors cursor-pointer font-medium ${location === '/create' ? 'text-primary' : ''}`}>
                {t('navigation.create')}
              </span>
            </Link>
            <Link href="/gallery">
              <span className={`text-foreground/70 hover:text-foreground transition-colors cursor-pointer font-medium ${location === '/gallery' ? 'text-primary' : ''}`} data-testid="link-gallery">
                Gallery
              </span>
            </Link>
            {isAuthenticated && (
              <>
                <Link href="/library">
                  <span className={`text-foreground/70 hover:text-foreground transition-colors cursor-pointer font-medium ${location === '/library' ? 'text-primary' : ''}`} data-testid="link-library">
                    {t('navigation.myLibrary')}
                  </span>
                </Link>
                <Link href="/orders">
                  <span className={`text-foreground/70 hover:text-foreground transition-colors cursor-pointer font-medium ${location === '/orders' ? 'text-primary' : ''}`} data-testid="link-orders">
                    My Orders
                  </span>
                </Link>
              </>
            )}
            <Link href="/cart">
              <div className="relative cursor-pointer" data-testid="link-cart">
                <ShoppingCart className={`h-5 w-5 ${location === '/cart' ? 'text-primary' : 'text-foreground/70 hover:text-foreground'} transition-colors`} />
                {cartCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
                    data-testid="badge-cart-count"
                  >
                    {cartCount}
                  </Badge>
                )}
              </div>
            </Link>
          </div>

          {/* Desktop CTA Buttons */}
          <div className="hidden md:flex items-center space-x-4">
            <LanguageSwitcher testId="language-switcher-desktop" />
            {!isLoading && !isAuthenticated && (
              <>
                <Link href="/login">
                  <Button 
                    variant="outline"
                    className="px-4 py-2 text-sm font-medium rounded-full"
                    data-testid="button-login"
                  >
                    {t('navigation.logIn')}
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button 
                    variant="outline"
                    className="px-4 py-2 text-sm font-medium rounded-full"
                    data-testid="button-signup"
                  >
                    {t('navigation.signUp')}
                  </Button>
                </Link>
              </>
            )}
            
            {!isLoading && isAuthenticated && user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full hover:bg-muted" data-testid="button-user-menu">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={user.profileImageUrl || undefined} alt={user.firstName || user.email || "User"} style={{ objectFit: 'cover' }} />
                      <AvatarFallback className="gradient-bg !text-[hsl(258,90%,20%)]">
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
                  <DropdownMenuItem onClick={() => logoutMutation.mutate()} data-testid="button-logout">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>{t('navigation.logOut')}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            
            <Link href="/create">
              <Button 
                className="px-4 py-2 text-sm font-medium rounded-full gradient-bg !text-[hsl(258,90%,20%)] hover:opacity-90 transition-opacity"
                data-testid="button-get-started"
              >
                {t('navigation.getStarted')}
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Button - Optimized touch targets */}
          <div className="flex md:hidden items-center gap-3">
            {!isLoading && isAuthenticated && user && (
              <Avatar className="h-9 w-9">
                <AvatarImage src={user.profileImageUrl || undefined} alt={user.firstName || user.email || "User"} style={{ objectFit: 'cover' }} />
                <AvatarFallback className="gradient-bg !text-[hsl(258,90%,20%)] text-xs">
                  {user.firstName?.[0] || user.email?.[0] || 'U'}
                </AvatarFallback>
              </Avatar>
            )}
            <Button
              variant="ghost"
              className="h-11 w-11 p-0 flex items-center justify-center text-gray-900 dark:text-gray-100 hover:bg-accent/10 transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              data-testid="button-mobile-menu"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {mobileMenuOpen ? <X className="h-7 w-7 text-gray-900 dark:text-gray-100" /> : <Menu className="h-7 w-7 text-gray-900 dark:text-gray-100" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu - Optimized for touch */}
        <div 
          className={`md:hidden border-t border-border bg-card/95 backdrop-blur-lg transition-all duration-300 ease-in-out overflow-hidden ${
            mobileMenuOpen ? 'max-h-screen opacity-100 py-5' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="flex flex-col gap-2 px-4">
            <Link href="/" onClick={() => setMobileMenuOpen(false)}>
              <div className={`text-base px-4 py-3.5 rounded-xl transition-colors active:scale-[0.98] ${
                location === '/' ? 'bg-primary/10 text-primary font-semibold' : 'text-foreground/70 font-medium hover:bg-accent/5'
              }`}>
                {t('navigation.home')}
              </div>
            </Link>
            <Link href="/create" onClick={() => setMobileMenuOpen(false)}>
              <div className={`text-base px-4 py-3.5 rounded-xl transition-colors active:scale-[0.98] ${
                location === '/create' ? 'bg-primary/10 text-primary font-semibold' : 'text-foreground/70 font-medium hover:bg-accent/5'
              }`}>
                {t('navigation.createStory')}
              </div>
            </Link>
            <Link href="/gallery" onClick={() => setMobileMenuOpen(false)}>
              <div className={`text-base px-4 py-3.5 rounded-xl transition-colors active:scale-[0.98] ${
                location === '/gallery' ? 'bg-primary/10 text-primary font-semibold' : 'text-foreground/70 font-medium hover:bg-accent/5'
              }`} data-testid="link-gallery-mobile">
                Gallery
              </div>
            </Link>
            {isAuthenticated && (
              <>
                <Link href="/library" onClick={() => setMobileMenuOpen(false)}>
                  <div className={`text-base px-4 py-3.5 rounded-xl transition-colors active:scale-[0.98] ${
                    location === '/library' ? 'bg-primary/10 text-primary font-semibold' : 'text-foreground/70 font-medium hover:bg-accent/5'
                  }`} data-testid="link-library-mobile">
                    {t('navigation.myLibrary')}
                  </div>
                </Link>
                <Link href="/orders" onClick={() => setMobileMenuOpen(false)}>
                  <div className={`text-base px-4 py-3.5 rounded-xl flex items-center transition-colors active:scale-[0.98] ${
                    location === '/orders' ? 'bg-primary/10 text-primary font-semibold' : 'text-foreground/70 font-medium hover:bg-accent/5'
                  }`} data-testid="link-orders-mobile">
                    <Package className="h-5 w-5 mr-3" />
                    My Orders
                  </div>
                </Link>
              </>
            )}
            <Link href="/cart" onClick={() => setMobileMenuOpen(false)}>
              <div className={`text-base px-4 py-3.5 rounded-xl flex items-center justify-between transition-colors active:scale-[0.98] ${
                location === '/cart' ? 'bg-primary/10 text-primary font-semibold' : 'text-foreground/70 font-medium hover:bg-accent/5'
              }`} data-testid="link-cart-mobile">
                <span className="flex items-center">
                  <ShoppingCart className="h-5 w-5 mr-3" />
                  {t('navigation.cart')}
                </span>
                {cartCount > 0 && (
                  <Badge variant="destructive" className="ml-2" data-testid="badge-cart-count-mobile">
                    {cartCount}
                  </Badge>
                )}
              </div>
            </Link>
            
            <div className="pt-4 mt-2 border-t border-border space-y-3">
              <div className="px-2">
                <LanguageSwitcher testId="language-switcher-mobile" />
              </div>
              {!isLoading && !isAuthenticated ? (
                <>
                  <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                    <Button 
                      variant="outline"
                      className="w-full h-12 rounded-full text-base font-medium"
                      data-testid="button-login-mobile"
                    >
                      {t('navigation.logIn')}
                    </Button>
                  </Link>
                  <Link href="/signup" onClick={() => setMobileMenuOpen(false)}>
                    <Button 
                      variant="outline"
                      className="w-full h-12 rounded-full text-base font-medium"
                      data-testid="button-signup-mobile"
                    >
                      {t('navigation.signUp')}
                    </Button>
                  </Link>
                </>
              ) : (
                <Button 
                  onClick={() => logoutMutation.mutate()}
                  variant="outline"
                  className="w-full h-12 rounded-full text-base font-medium"
                  data-testid="button-logout-mobile"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  {t('navigation.logOut')}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
    </>
  );
}
