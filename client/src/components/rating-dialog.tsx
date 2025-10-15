import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Star } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface RatingDialogProps {
  storybookId: string;
  storybookTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface StoryRating {
  id: string;
  storybookId: string;
  userId: string;
  rating: string;
  feedback: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function RatingDialog({ storybookId, storybookTitle, open, onOpenChange }: RatingDialogProps) {
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [feedback, setFeedback] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch existing rating
  const { data: existingRating } = useQuery<StoryRating | null>({
    queryKey: ['/api/storybooks', storybookId, 'rating'],
    enabled: open,
  });

  // Set existing rating values when dialog opens
  useEffect(() => {
    if (existingRating) {
      setRating(parseFloat(existingRating.rating));
      setFeedback(existingRating.feedback || "");
    } else {
      setRating(0);
      setFeedback("");
    }
  }, [existingRating, open]);

  // Submit rating mutation
  const submitRating = useMutation({
    mutationFn: async () => {
      if (rating === 0) {
        throw new Error("Please select a rating");
      }

      return await apiRequest("POST", `/api/storybooks/${storybookId}/rating`, {
        rating,
        feedback: feedback || undefined,
      });
    },
    onSuccess: () => {
      toast({
        title: "Rating submitted",
        description: "Thank you for your feedback!",
      });
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/storybooks', storybookId, 'rating'] });
      queryClient.invalidateQueries({ queryKey: ['/api/storybooks', storybookId, 'average-rating'] });
      
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to submit rating",
        description: error.message || "Please try again later",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    submitRating.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" data-testid="dialog-rating">
        <DialogHeader>
          <DialogTitle>Rate this Story</DialogTitle>
          <DialogDescription>
            How would you rate "{storybookTitle}"?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Star Rating */}
          <div className="flex flex-col items-center space-y-2">
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
                  data-testid={`star-${star}`}
                  aria-label={`Rate ${star} stars`}
                >
                  <Star
                    className={`w-10 h-10 transition-colors ${
                      (hoverRating || rating) >= star
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-gray-300"
                    }`}
                  />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p className="text-sm text-muted-foreground" data-testid="text-rating-value">
                {rating} {rating === 1 ? 'star' : 'stars'}
              </p>
            )}
          </div>

          {/* Feedback Textarea */}
          <div className="space-y-2">
            <label htmlFor="feedback" className="text-sm font-medium">
              Feedback (optional)
            </label>
            <Textarea
              id="feedback"
              placeholder="Tell us what you think about this story..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={4}
              data-testid="textarea-feedback"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitRating.isPending}
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={rating === 0 || submitRating.isPending}
            data-testid="button-submit-rating"
          >
            {submitRating.isPending ? "Submitting..." : existingRating ? "Update Rating" : "Submit Rating"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
