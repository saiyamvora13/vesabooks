import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { useTranslation } from 'react-i18next';
import { SEO } from "@/components/SEO";

export default function ForgotPassword() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();

  const forgotPasswordSchema = useMemo(() => z.object({
    email: z.string().email(t('common.validation.emailInvalid')),
  }), [i18n.language]);

  type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

  const form = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const forgotPasswordMutation = useMutation({
    mutationFn: async (data: ForgotPasswordForm) => {
      const response = await apiRequest("POST", "/api/auth/forgot-password", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t('auth.forgotPassword.toast.success.title'),
        description: t('auth.forgotPassword.toast.success.description'),
      });
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: t('auth.forgotPassword.toast.error.title'),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ForgotPasswordForm) => {
    forgotPasswordMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
      <SEO 
        title="Reset Password - AI Storybook Builder"
        description="Reset your password to regain access to your AI Storybook Builder account and continue creating personalized children's stories."
        path="/forgot-password"
      />
      <Card className="w-full max-w-sm sm:max-w-md rounded-2xl shadow-xl">
        <CardContent className="p-6 sm:p-8">
          <div className="text-center mb-8 sm:mb-10">
            <h1 className="text-2xl sm:text-3xl font-bold mb-2">{t('auth.forgotPassword.title')}</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              {t('auth.forgotPassword.subtitle')}
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 sm:space-y-5">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base sm:text-sm">{t('common.labels.email')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        placeholder={t('common.placeholders.email')}
                        autoComplete="email"
                        className="rounded-lg"
                        data-testid="input-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full rounded-lg font-semibold text-base sm:text-sm"
                disabled={forgotPasswordMutation.isPending}
                data-testid="button-submit"
              >
                {forgotPasswordMutation.isPending ? t('auth.forgotPassword.buttonLoading') : t('auth.forgotPassword.button')}
              </Button>

              <div className="text-center text-sm sm:text-sm text-muted-foreground pt-2">
                {t('auth.forgotPassword.rememberPassword')}{" "}
                <Link 
                  href="/login" 
                  className="text-primary font-semibold hover:underline"
                  data-testid="link-login"
                >
                  {t('auth.forgotPassword.logInLink')}
                </Link>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
