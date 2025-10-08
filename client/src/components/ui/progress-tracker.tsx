import { useEffect, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { type StoryGenerationProgress } from "@shared/schema";
import { AlertCircle } from "lucide-react";

interface ProgressTrackerProps {
  sessionId: string;
  onComplete: (storybookId: string) => void;
  onRetry?: () => void;
  shouldAutoRetry?: boolean;
  "data-testid"?: string;
}

const progressSteps = [
  { key: 'processing_images', label: 'Converting images', icon: 'fas fa-image' },
  { key: 'generating_story', label: 'Generating story outline', icon: 'fas fa-book' },
  { key: 'generating_illustrations', label: 'Creating illustrations', icon: 'fas fa-palette' },
  { key: 'finalizing', label: 'Finalizing storybook', icon: 'fas fa-check-circle' },
] as const;

export function ProgressTracker({ sessionId, onComplete, onRetry, shouldAutoRetry = false, "data-testid": testId }: ProgressTrackerProps) {
  const [isComplete, setIsComplete] = useState(false);
  const [hasError, setHasError] = useState(false);
  const hasAutoRetried = useRef(false);

  const { data: progress, isLoading } = useQuery<StoryGenerationProgress>({
    queryKey: ['/api/generation', sessionId, 'progress'],
    refetchInterval: (isComplete || hasError) ? false : 2000, // Poll every 2 seconds unless complete or error
    enabled: !!sessionId && !isComplete && !hasError,
  });

  useEffect(() => {
    // Check for errors
    if (progress?.error || progress?.message?.startsWith('Generation failed:')) {
      setHasError(true);
      
      // Auto-retry once (only if shouldAutoRetry is true and we haven't retried yet)
      if (shouldAutoRetry && !hasAutoRetried.current && onRetry) {
        hasAutoRetried.current = true;
        console.log('Auto-retrying generation...');
        setTimeout(() => {
          onRetry();
        }, 2000);
      }
      return;
    }

    // Check for completion
    if (progress?.progress === 100 && progress?.step === 'finalizing') {
      setIsComplete(true);
      // The storybook ID is stored in the message field when complete
      const storybookId = progress.message;
      if (storybookId) {
        setTimeout(() => {
          onComplete(storybookId);
        }, 2000); // Small delay to show completion
      }
    }
  }, [progress, onComplete, onRetry]);

  if (isLoading || !progress) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <Card className="rounded-3xl shadow-xl">
          <CardContent className="p-12 text-center">
            <div className="w-24 h-24 mx-auto bg-gradient-to-br from-primary to-secondary rounded-3xl flex items-center justify-center animate-pulse mb-8">
              <i className="fas fa-wand-magic-sparkles text-white text-4xl"></i>
            </div>
            <h2 className="text-2xl font-bold mb-4">Initializing...</h2>
            <p className="text-muted-foreground">Starting your storybook generation...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStepStatus = (stepKey: string) => {
    const currentStepIndex = progressSteps.findIndex(s => s.key === progress.step);
    const stepIndex = progressSteps.findIndex(s => s.key === stepKey);
    
    if (stepIndex < currentStepIndex) return 'complete';
    if (stepIndex === currentStepIndex) return 'active';
    return 'pending';
  };

  // Show error state (always show retry button when there's an error)
  if (hasError) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8" data-testid={testId}>
        <Card className="rounded-3xl shadow-xl border-destructive/50">
          <CardContent className="p-12 text-center">
            {/* Error Icon */}
            <div className="mb-8">
              <div className="w-24 h-24 mx-auto bg-destructive/10 rounded-3xl flex items-center justify-center">
                <AlertCircle className="text-destructive w-12 h-12" />
              </div>
            </div>

            <h2 className="text-2xl font-bold mb-4">Generation Failed</h2>
            <p className="text-muted-foreground mb-8">
              {progress?.message || 'An error occurred while generating your storybook. The AI service may be temporarily unavailable or overloaded.'}
            </p>

            {/* Retry Button */}
            {onRetry && (
              <Button 
                onClick={onRetry}
                className="gradient-bg hover:opacity-90"
                data-testid="button-retry-generation"
              >
                <i className="fas fa-redo mr-2"></i>
                Try Again
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8" data-testid={testId}>
      <Card className="rounded-3xl shadow-xl">
        <CardContent className="p-12 text-center">
          {/* Animated Icon */}
          <div className="mb-8">
            <div className={`w-24 h-24 mx-auto bg-gradient-to-br from-primary to-secondary rounded-3xl flex items-center justify-center ${isComplete ? '' : 'animate-pulse'}`}>
              <i className={`fas ${isComplete ? 'fa-check' : 'fa-wand-magic-sparkles'} text-white text-4xl`}></i>
            </div>
          </div>

          <h2 className="text-2xl font-bold mb-4">
            {isComplete ? 'Your Magical Storybook is Ready!' : 'Creating Your Magical Storybook...'}
          </h2>
          <p className="text-muted-foreground mb-8">
            {isComplete 
              ? 'Redirecting you to your beautiful storybook...' 
              : 'This usually takes 2-3 minutes. Please don\'t close this page.'
            }
          </p>

          {/* Progress Bar */}
          <div className="mb-8">
            <Progress value={progress.progress || 0} className="h-3" />
            <div className="mt-2 text-sm font-medium text-primary">
              {Math.round(progress.progress || 0)}% Complete
            </div>
          </div>

          {/* Progress Steps */}
          <div className="space-y-4">
            {progressSteps.map((step) => {
              const status = getStepStatus(step.key);
              
              return (
                <div 
                  key={step.key}
                  className={`flex items-center justify-between p-4 rounded-xl ${
                    status === 'active' 
                      ? 'bg-primary/10 border-2 border-primary' 
                      : 'bg-muted/30'
                  } ${status === 'pending' ? 'opacity-50' : ''}`}
                  data-testid={`progress-step-${step.key}`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      status === 'complete' 
                        ? 'bg-primary' 
                        : status === 'active'
                        ? 'bg-primary'
                        : 'bg-border'
                    }`}>
                      <i className={`${
                        status === 'complete' 
                          ? 'fas fa-check' 
                          : status === 'active'
                          ? 'fas fa-spinner fa-spin'
                          : 'fas fa-clock'
                      } ${
                        status === 'complete' || status === 'active'
                          ? 'text-white'
                          : 'text-muted-foreground'
                      } text-sm`}></i>
                    </div>
                    <span className={`font-medium ${
                      status === 'active' ? 'text-primary' : ''
                    }`}>
                      {step.label}
                    </span>
                  </div>
                  <span className={`text-sm ${
                    status === 'complete' 
                      ? 'text-muted-foreground' 
                      : status === 'active'
                      ? 'text-primary'
                      : 'text-muted-foreground'
                  }`}>
                    {status === 'complete' 
                      ? 'Complete' 
                      : status === 'active'
                      ? 'In progress...'
                      : 'Pending'
                    }
                  </span>
                </div>
              );
            })}
          </div>

          {/* Current Status */}
          {progress.message && !isComplete && (
            <div className="mt-6 text-sm text-muted-foreground">
              {progress.message}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
