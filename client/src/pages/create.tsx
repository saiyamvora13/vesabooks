import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { SamplePrompt } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileUpload } from "@/components/ui/file-upload";
import { ProgressTracker } from "@/components/ui/progress-tracker";
import Navigation from "@/components/navigation";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { SEO } from "@/components/SEO";
import { useRecaptcha } from "@/hooks/use-recaptcha";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Info } from "lucide-react";

interface GenerationResponse {
  sessionId: string;
  isAnonymous?: boolean;
  rateLimitRemaining?: number | null;
}

export default function Create() {
  const { t, i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const [isGenerating, setIsGenerating] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const { toast } = useToast();
  const { executeRecaptcha } = useRecaptcha();

  const createStorySchema = useMemo(() => z.object({
    prompt: z.string().min(10, t('common.validation.promptMinLength')),
    author: z.string().optional(),
    age: z.enum(["", "3-5", "6-8", "9-12"]).optional(),
    illustrationStyle: z.string().default("vibrant and colorful children's book illustration"),
    customIllustrationStyle: z.string().optional(),
    foreword: z.string().max(500, "Foreword must be 500 characters or less").optional(),
    images: z.array(z.instanceof(File)).min(0).max(5, t('common.validation.maxImagesExceeded')),
  }).refine(
    (data) => {
      if (data.illustrationStyle === "custom") {
        return data.customIllustrationStyle && data.customIllustrationStyle.trim().length > 0;
      }
      return true;
    },
    {
      message: "Please describe your custom illustration style",
      path: ["customIllustrationStyle"],
    }
  ), [i18n.language, t]);

  type CreateStoryForm = z.infer<typeof createStorySchema>;

  const [lastFormData, setLastFormData] = useState<CreateStoryForm | null>(null);

  const form = useForm<CreateStoryForm>({
    resolver: zodResolver(createStorySchema),
    defaultValues: {
      prompt: "",
      author: "",
      age: "",
      illustrationStyle: "vibrant and colorful children's book illustration",
      customIllustrationStyle: "",
      foreword: "",
      images: [],
    },
  });

  const { data: samplePrompts } = useQuery<SamplePrompt[]>({
    queryKey: ["/api/sample-prompts"],
  });

  const handlePromptClick = (prompt: string) => {
    form.setValue("prompt", prompt);
  };

  const createStoryMutation = useMutation({
    mutationFn: async (data: CreateStoryForm): Promise<GenerationResponse> => {
      const formData = new FormData();
      formData.append("prompt", data.prompt);
      if (data.author) {
        formData.append("author", data.author);
      }
      if (data.age) {
        formData.append("age", data.age);
      }
      // Use custom illustration style if provided, otherwise use selected style
      const finalIllustrationStyle = data.illustrationStyle === "custom" && data.customIllustrationStyle
        ? data.customIllustrationStyle
        : data.illustrationStyle;
      formData.append("illustrationStyle", finalIllustrationStyle);
      if (data.foreword) {
        formData.append("foreword", data.foreword);
      }
      data.images.forEach(image => {
        formData.append("images", image);
      });

      // Get reCAPTCHA token for anonymous users
      try {
        const recaptchaToken = await executeRecaptcha('create_story');
        if (recaptchaToken) {
          formData.append("recaptchaToken", recaptchaToken);
        }
      } catch (recaptchaError) {
        console.error('reCAPTCHA error:', recaptchaError);
        // Continue without reCAPTCHA token - server will handle it
      }

      const response = await fetch("/api/storybooks", {
        method: "POST",
        body: formData,
        credentials: "include", // Include session cookie for authentication
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        // Backend returns either {error: string} or {message: string}
        const errorMessage = errorData.error || errorData.message || "Failed to create storybook";
        throw new Error(errorMessage);
      }

      return response.json();
    },
    onSuccess: async (data) => {
      try {
        setSessionId(data.sessionId);
        setIsGenerating(true);
        
        // Wrap toast calls in try-catch to prevent unhandled rejections
        try {
          // Show different message based on user type
          if (data.isAnonymous && data.rateLimitRemaining !== null) {
            toast({
              title: t('storybook.create.toast.started.title'),
              description: `${t('storybook.create.toast.started.description')} You have ${data.rateLimitRemaining} stories remaining today.`,
            });
          } else {
            toast({
              title: t('storybook.create.toast.started.title'),
              description: t('storybook.create.toast.started.description'),
            });
          }
        } catch (toastError) {
          console.error('Error showing toast:', toastError);
        }
      } catch (error) {
        console.error('Error in onSuccess:', error);
      }
    },
    onError: (error) => {
      // Ensure error is properly typed
      const errorMessage = error instanceof Error ? error.message : String(error || 'Failed to create storybook');
      
      // Replit Auth: Handle unauthorized error - redirect to login
      if (error instanceof Error && isUnauthorizedError(error)) {
        toast({
          title: t('storybook.create.toast.unauthorized.title'),
          description: t('storybook.create.toast.unauthorized.description'),
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/login";
        }, 500);
        return;
      }
      
      toast({
        title: t('storybook.create.toast.failed.title'),
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CreateStoryForm) => {
    console.log('🔵 onSubmit called');
    setLastFormData(data); // Save form data for retry
    setRetryCount(0); // Reset retry count on new submission
    
    console.log('🔵 Calling mutate (not mutateAsync)');
    // Use mutate instead of mutateAsync to avoid promise rejections entirely
    // All error handling is done through the onError callback
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
      
      // Use mutate instead of mutateAsync to avoid promise rejections
      createStoryMutation.mutate(lastFormData);
    }
  };

  if (isGenerating && sessionId) {
    return (
      <div className="min-h-screen bg-background">
        <SEO 
          title="Creating Your Storybook - AI Storybook Builder"
          description="Your personalized AI-generated storybook is being created with custom illustrations and characters."
          path="/create"
        />
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
      <SEO 
        title="Create Your Story - AI Storybook Builder"
        description="Create magical, personalized children's storybooks with AI. Describe your story and get beautiful custom illustrations with consistent characters."
        path="/create"
      />
      <Navigation />
      
      <section className="py-8 sm:py-12 lg:py-20">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 lg:px-8">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4">{t('storybook.create.title')}</h2>
            <p className="text-base sm:text-lg text-muted-foreground px-4">
              {t('storybook.create.subtitle')}
            </p>
          </div>

          <Card className="rounded-2xl sm:rounded-3xl shadow-xl">
            <CardContent className="p-5 sm:p-6 lg:p-8">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 sm:space-y-8">
                  {/* Sample Prompts */}
                  {samplePrompts && samplePrompts.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-base sm:text-sm font-semibold flex items-center">
                        <i className="fas fa-sparkles text-primary mr-2"></i>
                        {t('storybook.create.samplePrompts.label', 'Sample Story Ideas')}
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 gap-3 sm:gap-3">
                        {samplePrompts.map((samplePrompt) => (
                          <button
                            key={samplePrompt.id}
                            type="button"
                            onClick={() => handlePromptClick(samplePrompt.prompt)}
                            className="text-left p-5 sm:p-4 rounded-xl border-2 border-purple-200 dark:border-purple-900 bg-purple-50 dark:bg-purple-950/30 hover:border-purple-400 dark:hover:border-purple-700 hover:bg-purple-100 dark:hover:bg-purple-950/50 transition-all cursor-pointer active:scale-98 min-h-[80px] sm:min-h-0"
                            data-testid={`card-sample-prompt-${samplePrompt.id}`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-semibold text-purple-900 dark:text-purple-100 text-base sm:text-base" data-testid={`text-prompt-title-${samplePrompt.id}`}>
                                {samplePrompt.title}
                              </h4>
                              <span className="px-3 sm:px-2 py-1 bg-purple-200 dark:bg-purple-900 text-purple-800 dark:text-purple-200 text-xs rounded-full" data-testid={`badge-age-range-${samplePrompt.id}`}>
                                {samplePrompt.ageRange}
                              </span>
                            </div>
                            <p className="text-sm text-purple-700 dark:text-purple-300 line-clamp-2">
                              {samplePrompt.prompt.substring(0, 100)}...
                            </p>
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        <i className="fas fa-info-circle mr-1"></i>
                        {t('storybook.create.samplePrompts.helpText', 'Click a sample prompt to use it as inspiration for your story')}
                      </p>
                    </div>
                  )}

                  {/* Story Prompt */}
                  <FormField
                    control={form.control}
                    name="prompt"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                          <FormLabel className="text-base sm:text-sm font-semibold flex items-center">
                            <i className="fas fa-lightbulb text-primary mr-2"></i>
                            {t('storybook.create.storyIdea.label')}
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
                                {t('storybook.create.styleGuide.button')}
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle className="flex items-center gap-2 text-2xl">
                                  <i className="fas fa-palette text-primary"></i>
                                  {t('storybook.create.styleGuide.title')}
                                </DialogTitle>
                                <DialogDescription>
                                  {t('storybook.create.styleGuide.description')}
                                </DialogDescription>
                              </DialogHeader>
                              
                              <div className="space-y-6 mt-4">
                                {/* Realistic Styles */}
                                <div>
                                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                                    <span className="text-2xl">📸</span>
                                    {t('storybook.create.styleGuide.categories.realistic.title')}
                                  </h3>
                                  <div className="flex flex-wrap gap-2">
                                    {(t('storybook.create.styleGuide.categories.realistic.keywords', { returnObjects: true }) as string[]).map((style: string) => (
                                      <span key={style} className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                                        {style}
                                      </span>
                                    ))}
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-2" dangerouslySetInnerHTML={{ __html: `Example: ${t('storybook.create.styleGuide.categories.realistic.example')}` }} />
                                </div>

                                {/* Cartoon & Animation */}
                                <div>
                                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                                    <span className="text-2xl">🎨</span>
                                    {t('storybook.create.styleGuide.categories.cartoon.title')}
                                  </h3>
                                  <div className="flex flex-wrap gap-2">
                                    {(t('storybook.create.styleGuide.categories.cartoon.keywords', { returnObjects: true }) as string[]).map((style: string) => (
                                      <span key={style} className="px-3 py-1 bg-secondary/10 text-secondary rounded-full text-sm">
                                        {style}
                                      </span>
                                    ))}
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-2" dangerouslySetInnerHTML={{ __html: `Example: ${t('storybook.create.styleGuide.categories.cartoon.example')}` }} />
                                </div>

                                {/* Traditional Art */}
                                <div>
                                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                                    <span className="text-2xl">🖌️</span>
                                    {t('storybook.create.styleGuide.categories.traditional.title')}
                                  </h3>
                                  <div className="flex flex-wrap gap-2">
                                    {(t('storybook.create.styleGuide.categories.traditional.keywords', { returnObjects: true }) as string[]).map((style: string) => (
                                      <span key={style} className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm">
                                        {style}
                                      </span>
                                    ))}
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-2" dangerouslySetInnerHTML={{ __html: `Example: ${t('storybook.create.styleGuide.categories.traditional.example')}` }} />
                                </div>

                                {/* Digital & 3D */}
                                <div>
                                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                                    <span className="text-2xl">💻</span>
                                    {t('storybook.create.styleGuide.categories.digital.title')}
                                  </h3>
                                  <div className="flex flex-wrap gap-2">
                                    {(t('storybook.create.styleGuide.categories.digital.keywords', { returnObjects: true }) as string[]).map((style: string) => (
                                      <span key={style} className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-sm">
                                        {style}
                                      </span>
                                    ))}
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-2" dangerouslySetInnerHTML={{ __html: `Example: ${t('storybook.create.styleGuide.categories.digital.example')}` }} />
                                </div>

                                {/* Time Period Styles */}
                                <div>
                                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                                    <span className="text-2xl">⏰</span>
                                    {t('storybook.create.styleGuide.categories.timePeriod.title')}
                                  </h3>
                                  <div className="flex flex-wrap gap-2">
                                    {(t('storybook.create.styleGuide.categories.timePeriod.keywords', { returnObjects: true }) as string[]).map((style: string) => (
                                      <span key={style} className="px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full text-sm">
                                        {style}
                                      </span>
                                    ))}
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-2" dangerouslySetInnerHTML={{ __html: `Example: ${t('storybook.create.styleGuide.categories.timePeriod.example')}` }} />
                                </div>

                                {/* Artistic & Abstract */}
                                <div>
                                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                                    <span className="text-2xl">🎭</span>
                                    {t('storybook.create.styleGuide.categories.artistic.title')}
                                  </h3>
                                  <div className="flex flex-wrap gap-2">
                                    {(t('storybook.create.styleGuide.categories.artistic.keywords', { returnObjects: true }) as string[]).map((style: string) => (
                                      <span key={style} className="px-3 py-1 bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 rounded-full text-sm">
                                        {style}
                                      </span>
                                    ))}
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-2" dangerouslySetInnerHTML={{ __html: `Example: ${t('storybook.create.styleGuide.categories.artistic.example')}` }} />
                                </div>

                                {/* Tips */}
                                <div className="bg-muted/50 p-4 rounded-lg">
                                  <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                                    <i className="fas fa-lightbulb text-primary"></i>
                                    {t('storybook.create.styleGuide.tips.title')}
                                  </h3>
                                  <ul className="space-y-2 text-sm text-muted-foreground">
                                    {(t('storybook.create.styleGuide.tips.items', { returnObjects: true }) as string[]).map((tip: string, index: number) => (
                                      <li key={index}>{tip}</li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                        <FormControl>
                          <Textarea
                            {...field}
                            rows={8}
                            placeholder={t('storybook.create.storyIdea.placeholder')}
                            className="resize-none rounded-2xl text-base sm:text-sm"
                            data-testid="input-story-prompt"
                            style={{
                              fontSize: '16px', // Prevents zoom on iOS
                            }}
                          />
                        </FormControl>
                        <div className="text-sm text-muted-foreground">
                          <i className="fas fa-info-circle mr-1"></i>
                          {t('storybook.create.storyIdea.helpText')}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Age Field */}
                  <FormField
                    control={form.control}
                    name="age"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base sm:text-sm font-semibold flex items-center">
                          <i className="fas fa-child text-primary mr-2"></i>
                          Reader Age
                          <span className="ml-auto text-muted-foreground font-normal text-xs sm:text-xs">Optional</span>
                        </FormLabel>
                        <FormControl>
                          <select
                            {...field}
                            className="flex h-12 w-full items-center justify-between rounded-2xl border border-input bg-background px-4 py-3 text-base ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:h-10 md:px-3 md:py-2 md:text-sm"
                            data-testid="select-age"
                          >
                            <option value="">Any age</option>
                            <option value="3-5">3-5 years</option>
                            <option value="6-8">6-8 years</option>
                            <option value="9-12">9-12 years</option>
                          </select>
                        </FormControl>
                        <div className="text-sm text-muted-foreground">
                          <i className="fas fa-info-circle mr-1"></i>
                          The story will be tailored to this age group
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Illustration Style */}
                  <div className="space-y-2">
                    <label className="text-base sm:text-sm font-semibold flex items-center">
                      <i className="fas fa-palette text-primary mr-2"></i>
                      Illustration Style
                    </label>
                    <select
                      className="flex h-12 w-full items-center justify-between rounded-2xl border border-input bg-background px-4 py-3 text-base ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:h-10 md:px-3 md:py-2 md:text-sm"
                      value={form.watch("illustrationStyle")}
                      onChange={(e) => form.setValue("illustrationStyle", e.target.value)}
                      data-testid="select-illustration-style"
                    >
                      <option value="vibrant and colorful children's book illustration">Vibrant and colorful children's book illustration</option>
                      <option value="watercolor illustration style with soft, dreamy colors and gentle blending">Watercolor Illustration</option>
                      <option value="digital cartoon style with bold colors and clean lines">Digital Cartoon Style</option>
                      <option value="3D digital art style with depth and dimensionality">3D Digital Art</option>
                      <option value="vintage storybook style with classic, nostalgic aesthetic">Vintage Storybook</option>
                      <option value="kawaii cute style with adorable characters and big eyes">Kawaii/Cute Style</option>
                      <option value="comic book style with dynamic panels and bold outlines">Comic Book Style</option>
                      <option value="pastel drawing style with gentle, chalk-like textures">Pastel Drawing</option>
                      <option value="realistic illustration with photo-realistic, detailed artwork">Realistic Illustration</option>
                      <option value="minimalist flat design with simple shapes and limited colors">Minimalist Flat Design</option>
                      <option value="oil painting style with rich textures and classic artistic feel">Oil Painting Style</option>
                      <option value="custom">Custom (describe your own style)</option>
                    </select>
                    
                    {/* Custom Illustration Style Input */}
                    {form.watch("illustrationStyle") === "custom" && (
                      <FormField
                        control={form.control}
                        name="customIllustrationStyle"
                        render={({ field }) => (
                          <FormItem className="mt-3">
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="e.g., watercolor with gold accents, anime-inspired fantasy art..."
                                className="rounded-2xl"
                                data-testid="input-custom-illustration-style"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                    
                    <div className="text-sm text-muted-foreground">
                      <i className="fas fa-info-circle mr-1"></i>
                      Choose the art style for your storybook illustrations
                    </div>
                  </div>

                  {/* Author Field */}
                  <FormField
                    control={form.control}
                    name="author"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base sm:text-sm font-semibold flex items-center">
                          <i className="fas fa-user-pen text-primary mr-2"></i>
                          Author
                          <span className="ml-auto text-muted-foreground font-normal text-xs sm:text-xs">Optional</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Leave blank to use your name"
                            className="rounded-2xl"
                            autoComplete="name"
                            data-testid="input-author"
                          />
                        </FormControl>
                        <div className="text-sm text-muted-foreground">
                          <i className="fas fa-info-circle mr-1"></i>
                          If left blank, your full name will be used as the author
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Foreword/Dedication Field */}
                  <FormField
                    control={form.control}
                    name="foreword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base sm:text-sm font-semibold flex items-center">
                          <i className="fas fa-heart text-primary mr-2"></i>
                          Dedication / Foreword
                          <span className="ml-auto text-muted-foreground font-normal text-xs sm:text-xs">Optional</span>
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            rows={3}
                            maxLength={500}
                            placeholder="To my wonderful Mom - Happy Mother's Day! This story was made just for you with all my love. - Sarah"
                            className="resize-none rounded-2xl text-base sm:text-sm"
                            data-testid="input-foreword"
                            style={{
                              fontSize: '16px', // Prevents zoom on iOS
                            }}
                          />
                        </FormControl>
                        <div className="flex justify-between items-center text-sm text-muted-foreground">
                          <div>
                            <i className="fas fa-info-circle mr-1"></i>
                            Add a personal message for gift books (appears on first page)
                          </div>
                          <span className="text-xs">
                            {field.value?.length || 0}/500
                          </span>
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
                        <FormLabel className="text-base sm:text-sm font-semibold flex items-center">
                          <i className="fas fa-image text-secondary mr-2"></i>
                          {t('storybook.create.images.label')}
                          <span className="ml-auto text-muted-foreground font-normal text-xs sm:text-sm">{t('storybook.create.images.count')}</span>
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
                    className="w-full py-4 sm:py-4 rounded-2xl font-bold text-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg min-h-[56px] sm:min-h-[48px] active:scale-98"
                    disabled={createStoryMutation.isPending}
                    data-testid="button-generate-story"
                  >
                    {createStoryMutation.isPending ? (
                      <>
                        <i className="fas fa-spinner fa-spin mr-2"></i>
                        {t('storybook.create.generatingButton')}
                      </>
                    ) : (
                      <>
                        <i className="fas fa-magic mr-2"></i>
                        {t('storybook.create.generateButton')}
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
