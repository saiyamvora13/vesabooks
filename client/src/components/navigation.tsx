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
import { LogOut, User } from "lucide-react";

export default function Navigation() {
  const [location] = useLocation();
  const { user, isAuthenticated, isLoading } = useAuth();

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
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full" data-testid="button-user-menu">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={user.profileImageUrl || undefined} alt={user.firstName || user.email || "User"} style={{ objectFit: 'cover' }} />
                      <AvatarFallback className="gradient-bg text-white">
                        {user.firstName?.[0] || user.email?.[0] || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none" data-testid="text-user-name">
                        {user.firstName && user.lastName 
                          ? `${user.firstName} ${user.lastName}` 
                          : user.firstName || user.email || 'User'}
                      </p>
                      {user.email && (
                        <p className="text-xs leading-none text-muted-foreground" data-testid="text-user-email">
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
