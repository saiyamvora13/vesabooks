import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import ProtectedAdminRoute from "@/components/admin/ProtectedAdminRoute";
import AdminLayout from "@/components/admin/AdminLayout";
import StorybookSelector from "@/components/admin/StorybookSelector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { FeaturedStorybook, Storybook } from "@shared/schema";
import { Sparkles, BookOpen, Trash2, Plus, MoveUp, MoveDown } from "lucide-react";

interface FeaturedWithStorybook extends FeaturedStorybook {
  storybook?: Storybook;
}

export default function FeaturedContent() {
  const { toast } = useToast();
  const [selectorOpen, setSelectorOpen] = useState(false);

  const { data: featuredList, isLoading: featuredLoading } = useQuery<FeaturedStorybook[]>({
    queryKey: ["/api/admin/featured"],
  });

  const { data: storybooks } = useQuery<Storybook[]>({
    queryKey: ["/api/storybooks"],
  });

  const addFeaturedMutation = useMutation({
    mutationFn: async (storybookId: string) => {
      const maxRank = featuredList?.reduce((max, item) => Math.max(max, Number(item.rank)), 0) || 0;
      const response = await apiRequest("POST", "/api/admin/featured", {
        storybookId,
        rank: maxRank + 1,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/featured"] });
      toast({
        title: "Featured Added",
        description: "Storybook has been added to featured list",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Add",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const removeFeaturedMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/admin/featured/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/featured"] });
      toast({
        title: "Featured Removed",
        description: "Storybook has been removed from featured list",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Remove",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateRankMutation = useMutation({
    mutationFn: async ({ id, newRank }: { id: string; newRank: number }) => {
      const response = await apiRequest("PUT", `/api/admin/featured/${id}`, { rank: newRank });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/featured"] });
    },
  });

  const handleSelectStorybook = (storybook: Storybook) => {
    addFeaturedMutation.mutate(storybook.id);
  };

  const handleMoveUp = (item: FeaturedStorybook, index: number) => {
    if (index === 0) return;
    const prevItem = sortedFeatured[index - 1];
    updateRankMutation.mutate({ id: item.id, newRank: Number(prevItem.rank) });
    updateRankMutation.mutate({ id: prevItem.id, newRank: Number(item.rank) });
  };

  const handleMoveDown = (item: FeaturedStorybook, index: number) => {
    if (index === sortedFeatured.length - 1) return;
    const nextItem = sortedFeatured[index + 1];
    updateRankMutation.mutate({ id: item.id, newRank: Number(nextItem.rank) });
    updateRankMutation.mutate({ id: nextItem.id, newRank: Number(item.rank) });
  };

  const getStorybookById = (id: string) => {
    return storybooks?.find(sb => sb.id === id);
  };

  const sortedFeatured = featuredList?.sort((a, b) => Number(a.rank) - Number(b.rank)) || [];

  const featuredWithStorybooks: FeaturedWithStorybook[] = sortedFeatured.map(featured => ({
    ...featured,
    storybook: getStorybookById(featured.storybookId),
  }));

  return (
    <ProtectedAdminRoute>
      <AdminLayout>
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-100 mb-2">Featured Content</h1>
              <p className="text-slate-400">Manage featured storybooks displayed on the site</p>
            </div>
            <Button
              onClick={() => setSelectorOpen(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white"
              data-testid="button-add-featured"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Featured
            </Button>
          </div>

          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-slate-100 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-500" />
                Featured Storybooks
              </CardTitle>
            </CardHeader>
            <CardContent>
              {featuredLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-24 bg-slate-800" />
                  ))}
                </div>
              ) : featuredWithStorybooks.length === 0 ? (
                <div className="text-center py-12">
                  <Sparkles className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">No featured storybooks yet</p>
                  <p className="text-sm text-slate-500 mt-1">Click "Add Featured" to get started</p>
                </div>
              ) : (
                <div className="space-y-3" data-testid="list-featured">
                  {featuredWithStorybooks.map((item, index) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-4 p-4 rounded-lg bg-slate-950 border border-slate-800"
                    >
                      <div className="flex flex-col gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleMoveUp(item, index)}
                          disabled={index === 0}
                          className="h-8 w-8 text-slate-400 hover:text-slate-200"
                        >
                          <MoveUp className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleMoveDown(item, index)}
                          disabled={index === featuredWithStorybooks.length - 1}
                          className="h-8 w-8 text-slate-400 hover:text-slate-200"
                        >
                          <MoveDown className="w-4 h-4" />
                        </Button>
                      </div>

                      {item.storybook?.coverImageUrl ? (
                        <img
                          src={item.storybook.coverImageUrl}
                          alt={item.storybook.title}
                          className="w-16 h-20 object-cover rounded"
                        />
                      ) : (
                        <div className="w-16 h-20 bg-slate-800 rounded flex items-center justify-center">
                          <BookOpen className="w-6 h-6 text-slate-600" />
                        </div>
                      )}

                      <div className="flex-1">
                        <h3 className="font-semibold text-slate-100">
                          {item.storybook?.title || "Unknown Storybook"}
                        </h3>
                        <p className="text-sm text-slate-400">Rank: {item.rank}</p>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFeaturedMutation.mutate(item.id)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-950"
                        data-testid="button-remove-featured"
                      >
                        <Trash2 className="w-5 h-5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <StorybookSelector
          open={selectorOpen}
          onOpenChange={setSelectorOpen}
          onSelect={handleSelectStorybook}
        />
      </AdminLayout>
    </ProtectedAdminRoute>
  );
}
