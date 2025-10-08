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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Info } from "lucide-react";

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
                        <div className="flex items-center justify-between mb-2">
                          <FormLabel className="text-sm font-semibold flex items-center">
                            <i className="fas fa-lightbulb text-primary mr-2"></i>
                            Story Idea
                          </FormLabel>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                type="button" 
                                variant="outline" 
                                size="sm"
                                className="gap-2"
                                data-testid="button-style-guide"
                              >
                                <Info className="w-4 h-4" />
                                Style Guide
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle className="flex items-center gap-2 text-2xl">
                                  <i className="fas fa-palette text-primary"></i>
                                  Image Style Guide
                                </DialogTitle>
                                <DialogDescription>
                                  Use these keywords in your story prompt to control the visual style of your storybook images.
                                  If you don't specify a style, we'll default to a colorful children's book illustration.
                                </DialogDescription>
                              </DialogHeader>
                              
                              <div className="space-y-6 mt-4">
                                {/* Realistic Styles */}
                                <div>
                                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                                    <span className="text-2xl">📸</span>
                                    Realistic & Photographic
                                  </h3>
                                  <div className="flex flex-wrap gap-2">
                                    {['realistic', 'photorealistic', 'photo-realistic', 'photograph'].map(style => (
                                      <span key={style} className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                                        {style}
                                      </span>
                                    ))}
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-2">
                                    Example: "Create a <strong>realistic photographic</strong> story about space exploration"
                                  </p>
                                </div>

                                {/* Cartoon & Animation */}
                                <div>
                                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                                    <span className="text-2xl">🎨</span>
                                    Cartoon & Animation
                                  </h3>
                                  <div className="flex flex-wrap gap-2">
                                    {['cartoon', 'animated', 'anime', 'manga'].map(style => (
                                      <span key={style} className="px-3 py-1 bg-secondary/10 text-secondary rounded-full text-sm">
                                        {style}
                                      </span>
                                    ))}
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-2">
                                    Example: "Create an <strong>anime-style</strong> adventure with samurai warriors"
                                  </p>
                                </div>

                                {/* Traditional Art */}
                                <div>
                                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                                    <span className="text-2xl">🖌️</span>
                                    Traditional Art Styles
                                  </h3>
                                  <div className="flex flex-wrap gap-2">
                                    {['oil painting', 'watercolor', 'sketch', 'drawing', 'pencil', 'impressionist'].map(style => (
                                      <span key={style} className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm">
                                        {style}
                                      </span>
                                    ))}
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-2">
                                    Example: "Create a <strong>watercolor</strong> fairy tale about a magical garden"
                                  </p>
                                </div>

                                {/* Digital & 3D */}
                                <div>
                                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                                    <span className="text-2xl">💻</span>
                                    Digital & 3D
                                  </h3>
                                  <div className="flex flex-wrap gap-2">
                                    {['3D', 'CGI', 'rendered', 'render'].map(style => (
                                      <span key={style} className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-sm">
                                        {style}
                                      </span>
                                    ))}
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-2">
                                    Example: "Create a <strong>3D rendered</strong> story about toy robots"
                                  </p>
                                </div>

                                {/* Time Period Styles */}
                                <div>
                                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                                    <span className="text-2xl">⏰</span>
                                    Time Period & Era
                                  </h3>
                                  <div className="flex flex-wrap gap-2">
                                    {['vintage', 'retro', 'modern', 'contemporary'].map(style => (
                                      <span key={style} className="px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full text-sm">
                                        {style}
                                      </span>
                                    ))}
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-2">
                                    Example: "Create a <strong>vintage</strong> 1950s detective story"
                                  </p>
                                </div>

                                {/* Artistic & Abstract */}
                                <div>
                                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                                    <span className="text-2xl">🎭</span>
                                    Artistic & Abstract
                                  </h3>
                                  <div className="flex flex-wrap gap-2">
                                    {['abstract', 'surreal', 'minimalist', 'detailed', 'hyper-realistic'].map(style => (
                                      <span key={style} className="px-3 py-1 bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 rounded-full text-sm">
                                        {style}
                                      </span>
                                    ))}
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-2">
                                    Example: "Create a <strong>surreal</strong> dreamlike story about floating islands"
                                  </p>
                                </div>

                                {/* Mood & Lighting */}
                                <div>
                                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                                    <span className="text-2xl">🌓</span>
                                    Mood & Lighting
                                  </h3>
                                  <div className="flex flex-wrap gap-2">
                                    {['noir', 'black and white', 'monochrome', 'cinematic', 'dramatic lighting'].map(style => (
                                      <span key={style} className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full text-sm">
                                        {style}
                                      </span>
                                    ))}
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-2">
                                    Example: "Create a <strong>noir black and white</strong> mystery story"
                                  </p>
                                </div>

                                {/* Tips */}
                                <div className="bg-muted/50 p-4 rounded-lg">
                                  <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                                    <i className="fas fa-lightbulb text-primary"></i>
                                    Pro Tips
                                  </h3>
                                  <ul className="space-y-2 text-sm text-muted-foreground">
                                    <li>✨ Mix styles for unique results: "3D rendered watercolor style"</li>
                                    <li>🎯 Be specific: "cinematic dramatic lighting" works better than just "cinematic"</li>
                                    <li>🎨 No style specified? We'll create vibrant children's book illustrations by default</li>
                                    <li>💡 The keyword just needs to appear anywhere in your prompt to work</li>
                                  </ul>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
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
