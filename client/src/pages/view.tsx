import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import Navigation from "@/components/navigation";
import { FlipbookViewer } from "@/components/ui/flipbook-3d";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { type Storybook } from "@shared/schema";
import { ShoppingCart } from "lucide-react";
import { addToCart } from "@/lib/cartUtils";
import { useAuth } from "@/hooks/useAuth";

export default function View() {
  const { t } = useTranslation();
  const params = useParams();
  const [, setLocation] = useLocation();
  const [shareUrl, setShareUrl] = useState<string>("");
  const [isDownloading, setIsDownloading] = useState(false);
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();

  // Determine if viewing by ID or share URL
  const storybookId = params.id;
  const sharedUrl = params.shareUrl;
  
  const { data: storybook, isLoading, error } = useQuery<Storybook>({
    queryKey: sharedUrl ? ['/api/shared', sharedUrl] : ['/api/storybooks', storybookId],
    enabled: !!(storybookId || sharedUrl),
  });

  const { data: digitalPurchase } = useQuery<{ owned: boolean }>({
    queryKey: ['/api/purchases/check', storybookId, 'digital'],
    queryFn: async () => {
      if (!isAuthenticated || !storybookId) return { owned: false };
      const response = await fetch('/api/purchases/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storybookId, type: 'digital' }),
        credentials: 'include',
      });
      if (!response.ok) return { owned: false };
      return response.json();
    },
    enabled: !!isAuthenticated && !!storybookId,
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
        title: t('storybook.viewer.share.toast.success.title'),
        description: t('storybook.viewer.share.toast.success.description'),
      });
    } catch (error) {
      toast({
        title: t('storybook.viewer.share.toast.error.title'),
        description: t('storybook.viewer.share.toast.error.description'),
        variant: "destructive",
      });
    }
  };

  const downloadEpub = async () => {
    if (!storybook || isDownloading) return;

    if (!digitalPurchase?.owned) {
      toast({
        title: t('storybook.viewer.download.toast.purchaseRequired.title'),
        description: t('storybook.viewer.download.toast.purchaseRequired.description'),
        variant: "destructive",
      });
      return;
    }
    
    setIsDownloading(true);
    
    toast({
      title: t('storybook.viewer.download.toast.preparing.title'),
      description: t('storybook.viewer.download.toast.preparing.description'),
    });
    
    try {
      const response = await fetch(`/api/storybooks/${storybook.id}/epub`);
      
      if (!response.ok) {
        throw new Error('Failed to download EPUB');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${storybook.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.epub`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: t('storybook.viewer.download.toast.success.title'),
        description: t('storybook.viewer.download.toast.success.description'),
      });
    } catch (error) {
      toast({
        title: t('storybook.viewer.download.toast.error.title'),
        description: t('storybook.viewer.download.toast.error.description'),
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleBuyDigital = () => {
    if (!storybook) return;
    
    addToCart({
      storybookId: storybook.id,
      type: 'digital',
      title: storybook.title,
      price: 399,
    });
    
    toast({
      title: "Added to cart",
      description: `${storybook.title} - Digital Edition`,
    });
    
    window.dispatchEvent(new Event('cartUpdated'));
    setLocation('/cart');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <i className="fas fa-spinner fa-spin text-4xl text-primary mb-4"></i>
            <p className="text-lg text-muted-foreground">{t('storybook.viewer.loadingMessage')}</p>
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
              <h2 className="text-xl font-bold mb-2">{t('storybook.viewer.notFound.title')}</h2>
              <p className="text-muted-foreground mb-4">
                {t('storybook.viewer.notFound.description')}
              </p>
              <Button onClick={() => setLocation("/create")} data-testid="button-create-new">
                {t('storybook.viewer.notFound.button')}
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
      
      <section className="py-8 md:py-20">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
          {/* Header with Actions */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 md:mb-8 px-2">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold mb-2" data-testid="text-story-title">{storybook.title}</h2>
              <p className="text-sm md:text-base text-muted-foreground">
                {t('storybook.viewer.created', { date: storybook.createdAt ? new Date(storybook.createdAt).toLocaleDateString() : 'Unknown' })}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" className="rounded-xl" data-testid="button-share">
                    <i className="fas fa-share-alt mr-2"></i>{t('storybook.viewer.share.button')}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>{t('storybook.viewer.share.title')}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <p className="text-muted-foreground">
                      {t('storybook.viewer.share.description')}
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
                        {t('storybook.viewer.share.generateButton')}
                      </Button>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
              
              {digitalPurchase?.owned ? (
                <Button 
                  variant="outline" 
                  className="rounded-xl" 
                  onClick={downloadEpub} 
                  disabled={isDownloading}
                  data-testid="button-download-epub"
                >
                  <i className={`fas ${isDownloading ? 'fa-spinner fa-spin' : 'fa-book'} mr-2`}></i>
                  {isDownloading ? t('storybook.viewer.download.buttonPreparing') : t('storybook.viewer.download.button')}
                </Button>
              ) : (
                <>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline" 
                          className="rounded-xl opacity-50 cursor-not-allowed" 
                          disabled
                          data-testid="button-download-epub"
                        >
                          <i className="fas fa-book mr-2"></i>
                          {t('storybook.viewer.download.button')}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{t('storybook.viewer.download.purchaseTooltip')}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  
                  <Button 
                    variant="default" 
                    className="rounded-xl gradient-bg !text-[hsl(258,90%,20%)]" 
                    onClick={handleBuyDigital}
                    data-testid="button-buy-digital-viewer"
                  >
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    {t('storybook.viewer.buyButton')}
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Flipbook Container */}
          <div className="bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 rounded-2xl md:rounded-3xl shadow-2xl p-2 md:p-8 min-h-[85vh] md:min-h-[80vh] flex items-center justify-center">
            <FlipbookViewer 
              pages={storybook.pages} 
              title={storybook.title}
              author={storybook.author || "AI Storyteller"}
              coverImageUrl={storybook.coverImageUrl || storybook.pages[0]?.imageUrl}
              backCoverImageUrl={storybook.backCoverImageUrl}
            />
          </div>

          {/* Back to Create */}
          <div className="text-center mt-8 md:mt-12">
            <Button 
              onClick={() => setLocation("/create")} 
              size="lg" 
              className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
              data-testid="button-create-another"
            >
              <i className="fas fa-plus mr-2"></i>
              {t('storybook.viewer.createAnother')}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
