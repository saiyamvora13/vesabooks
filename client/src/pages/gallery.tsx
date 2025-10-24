import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Helmet } from "react-helmet-async";
import Navigation from "@/components/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, Eye, Share2, ChevronLeft, ChevronRight, Bookmark } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface GalleryStorybook {
  id: string;
  title: string;
  coverImageUrl: string;
  author: string;
  averageRating: number | null;
  ratingCount: number;
  viewCount: string;
  shareCount: string;
  isSaved: boolean;
}

interface GalleryResponse {
  storybooks: GalleryStorybook[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
}

export default function Gallery() {
  const [, setLocation] = useLocation();
  const [page, setPage] = useState(1);
  const { user } = useAuth();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<GalleryResponse>({
    queryKey: ['/api/gallery', page],
    queryFn: async () => {
      const response = await fetch(`/api/gallery?page=${page}`);
      if (!response.ok) {
        throw new Error('Failed to fetch gallery');
      }
      return response.json();
    },
  });

  // Save storybook mutation
  const saveMutation = useMutation({
    mutationFn: async (storybookId: string) => {
      return apiRequest('POST', `/api/storybooks/${storybookId}/save`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gallery'] });
      queryClient.invalidateQueries({ queryKey: ['/api/storybooks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/storybooks/saved'] });
      toast({
        title: "Saved to Library",
        description: "Storybook has been saved to your library",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save storybook",
        variant: "destructive",
      });
    },
  });

  // Unsave storybook mutation
  const unsaveMutation = useMutation({
    mutationFn: async (storybookId: string) => {
      return apiRequest('DELETE', `/api/storybooks/${storybookId}/save`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gallery'] });
      queryClient.invalidateQueries({ queryKey: ['/api/storybooks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/storybooks/saved'] });
      toast({
        title: "Removed from Library",
        description: "Storybook has been removed from your library",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove storybook",
        variant: "destructive",
      });
    },
  });

  const handleViewStorybook = (id: string) => {
    setLocation(`/view/${id}`);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleSave = (e: React.MouseEvent, storybookId: string, isSaved: boolean) => {
    e.stopPropagation(); // Prevent card click
    
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to save storybooks to your library",
      });
      return;
    }

    if (isSaved) {
      unsaveMutation.mutate(storybookId);
    } else {
      saveMutation.mutate(storybookId);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <Helmet>
        <title>Public Gallery - AI Storybook Builder</title>
        <meta name="description" content="Discover amazing AI-generated storybooks created by our community. Browse through a collection of creative stories for all ages." />
        <meta name="keywords" content="AI storybooks, children's books, story gallery, creative stories, AI-generated content" />
      </Helmet>
      <Navigation />

      <section className="py-12 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4" data-testid="text-gallery-title">
              Public Gallery
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Discover amazing AI-generated storybooks created by our community
            </p>
          </div>

          {/* Gallery Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
              {[...Array(8)].map((_, i) => (
                <Card key={i} className="overflow-hidden">
                  <Skeleton className="aspect-[3/4] w-full" />
                  <CardContent className="p-3 sm:p-4 space-y-2">
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-2/3" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : data && data.storybooks.length > 0 ? (
            <>
              <div className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                {data.storybooks.map((storybook) => (
                  <Card
                    key={storybook.id}
                    className="overflow-hidden group cursor-pointer hover:shadow-lg transition-all duration-300 active:scale-[0.98] touch-manipulation"
                    onClick={() => handleViewStorybook(storybook.id)}
                    data-testid={`card-storybook-${storybook.id}`}
                  >
                    {/* Cover Image */}
                    <div className="aspect-[3/4] relative overflow-hidden bg-muted">
                      {storybook.coverImageUrl ? (
                        <img
                          src={storybook.coverImageUrl}
                          alt={`Cover image for ${storybook.title} by ${storybook.author}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                          data-testid={`img-cover-${storybook.id}`}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-muted-foreground">No cover</span>
                        </div>
                      )}
                      
                      {/* Bookmark button - only show if user is authenticated */}
                      {user && (
                        <Button
                          size="icon"
                          variant="secondary"
                          className="absolute top-2 right-2 rounded-full shadow-lg hover:scale-110 active:scale-95 transition-all z-10 bg-white/90 dark:bg-black/80 hover:bg-white dark:hover:bg-black min-h-[48px] min-w-[48px]"
                          onClick={(e) => handleToggleSave(e, storybook.id, storybook.isSaved)}
                          disabled={saveMutation.isPending || unsaveMutation.isPending}
                          data-testid={`button-save-${storybook.id}`}
                        >
                          <Bookmark 
                            className={`h-5 w-5 ${storybook.isSaved ? 'fill-primary text-primary' : 'text-muted-foreground'}`}
                          />
                        </Button>
                      )}
                    </div>

                    {/* Info */}
                    <CardContent className="p-3 sm:p-4">
                      <h3 className="font-semibold text-base sm:text-lg mb-1 line-clamp-2" data-testid={`text-title-${storybook.id}`}>
                        {storybook.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-3" data-testid={`text-author-${storybook.id}`}>
                        by {storybook.author}
                      </p>

                      {/* Stats - More prominent on mobile */}
                      <div className="flex items-center gap-3 sm:gap-4 text-sm sm:text-sm">
                        {storybook.averageRating !== null && storybook.ratingCount > 0 && (
                          <div className="flex items-center gap-1" data-testid={`text-rating-${storybook.id}`}>
                            <Star className="h-4 w-4 sm:h-4 sm:w-4 fill-yellow-400 text-yellow-400" />
                            <span className="font-medium">{storybook.averageRating.toFixed(1)}</span>
                            <span className="text-xs text-muted-foreground">({storybook.ratingCount})</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1 text-muted-foreground" data-testid={`text-views-${storybook.id}`}>
                          <Eye className="h-4 w-4 sm:h-4 sm:w-4" />
                          <span>{storybook.viewCount}</span>
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground" data-testid={`text-shares-${storybook.id}`}>
                          <Share2 className="h-4 w-4 sm:h-4 sm:w-4" />
                          <span>{storybook.shareCount}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Pagination */}
              {data.totalPages > 1 && (
                <div className="mt-12 flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="min-h-[48px] min-w-[48px]"
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page === 1}
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  <div className="flex items-center gap-2">
                    {[...Array(data.totalPages)].map((_, i) => {
                      const pageNum = i + 1;
                      // Show first page, last page, current page, and pages around current
                      const showPage = 
                        pageNum === 1 || 
                        pageNum === data.totalPages || 
                        (pageNum >= page - 1 && pageNum <= page + 1);
                      
                      const showEllipsis = 
                        (pageNum === 2 && page > 3) ||
                        (pageNum === data.totalPages - 1 && page < data.totalPages - 2);

                      if (!showPage && !showEllipsis) return null;
                      
                      if (showEllipsis) {
                        return <span key={pageNum} className="px-2">...</span>;
                      }

                      return (
                        <Button
                          key={pageNum}
                          variant={page === pageNum ? "default" : "outline"}
                          size="icon"
                          className="min-h-[48px] min-w-[48px]"
                          onClick={() => handlePageChange(pageNum)}
                          data-testid={`button-page-${pageNum}`}
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>

                  <Button
                    variant="outline"
                    size="icon"
                    className="min-h-[48px] min-w-[48px]"
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page === data.totalPages}
                    data-testid="button-next-page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}

              <div className="mt-8 text-center text-sm text-muted-foreground" data-testid="text-gallery-count">
                Showing {data.storybooks.length} of {data.totalCount} public storybooks
              </div>
            </>
          ) : (
            <div className="text-center py-20">
              <div className="max-w-md mx-auto">
                <h3 className="text-xl font-semibold mb-2">No public storybooks yet</h3>
                <p className="text-muted-foreground mb-6">
                  Be the first to share your creative storybook with the community!
                </p>
                <Button onClick={() => setLocation("/create")} data-testid="button-create-first">
                  Create Your First Storybook
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
