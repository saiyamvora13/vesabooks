import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
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
import { LogOut, Menu, X, ShoppingCart, ShoppingBag } from "lucide-react";
import { getCartCount } from "@/lib/cartUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useTranslation } from "react-i18next";

export default function Navigation() {
  const { t } = useTranslation();
  const [location, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setLocation("/");
    },
  });

  useEffect(() => {
    const updateCartCount = () => {
      setCartCount(getCartCount());
    };

    updateCartCount();

    window.addEventListener('storage', updateCartCount);
    window.addEventListener('cartUpdated', updateCartCount);

    return () => {
      window.removeEventListener('storage', updateCartCount);
      window.removeEventListener('cartUpdated', updateCartCount);
    };
  }, []);

  return (
    <nav className="sticky top-0 z-50 bg-card/95 backdrop-blur-lg border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/">
            <div className="flex items-center space-x-2 sm:space-x-3 cursor-pointer" data-testid="link-home">
              <div className="w-9 h-9 sm:w-10 sm:h-10 gradient-bg rounded-xl flex items-center justify-center">
                <i className="fas fa-book-open text-[hsl(258,90%,20%)] text-base sm:text-lg"></i>
              </div>
              <span className="text-lg sm:text-xl font-bold font-display gradient-text">StoryBook AI</span>
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
            {isAuthenticated && (
              <>
                <Link href="/library">
                  <span className={`text-foreground/70 hover:text-foreground transition-colors cursor-pointer font-medium ${location === '/library' ? 'text-primary' : ''}`} data-testid="link-library">
                    {t('navigation.myLibrary')}
                  </span>
                </Link>
                <Link href="/purchases">
                  <span className={`text-foreground/70 hover:text-foreground transition-colors cursor-pointer font-medium ${location === '/purchases' ? 'text-primary' : ''}`} data-testid="link-purchases">
                    {t('navigation.myPurchases')}
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
            <LanguageSwitcher />
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

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center space-x-2">
            {!isLoading && isAuthenticated && user && (
              <Avatar className="h-8 w-8">
                <AvatarImage src={user.profileImageUrl || undefined} alt={user.firstName || user.email || "User"} style={{ objectFit: 'cover' }} />
                <AvatarFallback className="gradient-bg !text-[hsl(258,90%,20%)] text-xs">
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
                  {t('navigation.home')}
                </div>
              </Link>
              <Link href="/create" onClick={() => setMobileMenuOpen(false)}>
                <div className={`text-base px-3 py-2 rounded-lg ${location === '/create' ? 'bg-primary/10 text-primary font-medium' : 'text-foreground/70 font-medium'}`}>
                  {t('navigation.createStory')}
                </div>
              </Link>
              {isAuthenticated && (
                <>
                  <Link href="/library" onClick={() => setMobileMenuOpen(false)}>
                    <div className={`text-base px-3 py-2 rounded-lg ${location === '/library' ? 'bg-primary/10 text-primary font-medium' : 'text-foreground/70 font-medium'}`} data-testid="link-library-mobile">
                      {t('navigation.myLibrary')}
                    </div>
                  </Link>
                  <Link href="/purchases" onClick={() => setMobileMenuOpen(false)}>
                    <div className={`text-base px-3 py-2 rounded-lg flex items-center ${location === '/purchases' ? 'bg-primary/10 text-primary font-medium' : 'text-foreground/70 font-medium'}`} data-testid="link-purchases">
                      <ShoppingBag className="h-5 w-5 mr-2" />
                      {t('navigation.myPurchases')}
                    </div>
                  </Link>
                </>
              )}
              <Link href="/cart" onClick={() => setMobileMenuOpen(false)}>
                <div className={`text-base px-3 py-2 rounded-lg flex items-center justify-between ${location === '/cart' ? 'bg-primary/10 text-primary font-medium' : 'text-foreground/70 font-medium'}`} data-testid="link-cart-mobile">
                  <span className="flex items-center">
                    <ShoppingCart className="h-5 w-5 mr-2" />
                    {t('navigation.cart')}
                  </span>
                  {cartCount > 0 && (
                    <Badge variant="destructive" className="ml-2" data-testid="badge-cart-count-mobile">
                      {cartCount}
                    </Badge>
                  )}
                </div>
              </Link>
              
              <div className="pt-4 border-t border-border space-y-3">
                <LanguageSwitcher />
                {!isLoading && !isAuthenticated ? (
                  <>
                    <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                      <Button 
                        variant="outline"
                        className="w-full rounded-full"
                        data-testid="button-login-mobile"
                      >
                        {t('navigation.logIn')}
                      </Button>
                    </Link>
                    <Link href="/signup" onClick={() => setMobileMenuOpen(false)}>
                      <Button 
                        variant="outline"
                        className="w-full rounded-full"
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
                    className="w-full rounded-full"
                    data-testid="button-logout-mobile"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    {t('navigation.logOut')}
                  </Button>
                )}
                
                <Link href="/create" onClick={() => setMobileMenuOpen(false)}>
                  <Button className="w-full rounded-full gradient-bg !text-[hsl(258,90%,20%)]">
                    {t('navigation.getStarted')}
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
