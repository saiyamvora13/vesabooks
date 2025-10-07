import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import Navigation from "@/components/navigation";
import { Flipbook } from "@/components/ui/flipbook";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { type Storybook } from "@shared/schema";

export default function View() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const [shareUrl, setShareUrl] = useState<string>("");
  const { toast } = useToast();

  // Determine if viewing by ID or share URL
  const storybookId = params.id;
  const sharedUrl = params.shareUrl;
  
  const { data: storybook, isLoading, error } = useQuery<Storybook>({
    queryKey: sharedUrl ? ['/api/shared', sharedUrl] : ['/api/storybooks', storybookId],
    enabled: !!(storybookId || sharedUrl),
  });

  const generateShareUrl = async () => {
    if (!storybook) return;
    
    try {
      const response = await fetch(`/api/storybooks/${storybook.id}/share`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate share URL');
      }
      
      const data = await response.json();
      setShareUrl(data.shareUrl);
      
      // Copy to clipboard
      await navigator.clipboard.writeText(data.shareUrl);
      toast({
        title: "Share URL copied!",
        description: "The link has been copied to your clipboard",
      });
    } catch (error) {
      toast({
        title: "Failed to generate share URL",
        description: "Please try again later",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <i className="fas fa-spinner fa-spin text-4xl text-primary mb-4"></i>
            <p className="text-lg text-muted-foreground">Loading your storybook...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !storybook) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex items-center justify-center min-h-[50vh]">
          <Card className="max-w-md">
            <CardContent className="p-6 text-center">
              <i className="fas fa-exclamation-triangle text-4xl text-destructive mb-4"></i>
              <h2 className="text-xl font-bold mb-2">Storybook Not Found</h2>
              <p className="text-muted-foreground mb-4">
                The storybook you're looking for doesn't exist or has been removed.
              </p>
              <Button onClick={() => setLocation("/create")} data-testid="button-create-new">
                Create New Storybook
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <Navigation />
      
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header with Actions */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h2 className="text-3xl font-bold mb-2" data-testid="text-story-title">{storybook.title}</h2>
              <p className="text-muted-foreground">
                Created {storybook.createdAt ? new Date(storybook.createdAt).toLocaleDateString() : 'Unknown'}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" className="rounded-xl" data-testid="button-share">
                    <i className="fas fa-share-alt mr-2"></i>Share
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Share Your Storybook</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <p className="text-muted-foreground">
                      Anyone with this link can view your story
                    </p>
                    {shareUrl ? (
                      <div className="flex items-center space-x-2">
                        <Input value={shareUrl} readOnly className="font-mono text-sm" />
                        <Button
                          onClick={() => navigator.clipboard.writeText(shareUrl)}
                          size="sm"
                          data-testid="button-copy-url"
                        >
                          <i className="fas fa-copy"></i>
                        </Button>
                      </div>
                    ) : (
                      <Button onClick={generateShareUrl} className="w-full" data-testid="button-generate-share">
                        Generate Share Link
                      </Button>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
              
              <Button variant="outline" className="rounded-xl" data-testid="button-download">
                <i className="fas fa-download mr-2"></i>Download PDF
              </Button>
            </div>
          </div>

          {/* Flipbook Container */}
          <Card className="rounded-3xl shadow-2xl">
            <CardContent className="p-8">
              <Flipbook 
                pages={storybook.pages} 
                title={storybook.title}
                data-testid="flipbook-viewer"
              />
            </CardContent>
          </Card>

          {/* Back to Create */}
          <div className="text-center mt-12">
            <Button 
              onClick={() => setLocation("/create")} 
              size="lg" 
              className="rounded-full gradient-bg"
              data-testid="button-create-another"
            >
              <i className="fas fa-plus mr-2"></i>
              Create Another Story
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
