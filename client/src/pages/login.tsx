import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { useTranslation } from 'react-i18next';
import { SEO } from "@/components/SEO";

export default function Login() {
  const { t, i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const loginSchema = useMemo(() => z.object({
    email: z.string().email(t('common.validation.emailInvalid')),
    password: z.string().min(1, t('common.validation.passwordRequired')),
  }), [i18n.language]);

  type LoginForm = z.infer<typeof loginSchema>;

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginForm) => {
      const response = await apiRequest("POST", "/api/auth/login", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t('auth.login.toast.success.title'),
        description: t('auth.login.toast.success.description'),
      });
      setTimeout(() => {
        setLocation("/library");
      }, 500);
    },
    onError: (error: Error) => {
      toast({
        title: t('auth.login.toast.error.title'),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: LoginForm) => {
    loginMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
      <SEO 
        title="Login - AI Storybook Builder"
        description="Sign in to your account to create, view, and manage your personalized AI-generated storybooks."
        path="/login"
      />
      <Card className="w-full max-w-sm sm:max-w-md rounded-2xl shadow-xl">
        <CardContent className="p-6 sm:p-8">
          <div className="text-center mb-8 sm:mb-10">
            <h1 className="text-2xl sm:text-3xl font-bold mb-2">{t('auth.login.title')}</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              {t('auth.login.subtitle')}
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

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base sm:text-sm">{t('common.labels.password')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        placeholder={t('common.placeholders.password')}
                        autoComplete="current-password"
                        className="rounded-lg"
                        data-testid="input-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="text-right">
                <Link 
                  href="/forgot-password" 
                  className="text-sm text-primary hover:underline p-1"
                  data-testid="link-forgot-password"
                >
                  {t('auth.login.forgotPassword')}
                </Link>
              </div>

              <Button
                type="submit"
                className="w-full rounded-lg font-semibold text-base sm:text-sm"
                disabled={loginMutation.isPending}
                data-testid="button-login"
              >
                {loginMutation.isPending ? t('auth.login.buttonLoading') : t('auth.login.button')}
              </Button>

              <div className="text-center text-sm sm:text-sm text-muted-foreground pt-2">
                {t('auth.login.noAccount')}{" "}
                <Link 
                  href="/signup" 
                  className="text-primary font-semibold hover:underline"
                  data-testid="link-signup"
                >
                  {t('auth.login.signUpLink')}
                </Link>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
