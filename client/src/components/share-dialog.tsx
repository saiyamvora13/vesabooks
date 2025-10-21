import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Copy, Share2, Facebook, Twitter, MessageCircle } from "lucide-react";
import { SiFacebook, SiX, SiWhatsapp } from "react-icons/si";
import type { Storybook } from "@shared/schema";

interface ShareDialogProps {
  storybook: Storybook;
  isOpen: boolean;
  onClose: () => void;
  isOwner: boolean;
}

export function ShareDialog({ storybook, isOpen, onClose, isOwner }: ShareDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [shareUrl, setShareUrl] = useState<string>("");
  const [shareCount, setShareCount] = useState<number>(Number(storybook.shareCount) || 0);

  // Toggle public status mutation
  const togglePublicMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/storybooks/${storybook.id}/toggle-public`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to toggle public status");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/storybooks', storybook.id] });
      toast({
        title: data.isPublic ? "Storybook is now public" : "Storybook is now private",
        description: data.isPublic 
          ? "Anyone can view your storybook" 
          : "Only you can view your storybook",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update storybook visibility",
        variant: "destructive",
      });
    },
  });

  // Generate share URL mutation
  const generateShareUrlMutation = useMutation({
    mutationFn: async (platform: string) => {
      const response = await fetch(`/api/storybooks/${storybook.id}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform }),
      });
      if (!response.ok) throw new Error("Failed to generate share URL");
      return response.json();
    },
    onSuccess: (data) => {
      setShareUrl(data.shareUrl);
      setShareCount(data.shareCount);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate share URL",
        variant: "destructive",
      });
    },
  });

  const handleCopyLink = async () => {
    if (!shareUrl) {
      await generateShareUrlMutation.mutateAsync("copy_link");
    }
    
    const urlToCopy = shareUrl || `${window.location.origin}/view/${storybook.id}`;
    
    try {
      await navigator.clipboard.writeText(urlToCopy);
      toast({
        title: "Link copied!",
        description: "Share link has been copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy link",
        variant: "destructive",
      });
    }
  };

  const handleSocialShare = async (platform: "facebook" | "twitter" | "whatsapp") => {
    if (!shareUrl) {
      await generateShareUrlMutation.mutateAsync(platform);
    }

    const urlToShare = shareUrl || `${window.location.origin}/view/${storybook.id}`;
    const text = `Check out "${storybook.title}" - an AI-generated storybook!`;

    let shareLink = "";
    
    switch (platform) {
      case "facebook":
        shareLink = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(urlToShare)}`;
        break;
      case "twitter":
        shareLink = `https://twitter.com/intent/tweet?url=${encodeURIComponent(urlToShare)}&text=${encodeURIComponent(text)}`;
        break;
      case "whatsapp":
        shareLink = `https://wa.me/?text=${encodeURIComponent(text + " " + urlToShare)}`;
        break;
    }

    window.open(shareLink, "_blank", "width=600,height=400");
  };

  const currentShareUrl = shareUrl || (storybook.shareUrl ? `${window.location.origin}/shared/${storybook.shareUrl}` : "");

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-share">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share Storybook
          </DialogTitle>
          <DialogDescription>
            Share your storybook with friends and family
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Public/Private Toggle (only for owners) */}
          {isOwner && (
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
              <div className="flex-1">
                <Label htmlFor="public-toggle" className="text-sm font-medium">
                  Make Public
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Allow anyone to view and discover your storybook
                </p>
              </div>
              <Switch
                id="public-toggle"
                checked={storybook.isPublic}
                onCheckedChange={() => togglePublicMutation.mutate()}
                disabled={togglePublicMutation.isPending}
                data-testid="switch-public-toggle"
              />
            </div>
          )}

          {/* Share Count */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Share2 className="h-4 w-4" />
            <span data-testid="text-share-count">Shared {shareCount} times</span>
          </div>

          {/* Share URL Input */}
          {currentShareUrl && (
            <div className="space-y-2">
              <Label htmlFor="share-url" className="text-sm">Share Link</Label>
              <div className="flex gap-2">
                <Input
                  id="share-url"
                  value={currentShareUrl}
                  readOnly
                  className="flex-1"
                  data-testid="input-share-url"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleCopyLink}
                  disabled={generateShareUrlMutation.isPending}
                  data-testid="button-copy-link"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Social Share Buttons */}
          <div className="space-y-2">
            <Label className="text-sm">Share on Social Media</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => handleSocialShare("facebook")}
                disabled={generateShareUrlMutation.isPending}
                data-testid="button-share-facebook"
              >
                <SiFacebook className="h-4 w-4 mr-2 text-blue-600" />
                Facebook
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => handleSocialShare("twitter")}
                disabled={generateShareUrlMutation.isPending}
                data-testid="button-share-twitter"
              >
                <SiX className="h-4 w-4 mr-2" />
                X (Twitter)
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => handleSocialShare("whatsapp")}
                disabled={generateShareUrlMutation.isPending}
                data-testid="button-share-whatsapp"
              >
                <SiWhatsapp className="h-4 w-4 mr-2 text-green-600" />
                WhatsApp
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleCopyLink}
                disabled={generateShareUrlMutation.isPending}
                data-testid="button-copy-link-alt"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Link
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
