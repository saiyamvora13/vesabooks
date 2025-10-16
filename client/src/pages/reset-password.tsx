import { useEffect, useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { useTranslation } from 'react-i18next';

export default function ResetPassword() {
  const { t, i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [token, setToken] = useState<string | null>(null);

  const resetPasswordSchema = useMemo(() => z.object({
    newPassword: z.string().min(8, t('common.validation.passwordMinLength')),
    confirmPassword: z.string().min(8, t('common.validation.passwordMinLength')),
  }).refine((data) => data.newPassword === data.confirmPassword, {
    message: t('common.validation.passwordsNoMatch'),
    path: ["confirmPassword"],
  }), [i18n.language]);

  type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

  useEffect(() => {
    const urlToken = new URLSearchParams(window.location.search).get('token');
    setToken(urlToken);
  }, []);

  const { data: tokenValid, isLoading: verifyingToken, error: tokenError } = useQuery<{ valid: boolean }>({
    queryKey: ['/api/auth/verify-reset-token', token],
    enabled: !!token,
  });

  const form = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (data: ResetPasswordForm) => {
      const response = await apiRequest("POST", "/api/auth/reset-password", {
        token,
        newPassword: data.newPassword,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t('auth.resetPassword.toast.success.title'),
        description: t('auth.resetPassword.toast.success.description'),
      });
      setTimeout(() => {
        setLocation("/login");
      }, 1000);
    },
    onError: (error: Error) => {
      toast({
        title: t('auth.resetPassword.toast.error.title'),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ResetPasswordForm) => {
    resetPasswordMutation.mutate(data);
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
        <Card className="w-full max-w-sm sm:max-w-md rounded-2xl shadow-xl">
          <CardContent className="p-6 sm:p-8">
            <div className="text-center">
              <h1 className="text-2xl sm:text-3xl font-bold mb-4">{t('auth.resetPassword.invalidTitle')}</h1>
              <p className="text-sm sm:text-base text-muted-foreground mb-6">
                {t('auth.resetPassword.invalidMessage')}
              </p>
              <Link href="/forgot-password">
                <Button className="rounded-lg font-semibold" data-testid="button-back-forgot">
                  {t('auth.resetPassword.backButton')}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (verifyingToken) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
        <Card className="w-full max-w-sm sm:max-w-md rounded-2xl shadow-xl">
          <CardContent className="p-6 sm:p-8">
            <div className="text-center">
              <p className="text-muted-foreground">{t('common.states.verifying')}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (tokenError || (tokenValid && !tokenValid.valid)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
        <Card className="w-full max-w-sm sm:max-w-md rounded-2xl shadow-xl">
          <CardContent className="p-6 sm:p-8">
            <div className="text-center">
              <h1 className="text-2xl sm:text-3xl font-bold mb-4" data-testid="text-error">
                {t('auth.resetPassword.expiredTitle')}
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground mb-6">
                {t('auth.resetPassword.expiredMessage')}
              </p>
              <Link href="/forgot-password">
                <Button className="rounded-lg font-semibold" data-testid="button-back-forgot">
                  {t('auth.resetPassword.backButton')}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
      <Card className="w-full max-w-sm sm:max-w-md rounded-2xl shadow-xl">
        <CardContent className="p-6 sm:p-8">
          <div className="text-center mb-8 sm:mb-10">
            <h1 className="text-2xl sm:text-3xl font-bold mb-2">{t('auth.resetPassword.title')}</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              {t('auth.resetPassword.subtitle')}
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 sm:space-y-5">
              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base sm:text-sm">{t('auth.resetPassword.labels.newPassword')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        placeholder={t('auth.resetPassword.placeholders.newPassword')}
                        autoComplete="new-password"
                        className="rounded-lg"
                        data-testid="input-new-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base sm:text-sm">{t('auth.resetPassword.labels.confirmPassword')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        placeholder={t('auth.resetPassword.placeholders.confirmPassword')}
                        autoComplete="new-password"
                        className="rounded-lg"
                        data-testid="input-confirm-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full rounded-lg font-semibold text-base sm:text-sm"
                disabled={resetPasswordMutation.isPending}
                data-testid="button-submit"
              >
                {resetPasswordMutation.isPending ? t('auth.resetPassword.buttonLoading') : t('auth.resetPassword.button')}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
