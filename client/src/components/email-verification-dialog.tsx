import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const emailSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

const codeSchema = z.object({
  code: z.string().length(6, "Verification code must be 6 digits"),
});

type EmailForm = z.infer<typeof emailSchema>;
type CodeForm = z.infer<typeof codeSchema>;

interface EmailVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storybookId: string;
  onVerified: (email: string) => void;
}

export function EmailVerificationDialog({
  open,
  onOpenChange,
  storybookId,
  onVerified,
}: EmailVerificationDialogProps) {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const emailForm = useForm<EmailForm>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: '' },
  });

  const codeForm = useForm<CodeForm>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: '' },
  });

  const requestCode = async (data: EmailForm) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/storybooks/${storybookId}/request-download-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to send verification code');
      }

      const result = await response.json();
      setEmail(data.email);
      setStep('code');
      toast({
        title: "Verification code sent",
        description: `Check ${data.email} for your 6-digit code. Code: ${result.code}`,
      });
    } catch (error) {
      toast({
        title: "Failed to send code",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const verifyCode = async (data: CodeForm) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/storybooks/${storybookId}/verify-download-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: data.code }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Invalid verification code');
      }

      toast({
        title: "Email verified!",
        description: "You can now download the storybook",
      });
      
      onVerified(email);
      onOpenChange(false);
      
      // Reset forms
      setStep('email');
      emailForm.reset();
      codeForm.reset();
    } catch (error) {
      toast({
        title: "Verification failed",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === 'email' ? 'Enter Your Email' : 'Enter Verification Code'}
          </DialogTitle>
          <DialogDescription>
            {step === 'email' 
              ? 'We\'ll send you a verification code to download this storybook'
              : `Enter the 6-digit code sent to ${email}`
            }
          </DialogDescription>
        </DialogHeader>

        {step === 'email' ? (
          <Form {...emailForm}>
            <form onSubmit={emailForm.handleSubmit(requestCode)} className="space-y-4">
              <FormField
                control={emailForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="email" 
                        placeholder="your@email.com"
                        data-testid="input-verification-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading}
                data-testid="button-send-code"
              >
                {isLoading ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    Sending...
                  </>
                ) : (
                  'Send Verification Code'
                )}
              </Button>
            </form>
          </Form>
        ) : (
          <Form {...codeForm}>
            <form onSubmit={codeForm.handleSubmit(verifyCode)} className="space-y-4">
              <FormField
                control={codeForm.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Verification Code</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="000000" 
                        maxLength={6}
                        data-testid="input-verification-code"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setStep('email')}
                  className="flex-1"
                  data-testid="button-back"
                >
                  Back
                </Button>
                <Button 
                  type="submit" 
                  className="flex-1" 
                  disabled={isLoading}
                  data-testid="button-verify-code"
                >
                  {isLoading ? (
                    <>
                      <i className="fas fa-spinner fa-spin mr-2"></i>
                      Verifying...
                    </>
                  ) : (
                    'Verify'
                  )}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
