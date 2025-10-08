import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { FileUpload } from "@/components/ui/file-upload";
import { ProgressTracker } from "@/components/ui/progress-tracker";
import Navigation from "@/components/navigation";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";

const createStorySchema = z.object({
  prompt: z.string().min(10, "Story prompt must be at least 10 characters"),
  images: z.array(z.instanceof(File)).min(1, "At least one inspiration image is required").max(5, "Maximum 5 images allowed"),
});

type CreateStoryForm = z.infer<typeof createStorySchema>;

interface GenerationResponse {
  sessionId: string;
}

export default function Create() {
  const [, setLocation] = useLocation();
  const [isGenerating, setIsGenerating] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [lastFormData, setLastFormData] = useState<CreateStoryForm | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const { toast } = useToast();

  const form = useForm<CreateStoryForm>({
    resolver: zodResolver(createStorySchema),
    defaultValues: {
      prompt: "",
      images: [],
    },
  });

  const createStoryMutation = useMutation({
    mutationFn: async (data: CreateStoryForm): Promise<GenerationResponse> => {
      const formData = new FormData();
      formData.append("prompt", data.prompt);
      data.images.forEach(image => {
        formData.append("images", image);
      });

      const response = await fetch("/api/storybooks", {
        method: "POST",
        body: formData,
        credentials: "include", // Include session cookie for authentication
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create storybook");
      }

      return response.json();
    },
    onSuccess: (data) => {
      setSessionId(data.sessionId);
      setIsGenerating(true);
      toast({
        title: "Story generation started!",
        description: "Your magical storybook is being created...",
      });
    },
    onError: (error) => {
      // Replit Auth: Handle unauthorized error - redirect to login
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Unauthorized",
          description: "Please log in to create a storybook.",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      
      toast({
        title: "Generation failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CreateStoryForm) => {
    setLastFormData(data); // Save form data for retry
    setRetryCount(0); // Reset retry count on new submission
    createStoryMutation.mutate(data);
  };

  const onGenerationComplete = (storybookId: string) => {
    setIsGenerating(false);
    setRetryCount(0); // Reset retry count on success
    setLocation(`/view/${storybookId}`);
  };

  const handleRetry = () => {
    if (lastFormData) {
      setRetryCount(prev => prev + 1);
      setIsGenerating(false);
      setSessionId(null);
      createStoryMutation.mutate(lastFormData);
    }
  };

  if (isGenerating && sessionId) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="py-20">
          <ProgressTracker 
            sessionId={sessionId} 
            onComplete={onGenerationComplete}
            onRetry={handleRetry}
            shouldAutoRetry={retryCount === 0}
            data-testid="progress-tracker"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <section className="py-8 sm:py-12 lg:py-20">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 lg:px-8">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4">Create Your Storybook</h2>
            <p className="text-base sm:text-lg text-muted-foreground px-4">
              Share your story idea and inspiration images to get started
            </p>
          </div>

          <Card className="rounded-2xl sm:rounded-3xl shadow-xl">
            <CardContent className="p-4 sm:p-6 lg:p-8">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                  {/* Story Prompt */}
                  <FormField
                    control={form.control}
                    name="prompt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold flex items-center">
                          <i className="fas fa-lightbulb text-primary mr-2"></i>
                          Story Idea
                          <span className="ml-auto text-muted-foreground font-normal">Required</span>
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            rows={6}
                            placeholder="Example: A story about my daughter Maya who loves dinosaurs and ice cream. She goes on an adventure to find the world's biggest ice cream sundae..."
                            className="resize-none rounded-2xl"
                            data-testid="input-story-prompt"
                          />
                        </FormControl>
                        <div className="text-sm text-muted-foreground">
                          <i className="fas fa-info-circle mr-1"></i>
                          Be as creative and detailed as you want! Include character names, themes, and plot ideas.
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Image Upload */}
                  <FormField
                    control={form.control}
                    name="images"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold flex items-center">
                          <i className="fas fa-image text-secondary mr-2"></i>
                          Inspiration Images
                          <span className="ml-auto text-muted-foreground font-normal">1-5 images</span>
                        </FormLabel>
                        <FormControl>
                          <FileUpload
                            value={field.value}
                            onChange={field.onChange}
                            accept="image/png,image/jpeg"
                            maxFiles={5}
                            maxSize={10 * 1024 * 1024} // 10MB
                            data-testid="file-upload-images"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button 
                    type="submit" 
                    className="w-full py-4 rounded-2xl font-bold text-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg"
                    disabled={createStoryMutation.isPending}
                    data-testid="button-generate-story"
                  >
                    {createStoryMutation.isPending ? (
                      <>
                        <i className="fas fa-spinner fa-spin mr-2"></i>
                        Starting Generation...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-magic mr-2"></i>
                        Generate My Storybook
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
