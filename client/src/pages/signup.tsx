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
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import { useTranslation } from 'react-i18next';
import { SEO } from "@/components/SEO";

export default function Signup() {
  const { t, i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const signupSchema = useMemo(() => z.object({
    email: z.string().email(t('common.validation.emailInvalid')),
    password: z.string().min(8, t('common.validation.passwordMinLength')),
    confirmPassword: z.string().min(8, t('common.validation.passwordMinLength')),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
  }).refine((data) => data.password === data.confirmPassword, {
    message: t('common.validation.passwordsNoMatch'),
    path: ["confirmPassword"],
  }), [i18n.language, t]);

  type SignupForm = z.infer<typeof signupSchema>;

  const form = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      firstName: "",
      lastName: "",
    },
  });

  const signupMutation = useMutation({
    mutationFn: async (data: SignupForm) => {
      // Remove confirmPassword before sending to backend
      const { confirmPassword, ...signupData } = data;
      const response = await apiRequest("POST", "/api/auth/signup", signupData);
      return response.json();
    },
    onSuccess: async () => {
      toast({
        title: t('auth.signup.toast.success.title'),
        description: t('auth.signup.toast.success.description'),
      });
      
      // Refetch auth state and wait for it to complete before redirecting
      await queryClient.refetchQueries({ queryKey: ["/api/auth/user"] });
      
      setTimeout(() => {
        setLocation("/library");
      }, 100);
    },
    onError: (error: Error) => {
      toast({
        title: t('auth.signup.toast.error.title'),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: SignupForm) => {
    signupMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
      <SEO 
        title="Sign Up - AI Storybook Builder"
        description="Create your free account to start making magical, personalized children's storybooks with AI-generated illustrations."
        path="/signup"
      />
      <Card className="w-full max-w-sm sm:max-w-md rounded-2xl shadow-xl">
        <CardContent className="p-6 sm:p-8">
          <div className="text-center mb-8 sm:mb-10">
            <div className="flex justify-center mb-4">
              <img 
                src="/favicon.png" 
                alt="StoryBook AI Logo" 
                className="w-16 h-16 rounded-xl"
              />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold mb-2">{t('auth.signup.title')}</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              {t('auth.signup.subtitle')}
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
                        placeholder={t('common.placeholders.passwordMinLength')}
                        autoComplete="new-password"
                        className="rounded-lg"
                        data-testid="input-password"
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
                    <FormLabel className="text-base sm:text-sm">{t('common.labels.confirmPassword')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        placeholder={t('common.placeholders.confirmPassword')}
                        autoComplete="new-password"
                        className="rounded-lg"
                        data-testid="input-confirm-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base sm:text-sm">{t('common.labels.firstName')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="text"
                        placeholder={t('common.placeholders.firstName')}
                        autoComplete="given-name"
                        className="rounded-lg"
                        data-testid="input-firstname"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base sm:text-sm">{t('common.labels.lastName')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="text"
                        placeholder={t('common.placeholders.lastName')}
                        autoComplete="family-name"
                        className="rounded-lg"
                        data-testid="input-lastname"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full rounded-lg font-semibold text-base sm:text-sm"
                disabled={signupMutation.isPending}
                data-testid="button-signup"
              >
                {signupMutation.isPending ? t('auth.signup.buttonLoading') : t('auth.signup.button')}
              </Button>

              <div className="text-center text-sm sm:text-sm text-muted-foreground pt-2">
                {t('auth.signup.haveAccount')}{" "}
                <Link 
                  href="/login" 
                  className="text-primary font-semibold hover:underline"
                  data-testid="link-login"
                >
                  {t('auth.signup.logInLink')}
                </Link>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
