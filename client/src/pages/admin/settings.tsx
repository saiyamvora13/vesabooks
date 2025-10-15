import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import ProtectedAdminRoute from "@/components/admin/ProtectedAdminRoute";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { SiteSetting } from "@shared/schema";
import { Save } from "lucide-react";

const settingsSchema = z.object({
  pages_per_book: z.string().min(1, "Required").refine(val => !isNaN(Number(val)) && Number(val) > 0, "Must be a positive number"),
  digital_price: z.string().min(1, "Required").refine(val => !isNaN(Number(val)) && Number(val) >= 0, "Must be a valid price"),
  print_price: z.string().min(1, "Required").refine(val => !isNaN(Number(val)) && Number(val) >= 0, "Must be a valid price"),
});

type SettingsForm = z.infer<typeof settingsSchema>;

export default function AdminSettings() {
  const { toast } = useToast();

  const { data: settings, isLoading, error } = useQuery<SiteSetting[]>({
    queryKey: ["/api/admin/settings"],
  });

  const settingsMap = settings?.reduce((acc, setting) => {
    acc[setting.key] = setting.value;
    return acc;
  }, {} as Record<string, string>) || {};

  const form = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
    values: {
      pages_per_book: settingsMap.pages_per_book || "",
      digital_price: settingsMap.digital_price || "",
      print_price: settingsMap.print_price || "",
    },
  });

  const updateSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const response = await apiRequest("PUT", `/api/admin/settings/${key}`, { value });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      toast({
        title: "Settings Updated",
        description: "Your changes have been saved successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: SettingsForm) => {
    const updates = [
      { key: "pages_per_book", value: data.pages_per_book },
      { key: "digital_price", value: data.digital_price },
      { key: "print_price", value: data.print_price },
    ];

    for (const update of updates) {
      await updateSettingMutation.mutateAsync(update);
    }
  };

  return (
    <ProtectedAdminRoute>
      <AdminLayout>
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-100 mb-2">General Settings</h1>
            <p className="text-slate-400">Manage site configuration and pricing</p>
          </div>

          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-slate-100">Site Configuration</CardTitle>
              <CardDescription className="text-slate-400">
                Update global settings for the storybook builder
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-6">
                  <Skeleton className="h-20 bg-slate-800" />
                  <Skeleton className="h-20 bg-slate-800" />
                  <Skeleton className="h-20 bg-slate-800" />
                </div>
              ) : error ? (
                <div className="text-center py-8">
                  <p className="text-red-400 mb-4">Failed to load settings: {error instanceof Error ? error.message : 'Unknown error'}</p>
                  <Button onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] })} variant="outline" className="border-slate-700 text-slate-300">
                    Retry
                  </Button>
                </div>
              ) : (
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="pages_per_book"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-300">Pages Per Book</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                              placeholder="10"
                              className="bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-500"
                              data-testid="input-pages-per-book"
                            />
                          </FormControl>
                          <FormDescription className="text-slate-500">
                            Number of pages in each generated storybook
                          </FormDescription>
                          <FormMessage className="text-red-400" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="digital_price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-300">Digital Price ($)</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                              step="0.01"
                              placeholder="9.99"
                              className="bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-500"
                              data-testid="input-digital-price"
                            />
                          </FormControl>
                          <FormDescription className="text-slate-500">
                            Price for digital (PDF/EPUB) version
                          </FormDescription>
                          <FormMessage className="text-red-400" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="print_price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-300">Print Price ($)</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                              step="0.01"
                              placeholder="24.99"
                              className="bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-500"
                              data-testid="input-print-price"
                            />
                          </FormControl>
                          <FormDescription className="text-slate-500">
                            Price for print version of the book
                          </FormDescription>
                          <FormMessage className="text-red-400" />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                      disabled={updateSettingMutation.isPending}
                      data-testid="button-save-settings"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {updateSettingMutation.isPending ? "Saving..." : "Save Settings"}
                    </Button>
                  </form>
                </Form>
              )}
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    </ProtectedAdminRoute>
  );
}
