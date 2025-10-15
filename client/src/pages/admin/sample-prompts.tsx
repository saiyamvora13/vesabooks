import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import ProtectedAdminRoute from "@/components/admin/ProtectedAdminRoute";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { SamplePrompt } from "@shared/schema";
import { Lightbulb, Plus, Trash2, MoveUp, MoveDown, Edit, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function AdminSamplePrompts() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<SamplePrompt | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    prompt: "",
    ageRange: "",
    isActive: true,
    displayOrder: '0',
  });

  const { data: prompts, isLoading, error } = useQuery<SamplePrompt[]>({
    queryKey: ["/api/admin/sample-prompts"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest("POST", "/api/admin/sample-prompts", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sample-prompts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sample-prompts"] });
      toast({
        title: "Success",
        description: "Sample prompt created successfully",
      });
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Create",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      const response = await apiRequest("PUT", `/api/admin/sample-prompts/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sample-prompts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sample-prompts"] });
      toast({
        title: "Success",
        description: "Sample prompt updated successfully",
      });
      setDialogOpen(false);
      setEditingPrompt(null);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Update",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/admin/sample-prompts/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sample-prompts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sample-prompts"] });
      toast({
        title: "Success",
        description: "Sample prompt deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Delete",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      prompt: "",
      ageRange: "",
      isActive: true,
      displayOrder: '0',
    });
    setEditingPrompt(null);
  };

  const handleAdd = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleEdit = (prompt: SamplePrompt) => {
    setEditingPrompt(prompt);
    setFormData({
      title: prompt.title,
      prompt: prompt.prompt,
      ageRange: prompt.ageRange,
      isActive: prompt.isActive,
      displayOrder: prompt.displayOrder,
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingPrompt) {
      updateMutation.mutate({ id: editingPrompt.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleMoveUp = (prompt: SamplePrompt, index: number) => {
    if (index === 0 || !sortedPrompts) return;
    const prevPrompt = sortedPrompts[index - 1];
    updateMutation.mutate({ 
      id: prompt.id, 
      data: { displayOrder: prevPrompt.displayOrder } 
    });
    updateMutation.mutate({ 
      id: prevPrompt.id, 
      data: { displayOrder: prompt.displayOrder } 
    });
  };

  const handleMoveDown = (prompt: SamplePrompt, index: number) => {
    if (!sortedPrompts || index === sortedPrompts.length - 1) return;
    const nextPrompt = sortedPrompts[index + 1];
    updateMutation.mutate({ 
      id: prompt.id, 
      data: { displayOrder: nextPrompt.displayOrder } 
    });
    updateMutation.mutate({ 
      id: nextPrompt.id, 
      data: { displayOrder: prompt.displayOrder } 
    });
  };

  const sortedPrompts = prompts?.sort((a, b) => Number(a.displayOrder) - Number(b.displayOrder));

  return (
    <ProtectedAdminRoute>
      <AdminLayout>
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-100 mb-2">Sample Prompts</h1>
              <p className="text-slate-400">Manage sample story prompts for users</p>
            </div>
            <Button
              onClick={handleAdd}
              className="bg-purple-600 hover:bg-purple-700 text-white"
              data-testid="button-add-prompt"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Prompt
            </Button>
          </div>

          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-slate-100 flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-purple-500" />
                Sample Story Prompts
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-24 bg-slate-800" />
                  ))}
                </div>
              ) : error ? (
                <div className="text-center py-8">
                  <p className="text-red-400 mb-4">Failed to load sample prompts: {error instanceof Error ? error.message : 'Unknown error'}</p>
                  <Button onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/sample-prompts"] })} variant="outline" className="border-slate-700 text-slate-300">
                    Retry
                  </Button>
                </div>
              ) : !sortedPrompts || sortedPrompts.length === 0 ? (
                <div className="text-center py-12">
                  <Lightbulb className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">No sample prompts yet</p>
                  <p className="text-sm text-slate-500 mt-1">Click "Add Prompt" to get started</p>
                </div>
              ) : (
                <div className="space-y-3" data-testid="list-prompts">
                  {sortedPrompts.map((prompt, index) => (
                    <div
                      key={prompt.id}
                      className="flex items-start gap-4 p-4 rounded-lg bg-slate-950 border border-slate-800"
                      data-testid={`prompt-${prompt.id}`}
                    >
                      <div className="flex flex-col gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleMoveUp(prompt, index)}
                          disabled={index === 0}
                          className="h-8 w-8 text-slate-400 hover:text-slate-200"
                          data-testid={`button-move-up-${prompt.id}`}
                        >
                          <MoveUp className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleMoveDown(prompt, index)}
                          disabled={index === sortedPrompts.length - 1}
                          className="h-8 w-8 text-slate-400 hover:text-slate-200"
                          data-testid={`button-move-down-${prompt.id}`}
                        >
                          <MoveDown className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-slate-100" data-testid={`text-title-${prompt.id}`}>
                            {prompt.title}
                          </h3>
                          <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 text-xs rounded" data-testid={`badge-age-${prompt.id}`}>
                            {prompt.ageRange}
                          </span>
                          {!prompt.isActive && (
                            <span className="px-2 py-0.5 bg-slate-700 text-slate-300 text-xs rounded">
                              Inactive
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-400 line-clamp-2" data-testid={`text-prompt-${prompt.id}`}>
                          {prompt.prompt}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">Order: {prompt.displayOrder}</p>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(prompt)}
                          className="text-blue-400 hover:text-blue-300 hover:bg-blue-950"
                          data-testid={`button-edit-${prompt.id}`}
                        >
                          <Edit className="w-5 h-5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(prompt.id)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-950"
                          data-testid={`button-delete-${prompt.id}`}
                        >
                          <Trash2 className="w-5 h-5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingPrompt ? "Edit Sample Prompt" : "Add Sample Prompt"}
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                Create a sample story prompt to help users get started with their stories
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="title" className="text-slate-200">Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="bg-slate-950 border-slate-700 text-slate-100"
                  placeholder="e.g., Magical Forest Adventure"
                  required
                  data-testid="input-title"
                />
              </div>

              <div>
                <Label htmlFor="ageRange" className="text-slate-200">Age Range</Label>
                <Input
                  id="ageRange"
                  value={formData.ageRange}
                  onChange={(e) => setFormData({ ...formData, ageRange: e.target.value })}
                  className="bg-slate-950 border-slate-700 text-slate-100"
                  placeholder="e.g., 4-6"
                  required
                  data-testid="input-age-range"
                />
              </div>

              <div>
                <Label htmlFor="prompt" className="text-slate-200">Story Prompt</Label>
                <Textarea
                  id="prompt"
                  value={formData.prompt}
                  onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
                  className="bg-slate-950 border-slate-700 text-slate-100 min-h-32"
                  placeholder="Write a story about {main character} who discovers..."
                  required
                  data-testid="input-prompt"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Tip: Use placeholders like {"{main character}"}, {"{friend}"}, {"{animal}"}, etc.
                </p>
              </div>

              <div>
                <Label htmlFor="displayOrder" className="text-slate-200">Display Order</Label>
                <Input
                  id="displayOrder"
                  type="number"
                  value={formData.displayOrder}
                  onChange={(e) => setFormData({ ...formData, displayOrder: e.target.value || '0' })}
                  className="bg-slate-950 border-slate-700 text-slate-100"
                  required
                  data-testid="input-display-order"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: !!checked })}
                  data-testid="checkbox-is-active"
                />
                <Label htmlFor="isActive" className="text-slate-200 cursor-pointer">
                  Active (visible to users)
                </Label>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDialogOpen(false);
                    resetForm();
                  }}
                  className="bg-slate-950 border-slate-700 text-slate-100"
                  data-testid="button-cancel"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-save"
                >
                  {editingPrompt ? "Update" : "Create"} Prompt
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </AdminLayout>
    </ProtectedAdminRoute>
  );
}
