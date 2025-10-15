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
import { HeroStorybookSlot, Storybook } from "@shared/schema";
import { Star, BookOpen, Plus } from "lucide-react";

export default function HeroManagement() {
  const { toast } = useToast();
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [selectorOpen, setSelectorOpen] = useState(false);

  const { data: heroSlots, isLoading: slotsLoading } = useQuery<HeroStorybookSlot[]>({
    queryKey: ["/api/admin/hero-slots"],
  });

  const { data: storybooks } = useQuery<Storybook[]>({
    queryKey: ["/api/storybooks"],
  });

  const updateSlotMutation = useMutation({
    mutationFn: async ({ slotNumber, storybookId }: { slotNumber: number; storybookId: string }) => {
      const response = await apiRequest("PUT", `/api/admin/hero-slots/${slotNumber}`, { storybookId });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/hero-slots"] });
      toast({
        title: "Hero Slot Updated",
        description: "The hero slot has been updated successfully",
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

  const handleSelectStorybook = (storybook: Storybook) => {
    if (selectedSlot !== null) {
      updateSlotMutation.mutate({
        slotNumber: selectedSlot,
        storybookId: storybook.id,
      });
    }
  };

  const openSelector = (slotNumber: number) => {
    setSelectedSlot(slotNumber);
    setSelectorOpen(true);
  };

  const getStorybookById = (id: string | null) => {
    if (!id || !storybooks) return null;
    return storybooks.find(sb => sb.id === id);
  };

  return (
    <ProtectedAdminRoute>
      <AdminLayout>
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-100 mb-2">Hero Management</h1>
            <p className="text-slate-400">Manage featured storybooks on the homepage hero section</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {slotsLoading ? (
              [...Array(3)].map((_, i) => (
                <Card key={i} className="bg-slate-900 border-slate-800">
                  <CardContent className="p-6">
                    <Skeleton className="h-64 bg-slate-800 mb-4" />
                    <Skeleton className="h-6 bg-slate-800" />
                  </CardContent>
                </Card>
              ))
            ) : (
              [1, 2, 3].map((slotNumber) => {
                const slot = heroSlots?.find(s => Number(s.slotNumber) === slotNumber);
                const storybook = getStorybookById(slot?.storybookId || null);

                return (
                  <Card 
                    key={slotNumber} 
                    className="bg-slate-900 border-slate-800"
                    data-testid={`hero-slot-${slotNumber}`}
                  >
                    <CardHeader>
                      <CardTitle className="text-slate-100 flex items-center gap-2">
                        <Star className="w-5 h-5 text-purple-500" />
                        Hero Slot {slotNumber}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {storybook ? (
                        <div className="space-y-3">
                          {storybook.coverImageUrl ? (
                            <img
                              src={storybook.coverImageUrl}
                              alt={storybook.title}
                              className="w-full h-64 object-cover rounded-lg"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-64 bg-slate-800 rounded-lg flex items-center justify-center">
                              <BookOpen className="w-16 h-16 text-slate-600" />
                            </div>
                          )}
                          <div>
                            <h3 className="font-semibold text-slate-100 line-clamp-2">
                              {storybook.title}
                            </h3>
                            <p className="text-sm text-slate-400 mt-1">
                              {slot?.isActive ? "Active" : "Inactive"}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="h-64 bg-slate-800 rounded-lg flex items-center justify-center border-2 border-dashed border-slate-700">
                          <div className="text-center">
                            <Plus className="w-12 h-12 text-slate-600 mx-auto mb-2" />
                            <p className="text-slate-500">Empty Slot</p>
                          </div>
                        </div>
                      )}

                      <Button
                        onClick={() => openSelector(slotNumber)}
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                        data-testid="button-select-storybook"
                      >
                        {storybook ? "Change Storybook" : "Select Storybook"}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
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
