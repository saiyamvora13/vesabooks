import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet-async";
import Navigation from "@/components/navigation";
import { FlipbookViewer } from "@/components/ui/flipbook-3d";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { type Storybook } from "@shared/schema";
import { ShoppingCart, Star, Share2, Info, Edit2 } from "lucide-react";
import { addToCart } from "@/lib/cartUtils";
import { useAuth } from "@/hooks/useAuth";
import { RatingDialog } from "@/components/rating-dialog";
import { ShareDialog } from "@/components/share-dialog";
import { AudioControls } from "@/components/audio-controls";
import { audioManager } from "@/lib/audioManager";
import { EmailVerificationDialog } from "@/components/email-verification-dialog";
import { NewCheckoutDialog } from "@/components/cart/NewCheckoutDialog";
import bookOpenUrl from "@assets/ES_Book_Open - Epidemic Sound_1760551479317.mp3";
import pageTurnUrl from "@assets/ES_Page Turn 01 - Epidemic Sound_1760551479319.mp3";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function View() {
  const { t } = useTranslation();
  const params = useParams();
  const [, setLocation] = useLocation();
  const [shareUrl, setShareUrl] = useState<string>("");
  const [isDownloading, setIsDownloading] = useState(false);
  const [ratingDialogOpen, setRatingDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [regenerateDialogOpen, setRegenerateDialogOpen] = useState(false);
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);
  const [pageToRegenerate, setPageToRegenerate] = useState<number | null>(null);
  const [currentPageNumber, setCurrentPageNumber] = useState(0);
  const [audioInitialized, setAudioInitialized] = useState(false);
  const [emailVerificationOpen, setEmailVerificationOpen] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [checkoutDialogOpen, setCheckoutDialogOpen] = useState(false);
  const [checkoutType, setCheckoutType] = useState<'digital' | 'print'>('print');
  const [editForewordOpen, setEditForewordOpen] = useState(false);
  const [forewordText, setForewordText] = useState("");
  const { toast} = useToast();
  const { isAuthenticated, user} = useAuth();

  // Determine if viewing by ID or share URL
  const storybookId = params.id;
  const sharedUrl = params.shareUrl;
  
  const { data: storybook, isLoading, error } = useQuery<Storybook>({
    queryKey: sharedUrl ? ['/api/shared', sharedUrl] : ['/api/storybooks', storybookId],
    enabled: !!(storybookId || sharedUrl),
  });

  // Combined purchase check - optimized to reduce API calls from 2 to 1
  const { data: purchaseStatus } = useQuery<{ digital: boolean; print: boolean }>({
    queryKey: ['/api/purchases/check-combined', storybookId],
    queryFn: async () => {
      if (!isAuthenticated || !storybookId) return { digital: false, print: false };
      const response = await apiRequest('POST', '/api/purchases/check-combined', { storybookId });
      if (!response.ok) return { digital: false, print: false };
      return response.json();
    },
    enabled: !!isAuthenticated && !!storybookId,
  });

  // Extract digital and print status for easier usage
  const digitalPurchase = { owned: purchaseStatus?.digital || false };
  const printPurchase = { owned: purchaseStatus?.print || false };

  const { data: averageRatingData } = useQuery<{ averageRating: number | null; count: number }>({
    queryKey: ['/api/storybooks', storybookId, 'average-rating'],
    enabled: !!storybookId,
  });

  const { data: pricing } = useQuery<{ digital_price: string; print_price: string }>({
    queryKey: ['/api/settings/pricing'],
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes - pricing rarely changes
  });

  // Regenerate page mutation
  const regeneratePageMutation = useMutation({
    mutationFn: async (pageNumber: number) => {
      if (!storybookId) throw new Error('No storybook ID');
      const res = await apiRequest('POST', `/api/storybooks/${storybookId}/regenerate-page`, { pageNumber });
      return res.json();
    },
    onSuccess: () => {
      // Invalidate and refetch the storybook
      queryClient.invalidateQueries({ queryKey: ['/api/storybooks', storybookId] });
      toast({
        title: "Page regenerated successfully!",
        description: "The page has been updated with new content.",
      });
      setRegenerateDialogOpen(false);
      setPageToRegenerate(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to regenerate page",
        description: error.message || "An error occurred while regenerating the page.",
        variant: "destructive",
      });
      setRegenerateDialogOpen(false);
      setPageToRegenerate(null);
    },
  });

  const handleRegeneratePage = (pageNumber: number) => {
    setPageToRegenerate(pageNumber);
    setRegenerateDialogOpen(true);
  };

  const confirmRegenerate = () => {
    if (pageToRegenerate !== null) {
      regeneratePageMutation.mutate(pageToRegenerate);
    }
  };

  // Edit foreword mutation
  const editForewordMutation = useMutation({
    mutationFn: async (newForeword: string) => {
      if (!storybookId) throw new Error('No storybook ID');
      const res = await apiRequest('PATCH', `/api/storybooks/${storybookId}/foreword`, { foreword: newForeword });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/storybooks', storybookId] });
      toast({
        title: "Foreword updated!",
        description: "Your dedication has been saved.",
      });
      setEditForewordOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update foreword",
        description: error.message || "An error occurred while updating the foreword.",
        variant: "destructive",
      });
    },
  });

  const handleEditForeword = () => {
    setForewordText(storybook?.foreword || "");
    setEditForewordOpen(true);
  };

  const handleSaveForeword = () => {
    editForewordMutation.mutate(forewordText);
  };

  // Claim storybook mutation
  const claimStorybookMutation = useMutation({
    mutationFn: async () => {
      if (!storybookId) throw new Error('No storybook ID');
      const res = await apiRequest('POST', `/api/storybooks/${storybookId}/claim`, {});
      return res.json();
    },
    onSuccess: () => {
      // Invalidate and refetch the storybook
      queryClient.invalidateQueries({ queryKey: ['/api/storybooks', storybookId] });
      queryClient.invalidateQueries({ queryKey: ['/api/storybooks'] }); // Refresh library
      toast({
        title: "Storybook claimed!",
        description: "This storybook has been added to your library.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to claim storybook",
        description: error.message || "An error occurred while claiming the storybook.",
        variant: "destructive",
      });
    },
  });

  // Track view count and analytics when viewing public storybook
  useEffect(() => {
    if (!storybook || !storybookId) return;
    
    // Increment view count for public storybooks
    if (storybook.isPublic) {
      fetch(`/api/storybooks/${storybookId}/view`, {
        method: 'POST',
      }).catch(console.error);
    }
  }, [storybook, storybookId]);

  // Initialize audio system
  useEffect(() => {
    let isSubscribed = true;
    let hasPlayedBookOpen = false;
    
    const initAudio = async () => {
      if (!isSubscribed || audioInitialized) return;
      
      try {
        console.log('🎵 Initializing AudioManager...');
        await audioManager.init();
        
        // Background music temporarily disabled
        // Load sound effects from real audio files
        await audioManager.loadSoundEffect('book-open', bookOpenUrl);
        await audioManager.loadSoundEffect('page-turn', pageTurnUrl);
        
        if (isSubscribed) {
          console.log('🎵 AudioManager initialized successfully');
          
          // Play book-open sound when first opening the storybook
          if (!hasPlayedBookOpen) {
            audioManager.playSoundEffect('book-open');
            hasPlayedBookOpen = true;
          }
          
          // Background music crossfading disabled
          
          // Mark as initialized
          setAudioInitialized(true);
        }
      } catch (error) {
        console.error('Failed to initialize audio:', error);
        // Don't set audioInitialized if there was an error
        // The audio controls will remain disabled
      }
    };

    // Initialize audio on user interaction within this component (browser autoplay policy)
    // Use a ref to the container to scope events to this component only
    const handleFirstInteraction = (e: Event) => {
      // Only initialize if the click is within the storybook viewer
      if (isSubscribed && !audioInitialized) {
        initAudio();
      }
    };

    // Add event listeners to the window but check if we should init
    const clickListener = (e: MouseEvent) => handleFirstInteraction(e);
    const keyListener = (e: KeyboardEvent) => handleFirstInteraction(e);
    
    window.addEventListener('click', clickListener, { once: true });
    window.addEventListener('keydown', keyListener, { once: true });

    return () => {
      isSubscribed = false;
      window.removeEventListener('click', clickListener);
      window.removeEventListener('keydown', keyListener);
      // Only cleanup audio when component unmounts, not when audioInitialized changes
      audioManager.cleanup();
    };
  }, []); // Remove audioInitialized from dependencies to prevent re-running when it changes

  // Background music crossfading disabled
  // useEffect(() => {
  //   if (!audioInitialized || !storybook || currentPageNumber < 0) return;
  //   const currentPage = storybook.pages[currentPageNumber];
  //   const mood = currentPage?.mood || 'calm';
  //   console.log(`📖 Page ${currentPageNumber}: mood = ${mood}`);
  //   audioManager.crossfadeTo(mood as any, 2);
  // }, [currentPageNumber, storybook, audioInitialized]);

  // Handle page change with sound effect
  const handlePageChange = (pageNumber: number) => {
    setCurrentPageNumber(pageNumber);
    
    // Play page-turn sound effect if audio is initialized
    // Volume and enable/disable are controlled by AudioControls component
    if (audioInitialized) {
      audioManager.playSoundEffect('page-turn');
    }
  };

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

    // Check if this is an anonymous storybook
    const isAnonymousStorybook = !storybook.userId;

    // For anonymous storybooks, require email verification
    if (isAnonymousStorybook && !verifiedEmail) {
      setEmailVerificationOpen(true);
      return;
    }

    // For authenticated storybooks, check purchase
    if (!isAnonymousStorybook && !digitalPurchase?.owned) {
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
      // Add email to query params for anonymous storybooks
      const url = isAnonymousStorybook && verifiedEmail
        ? `/api/storybooks/${storybook.id}/epub?email=${encodeURIComponent(verifiedEmail)}`
        : `/api/storybooks/${storybook.id}/epub`;
        
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to download EPUB');
      }
      
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${storybook.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.epub`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
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

  const handleEmailVerified = (email: string) => {
    setVerifiedEmail(email);
    setEmailVerificationOpen(false);
    // Trigger download after verification
    setTimeout(() => downloadEpub(), 100);
  };

  const handleDirectDigitalCheckout = () => {
    if (!storybook || !pricing) return;
    setCheckoutType('digital');
    setCheckoutDialogOpen(true);
  };

  const handleDirectPrintCheckout = () => {
    if (!storybook || !pricing) return;
    setCheckoutType('print');
    setCheckoutDialogOpen(true);
  };

  const handleAddToCart = async () => {
    if (!storybook || !pricing) return;
    
    // Determine what to add based on ownership
    // If they own digital, add print; otherwise add digital
    const productType = digitalPurchase?.owned ? 'print' : 'digital';
    const productName = productType === 'digital' ? 'Digital Edition' : 'Print Edition';
    
    try {
      // Add to backend cart (database)
      await apiRequest('POST', '/api/cart', {
        storybookId: storybook.id,
        productType: productType,
        quantity: 1,
      });
      
      toast({
        title: "Added to cart",
        description: `${storybook.title} - ${productName}`,
      });
      
      window.dispatchEvent(new Event('cartUpdated'));
      setLocation('/cart');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add item to cart. Please try again.",
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

  const isOwner = user?.id === storybook?.userId;
  const pageUrl = `${window.location.origin}/view/${storybookId}`;
  const previewImageUrl = storybook?.coverImageUrl || `${window.location.origin}/api/storybooks/${storybookId}/preview`;

  return (
    <div className="min-h-screen bg-muted/30">
      <Helmet>
        <title>{storybook.title} - AI Storybook Builder</title>
        <meta name="description" content={`Read "${storybook.title}" - an AI-generated storybook. ${storybook.pages[0]?.text?.substring(0, 150) || 'A creative story for all ages.'}`} />
        
        {/* Open Graph / Facebook */}
        <meta property="og:type" content="article" />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:title" content={storybook.title} />
        <meta property="og:description" content={`Read "${storybook.title}" - an AI-generated storybook created with AI Storybook Builder.`} />
        <meta property="og:image" content={previewImageUrl} />
        
        {/* Twitter */}
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:url" content={pageUrl} />
        <meta property="twitter:title" content={storybook.title} />
        <meta property="twitter:description" content={`Read "${storybook.title}" - an AI-generated storybook created with AI Storybook Builder.`} />
        <meta property="twitter:image" content={previewImageUrl} />
      </Helmet>
      
      <Navigation />
      
      <section className="py-4 md:py-20">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
          {/* Header with Actions */}
          <div className="flex flex-col gap-3 mb-4 md:mb-8 px-2">
            {/* Title and Rating Section */}
            <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
              <div className="flex-1">
                <h2 className="text-xl md:text-3xl font-bold mb-2" data-testid="text-story-title">{storybook.title}</h2>
                <div className="flex flex-wrap items-center gap-2 md:gap-4">
                  <p className="text-xs md:text-base text-muted-foreground">
                    {t('storybook.viewer.created', { date: storybook.createdAt ? new Date(storybook.createdAt).toLocaleDateString() : 'Unknown' })}
                  </p>
                  {averageRatingData && averageRatingData.count > 0 && (
                    <div className="flex items-center gap-1" data-testid="text-average-rating">
                      <Star className="h-3 md:h-4 w-3 md:w-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-xs md:text-sm font-medium">
                        {averageRatingData.averageRating?.toFixed(1)}
                      </span>
                      <span className="text-xs md:text-sm text-muted-foreground">
                        ({averageRatingData.count})
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Action Buttons - Mobile Optimized with horizontal scroll */}
            <div className="overflow-x-auto -mx-2 px-2 md:mx-0 md:px-0">
              <div className="flex gap-2 md:gap-3 md:flex-wrap min-w-max md:min-w-0">
                {storybookId && <AudioControls storybookId={storybookId} />}
                
                <Button 
                  variant="outline" 
                  className="rounded-xl whitespace-nowrap min-h-[48px] md:min-h-0" 
                  onClick={() => setInfoDialogOpen(true)}
                  data-testid="button-info"
                >
                  <Info className="h-4 w-4 mr-2" />
                  <span className="text-sm md:text-base">Details</span>
                </Button>

                <Button 
                  variant="outline" 
                  className="rounded-xl whitespace-nowrap min-h-[48px] md:min-h-0" 
                  onClick={() => setShareDialogOpen(true)}
                  data-testid="button-share"
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  <span className="text-sm md:text-base">Share</span>
                </Button>

                {isAuthenticated && (
                  <Button 
                    variant="outline" 
                    className="rounded-xl whitespace-nowrap min-h-[48px] md:min-h-0" 
                    onClick={() => setRatingDialogOpen(true)}
                    data-testid="button-rate-story"
                  >
                    <Star className="h-4 w-4 mr-2" />
                    <span className="text-sm md:text-base">Rate</span>
                  </Button>
                )}

                {isAuthenticated && !storybook?.userId && (
                  <Button 
                    variant="default" 
                    className="rounded-xl whitespace-nowrap min-h-[48px] md:min-h-0 bg-primary hover:bg-primary/90" 
                    onClick={() => claimStorybookMutation.mutate()}
                    disabled={claimStorybookMutation.isPending}
                    data-testid="button-claim-storybook"
                  >
                    <i className={`fas ${claimStorybookMutation.isPending ? 'fa-spinner fa-spin' : 'fa-heart'} mr-2`}></i>
                    <span className="text-sm md:text-base">
                      {claimStorybookMutation.isPending ? 'Claiming...' : 'Claim Book'}
                    </span>
                  </Button>
                )}
                
                {/* Download button - shown if user owns digital version */}
                {digitalPurchase?.owned && (
                  <Button 
                    variant="outline" 
                    className="rounded-xl whitespace-nowrap min-h-[48px] md:min-h-0" 
                    onClick={downloadEpub} 
                    disabled={isDownloading}
                    data-testid="button-download-epub"
                  >
                    <i className={`fas ${isDownloading ? 'fa-spinner fa-spin' : 'fa-book'} mr-2`}></i>
                    <span className="text-sm md:text-base">
                      {isDownloading ? 'Preparing...' : 'Download'}
                    </span>
                  </Button>
                )}

                {/* Buy E-book button - shown if user doesn't own digital version */}
                {!digitalPurchase?.owned && (
                  <Button 
                    variant="default" 
                    className="rounded-xl gradient-bg !text-[hsl(258,90%,20%)] whitespace-nowrap min-h-[48px] md:min-h-0" 
                    onClick={handleDirectDigitalCheckout}
                    disabled={!pricing}
                    data-testid="button-buy-ebook-direct"
                  >
                    <i className="fas fa-book mr-2"></i>
                    <span className="text-sm md:text-base font-semibold">
                      Buy ${pricing ? (parseInt(pricing.digital_price) / 100).toFixed(2) : '3.99'}
                    </span>
                  </Button>
                )}

                {/* Buy Print button - shown if user doesn't own print version */}
                {!printPurchase?.owned && (
                  <Button 
                    variant="default" 
                    className="rounded-xl gradient-bg !text-[hsl(258,90%,20%)] whitespace-nowrap min-h-[48px] md:min-h-0" 
                    onClick={handleDirectPrintCheckout}
                    disabled={!pricing}
                    data-testid="button-buy-print-direct"
                  >
                    <i className="fas fa-print mr-2"></i>
                    <span className="text-sm md:text-base font-semibold">
                      Print ${pricing ? (parseInt(pricing.print_price) / 100).toFixed(2) : '29.99'}
                    </span>
                  </Button>
                )}

                {/* Add to Cart button - shown if user doesn't own both versions */}
                {!(digitalPurchase?.owned && printPurchase?.owned) && (
                  <Button 
                    variant="outline" 
                    className="rounded-xl whitespace-nowrap min-h-[48px] md:min-h-0" 
                    onClick={handleAddToCart}
                    disabled={!pricing}
                    data-testid="button-add-to-cart"
                  >
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    <span className="text-sm md:text-base">Add to Cart</span>
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Flipbook Container */}
          <div className="bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 rounded-lg md:rounded-3xl shadow-2xl p-1 md:p-8 max-h-[700px] h-[85vh] md:h-auto md:min-h-[80vh] flex items-center justify-center">
            <FlipbookViewer 
              pages={storybook.pages} 
              title={storybook.title}
              author={storybook.author || "AI Storyteller"}
              coverImageUrl={storybook.coverImageUrl || storybook.pages[0]?.imageUrl}
              backCoverImageUrl={storybook.backCoverImageUrl || undefined}
              foreword={storybook.foreword || undefined}
              isOwner={isAuthenticated && user?.id === storybook.userId}
              onRegeneratePage={handleRegeneratePage}
              regeneratingPageNumber={regeneratePageMutation.isPending ? pageToRegenerate : null}
              onPageChange={handlePageChange}
              orientation={(storybook.orientation as 'portrait' | 'landscape') || 'portrait'}
            />
          </div>

          {/* Regenerate Page Confirmation Dialog - Mobile Optimized */}
          <AlertDialog open={regenerateDialogOpen} onOpenChange={setRegenerateDialogOpen}>
            <AlertDialogContent className="max-w-[95vw] md:max-w-[500px] rounded-xl" data-testid="dialog-regenerate-confirm">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-lg md:text-xl">
                  Regenerate Page {pageToRegenerate}?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-sm md:text-base">
                  This will replace the current page with new AI-generated content. The current text and image will be permanently replaced.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                <AlertDialogCancel 
                  className="min-h-[44px] w-full sm:w-auto"
                  data-testid="button-cancel-regenerate"
                >
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction 
                  onClick={confirmRegenerate}
                  className="min-h-[44px] w-full sm:w-auto"
                  data-testid="button-confirm-regenerate"
                  disabled={regeneratePageMutation.isPending}
                >
                  {regeneratePageMutation.isPending ? 'Regenerating...' : 'Continue'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Back to Create - Mobile Optimized */}
          <div className="text-center mt-6 md:mt-12 pb-4">
            <Button 
              onClick={() => setLocation("/create")} 
              size="lg" 
              className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 min-h-[48px] px-8"
              data-testid="button-create-another"
            >
              <i className="fas fa-plus mr-2"></i>
              <span className="text-base md:text-lg">{t('storybook.viewer.createAnother')}</span>
            </Button>
          </div>
        </div>
      </section>

      {/* Rating Dialog */}
      {storybookId && (
        <RatingDialog
          storybookId={storybookId}
          storybookTitle={storybook.title}
          open={ratingDialogOpen}
          onOpenChange={setRatingDialogOpen}
        />
      )}

      {/* Share Dialog */}
      <ShareDialog
        storybook={storybook}
        isOpen={shareDialogOpen}
        onClose={() => setShareDialogOpen(false)}
        isOwner={isOwner}
      />

      {/* Email Verification Dialog for Anonymous Downloads */}
      {storybook?.id && (
        <EmailVerificationDialog
          open={emailVerificationOpen}
          onOpenChange={setEmailVerificationOpen}
          storybookId={storybook.id}
          onVerified={handleEmailVerified}
        />
      )}

      {/* Book Details Dialog */}
      <Dialog open={infoDialogOpen} onOpenChange={setInfoDialogOpen}>
        <DialogContent className="max-w-[95vw] md:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl md:text-2xl font-bold pr-8">
              Book Details
            </DialogTitle>
            <DialogDescription className="sr-only">
              View detailed information about this storybook including prompt, age group, and illustration style
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Title and Author */}
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1">Title</h3>
                <p className="text-lg font-medium" data-testid="info-title">{storybook.title}</p>
              </div>
              {storybook.author && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1">Author</h3>
                  <p className="text-base" data-testid="info-author">{storybook.author}</p>
                </div>
              )}
              {/* Foreword/Dedication */}
              {(storybook.foreword || isOwner) && (
                <div className="bg-muted/50 rounded-lg p-4 border">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Dedication</h3>
                    {isOwner && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleEditForeword}
                        className="h-8 gap-2"
                        data-testid="button-edit-foreword"
                      >
                        <Edit2 className="w-3 h-3" />
                        Edit
                      </Button>
                    )}
                  </div>
                  {storybook.foreword ? (
                    <p className="text-base leading-relaxed italic text-center font-serif" data-testid="info-foreword">
                      {storybook.foreword}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic text-center">
                      No dedication added yet. Click Edit to add one.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Story Prompt */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Story Prompt</h3>
              <div className="bg-muted/50 rounded-lg p-4 border">
                <p className="text-base leading-relaxed italic" data-testid="info-prompt">
                  "{storybook.prompt}"
                </p>
              </div>
            </div>

            {/* Specifications Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {storybook.age && (
                <div className="bg-background border rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Age Group</h3>
                  <div className="flex items-center gap-2">
                    <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium" data-testid="info-age">
                      {storybook.age} years
                    </div>
                  </div>
                </div>
              )}

              {storybook.artStyle && (
                <div className="bg-background border rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Illustration Style</h3>
                  <p className="text-base capitalize" data-testid="info-style">{storybook.artStyle}</p>
                </div>
              )}

              {storybook.orientation && (
                <div className="bg-background border rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Book Orientation</h3>
                  <div className="flex items-center gap-2">
                    <div className="bg-secondary/80 px-3 py-1 rounded-full text-sm font-medium capitalize" data-testid="info-orientation">
                      {storybook.orientation}
                    </div>
                  </div>
                </div>
              )}

              {storybook.createdAt && (
                <div className="bg-background border rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Created On</h3>
                  <p className="text-base" data-testid="info-created">
                    {new Date(storybook.createdAt).toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </p>
                </div>
              )}
            </div>

            {/* Additional Info */}
            {(storybook.inspirationImages && storybook.inspirationImages.length > 0) && (
              <div className="bg-background border rounded-lg p-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Character References
                </h3>
                <p className="text-sm text-muted-foreground" data-testid="info-references">
                  {storybook.inspirationImages.length} reference image{storybook.inspirationImages.length !== 1 ? 's' : ''} used for character consistency
                </p>
              </div>
            )}

            {storybook.pages && (
              <div className="bg-background border rounded-lg p-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Story Length
                </h3>
                <p className="text-base" data-testid="info-pages">
                  {storybook.pages.length} page{storybook.pages.length !== 1 ? 's' : ''} 
                  <span className="text-sm text-muted-foreground ml-2">
                    ({storybook.pages.length * 2} spreads with text and illustrations)
                  </span>
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Checkout Dialog */}
      <NewCheckoutDialog
        open={checkoutDialogOpen}
        onOpenChange={setCheckoutDialogOpen}
        mode="direct"
        directItem={{
          storybookId: storybook?.id || '',
          productType: checkoutType,
          bookSize: 'a4-portrait',
        }}
        hasPrintItems={checkoutType === 'print'}
        amount={pricing ? (checkoutType === 'digital' ? parseInt(pricing.digital_price) : parseInt(pricing.print_price)) : 0}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['/api/purchases'] });
          setCheckoutDialogOpen(false);
          
          toast({
            title: "Purchase complete!",
            description: checkoutType === 'digital' 
              ? "Your e-book is now available for download." 
              : "Your print order has been placed successfully.",
          });

          // Invalidate combined purchase check to refresh ownership status
          queryClient.invalidateQueries({ queryKey: ['/api/purchases/check-combined', storybookId] });
        }}
      />

      {/* Edit Foreword Dialog */}
      <Dialog open={editForewordOpen} onOpenChange={setEditForewordOpen}>
        <DialogContent className="max-w-[95vw] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Dedication</DialogTitle>
            <DialogDescription>
              Add a personal message that will appear on the first page of your storybook (max 500 characters)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Textarea
                value={forewordText}
                onChange={(e) => setForewordText(e.target.value.slice(0, 500))}
                placeholder="To my wonderful Mom - Happy Mother's Day! This story was made just for you with all my love. - Sarah"
                rows={5}
                maxLength={500}
                className="resize-none font-serif italic"
                data-testid="textarea-edit-foreword"
              />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>This will appear centered and italicized on the first page</span>
                <span>{forewordText.length}/500</span>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setEditForewordOpen(false)}
                data-testid="button-cancel-foreword"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveForeword}
                disabled={editForewordMutation.isPending}
                data-testid="button-save-foreword"
              >
                {editForewordMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
