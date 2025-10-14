import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Storybook } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, BookOpen } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface StorybookSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (storybook: Storybook) => void;
}

export default function StorybookSelector({ open, onOpenChange, onSelect }: StorybookSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: storybooks, isLoading } = useQuery<Storybook[]>({
    queryKey: ["/api/storybooks"],
    enabled: open,
  });

  const filteredStorybooks = storybooks?.filter(storybook =>
    storybook.title.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const handleSelect = (storybook: Storybook) => {
    onSelect(storybook);
    onOpenChange(false);
    setSearchQuery("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-4xl bg-slate-900 border-slate-800 text-slate-100"
        data-testid="modal-storybook-selector"
      >
        <DialogHeader>
          <DialogTitle className="text-2xl text-slate-100">Select a Storybook</DialogTitle>
          <DialogDescription className="text-slate-400">
            Choose a storybook to feature
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              placeholder="Search storybooks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-500"
              data-testid="search-storybooks"
            />
          </div>

          <ScrollArea className="h-96 rounded-lg border border-slate-800 bg-slate-950 p-4">
            {isLoading ? (
              <div className="grid grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-40 bg-slate-800" />
                    <Skeleton className="h-4 bg-slate-800" />
                  </div>
                ))}
              </div>
            ) : filteredStorybooks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <BookOpen className="w-12 h-12 text-slate-600 mb-3" />
                <p className="text-slate-400">
                  {searchQuery ? "No storybooks found" : "No storybooks available"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {filteredStorybooks.map((storybook) => (
                  <button
                    key={storybook.id}
                    onClick={() => handleSelect(storybook)}
                    className="group text-left rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 hover:border-purple-600 transition-all overflow-hidden"
                  >
                    {storybook.coverImageUrl ? (
                      <img
                        src={storybook.coverImageUrl}
                        alt={storybook.title}
                        className="w-full h-40 object-cover"
                      />
                    ) : (
                      <div className="w-full h-40 bg-slate-800 flex items-center justify-center">
                        <BookOpen className="w-12 h-12 text-slate-600" />
                      </div>
                    )}
                    <div className="p-3">
                      <p className="font-medium text-sm text-slate-100 group-hover:text-purple-400 transition-colors line-clamp-2">
                        {storybook.title}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
