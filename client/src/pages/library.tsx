import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import Navigation from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Calendar, Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Storybook {
  id: string;
  title: string;
  prompt: string;
  pages: Array<{ pageNumber: number; text: string; imageUrl: string }>;
  createdAt: string;
  shareUrl: string | null;
}

export default function Library() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const { data: storybooks, isLoading, error } = useQuery<Storybook[]>({
    queryKey: ["/api/storybooks"],
    enabled: isAuthenticated,
  });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Loading...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center py-20">
            <BookOpen className="mx-auto h-16 w-16 text-muted-foreground mb-6" />
            <h2 className="text-3xl font-bold mb-4">Please Log In</h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              You need to be logged in to view your storybook library.
            </p>
            <Button onClick={() => window.location.href = '/api/login'} data-testid="button-login">
              Log In
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-6 sm:py-8 lg:py-12">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold font-display gradient-text mb-2" data-testid="text-library-title">
              My Storybooks
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground" data-testid="text-storybook-count">
              {storybooks?.length || 0} storybook{storybooks?.length === 1 ? '' : 's'} created
            </p>
          </div>
          
          <Link href="/create">
            <Button className="gradient-bg hover:opacity-90 w-full sm:w-auto" data-testid="button-create-new">
              <Plus className="mr-2 h-4 w-4" />
              Create New
            </Button>
          </Link>
        </div>

        {error ? (
          <div className="text-center py-20">
            <BookOpen className="mx-auto h-16 w-16 text-destructive mb-6" />
            <h2 className="text-2xl font-semibold mb-4" data-testid="text-error-title">
              Failed to load storybooks
            </h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto" data-testid="text-error-message">
              {error instanceof Error ? error.message : 'An unexpected error occurred. Please try again later.'}
            </p>
            <Button onClick={() => window.location.reload()} variant="outline" data-testid="button-retry">
              Try Again
            </Button>
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="h-48 w-full" />
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : storybooks && storybooks.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {storybooks.map((storybook) => (
              <Card 
                key={storybook.id} 
                className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
                data-testid={`card-storybook-${storybook.id}`}
              >
                <Link href={`/view/${storybook.id}`}>
                  <div className="relative h-48 bg-gradient-to-br from-primary/20 to-secondary/20 overflow-hidden">
                    {storybook.pages[0]?.imageUrl ? (
                      <img 
                        src={storybook.pages[0].imageUrl} 
                        alt={storybook.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        data-testid={`img-cover-${storybook.id}`}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <BookOpen className="h-16 w-16 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                </Link>
                
                <CardHeader>
                  <CardTitle className="line-clamp-1" data-testid={`text-title-${storybook.id}`}>
                    {storybook.title}
                  </CardTitle>
                  <CardDescription className="line-clamp-2" data-testid={`text-prompt-${storybook.id}`}>
                    {storybook.prompt}
                  </CardDescription>
                </CardHeader>
                
                <CardFooter className="flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span data-testid={`text-date-${storybook.id}`}>
                      {formatDistanceToNow(new Date(storybook.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <Link href={`/view/${storybook.id}`}>
                    <Button variant="ghost" size="sm" data-testid={`button-view-${storybook.id}`}>
                      View
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <BookOpen className="mx-auto h-16 w-16 text-muted-foreground mb-6" />
            <h2 className="text-2xl font-semibold mb-4" data-testid="text-empty-state">
              No storybooks yet
            </h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              Start creating magical storybooks with AI. Your imagination is the only limit!
            </p>
            <Link href="/create">
              <Button className="gradient-bg hover:opacity-90" data-testid="button-create-first">
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Storybook
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
