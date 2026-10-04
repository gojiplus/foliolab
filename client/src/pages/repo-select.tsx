import type { Repository } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ExternalLink, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { AnalysisProgress } from "@/components/analysis-progress";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getGitHubToken, getRepositories, saveRepositories } from "@/lib/storage";

const REPOS_PER_PAGE = 10;

export default function RepoSelect() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedOwner, setSelectedOwner] = useState<string>("all");
  const { toast } = useToast();
  const [analysisProgress, setAnalysisProgress] = useState({
    isAnalyzing: false,
    currentRepo: 0,
    repoName: "",
    progress: 0,
  });

  const { data, isLoading } = useQuery<{ repositories: Repository[] }>({
    queryKey: ["/api/repositories"],
    initialData: () => {
      // Load initial data from storage
      const storedRepos = getRepositories();
      return storedRepos.length ? { repositories: storedRepos } : undefined;
    },
  });

  const { mutate: toggleRepo, isPending: isToggling } = useMutation({
    mutationFn: async ({ id, selected }: { id: number; selected: boolean }) => {
      if (!id) throw new Error("Repository ID is required");

      // Get the current repository data
      const repositories = data?.repositories || [];
      const updatedRepo = {
        ...repositories.find((r) => r.id === id)!,
        selected,
      };

      // Update both cache and storage atomically
      const updatedRepos = repositories.map((repo) => (repo.id === id ? updatedRepo : repo));

      // Save to storage first
      saveRepositories(updatedRepos);

      // Update cache
      queryClient.setQueryData<{ repositories: Repository[] }>(["/api/repositories"], {
        repositories: updatedRepos,
      });

      return updatedRepo;
    },
    onError: (error) => {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to update repository selection",
        variant: "destructive",
      });
    },
  });

  // Extract unique owners from repositories
  const owners = useMemo(() => {
    if (!data?.repositories) return [];

    const ownerMap = new Map<string, { login: string; type: string; avatarUrl: string | null }>();

    data.repositories.forEach((repo) => {
      // Use the actual owner information from the repository
      if (repo.owner && !ownerMap.has(repo.owner.login)) {
        ownerMap.set(repo.owner.login, {
          login: repo.owner.login,
          type: repo.owner.type,
          avatarUrl: repo.owner.avatarUrl,
        });
      }
    });

    // Sort owners: current user first, then organizations alphabetically
    const sortedOwners = Array.from(ownerMap.values()).sort((a, b) => {
      // User type comes first
      if (a.type === "User" && b.type === "Organization") return -1;
      if (a.type === "Organization" && b.type === "User") return 1;
      // Then sort alphabetically by login
      return a.login.localeCompare(b.login);
    });

    return sortedOwners;
  }, [data?.repositories]);

  const filteredRepos = useMemo(() => {
    if (!data?.repositories) return [];

    // First filter by owner if not "all"
    let filtered = data.repositories;
    if (selectedOwner !== "all") {
      filtered = filtered.filter((repo) => repo.owner.login === selectedOwner);
    }

    // Then filter by search query
    filtered = filtered.filter(
      (repo) =>
        repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (repo.description?.toLowerCase() || "").includes(searchQuery.toLowerCase()),
    );

    // Sort by last modified date (most recent first)
    return filtered.sort((a, b) => {
      const dateA = new Date(a.metadata.updatedAt || 0);
      const dateB = new Date(b.metadata.updatedAt || 0);
      return dateB.getTime() - dateA.getTime();
    });
  }, [data?.repositories, searchQuery, selectedOwner]);

  const paginatedRepos = useMemo(() => {
    const startIndex = (currentPage - 1) * REPOS_PER_PAGE;
    return filteredRepos.slice(startIndex, startIndex + REPOS_PER_PAGE);
  }, [filteredRepos, currentPage]);

  const totalPages = Math.ceil((filteredRepos?.length || 0) / REPOS_PER_PAGE);
  const selectedRepos = data?.repositories.filter((repo) => repo.selected) || [];
  const selectedCount = selectedRepos.length;

  const handleSelectAll = (checked: boolean) => {
    paginatedRepos.forEach((repo) => {
      if (repo.id && repo.selected !== checked) {
        toggleRepo({ id: repo.id, selected: checked });
      }
    });
  };

  const allSelected = paginatedRepos.length > 0 && paginatedRepos.every((repo) => repo.selected);

  const analyzeRepos = async () => {
    try {
      setAnalysisProgress({
        isAnalyzing: true,
        currentRepo: 0,
        repoName: "",
        progress: 0,
      });

      // Analyze repositories sequentially to avoid rate limits
      for (let i = 0; i < selectedRepos.length; i++) {
        const repo = selectedRepos[i];
        if (repo.id) {
          setAnalysisProgress((prev) => ({
            ...prev,
            currentRepo: i + 1,
            repoName: repo.name,
            progress: (i / selectedRepos.length) * 100,
          }));

          const res = await apiRequest("POST", `/api/repositories/${repo.id}/analyze`, {
            accessToken: getGitHubToken(),
            username: localStorage.getItem("github_username"),
          });

          if (!res.ok) {
            throw new Error("Failed to analyze repository");
          }

          const data = await res.json();

          // Update the cache with the new summary
          queryClient.setQueryData<{ repositories: Repository[] }>(["/api/repositories"], (old) => {
            if (!old) return old;
            return {
              repositories: old.repositories.map((r) =>
                r.id === data.repository.id ? { ...r, summary: data.repository.summary } : r,
              ),
            };
          });
        }
      }

      // Set progress to 100% when complete
      setAnalysisProgress((prev) => ({
        ...prev,
        progress: 100,
      }));

      // Small delay to show 100% completion before navigating
      await new Promise((resolve) => setTimeout(resolve, 500));

      setLocation("/preview");
      toast({
        title: "Success",
        description: "Repository analysis complete!",
      });
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to analyze repositories. Please try again.",
        variant: "destructive",
      });
    } finally {
      setAnalysisProgress({
        isAnalyzing: false,
        currentRepo: 0,
        repoName: "",
        progress: 0,
      });
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="flex flex-col gap-6">
        {/* Header and filter section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Select Repositories</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Choose GitHub repositories for your portfolio, or{" "}
              <button
                onClick={() => setLocation("/data-sources")}
                className="text-blue-600 hover:text-blue-800 underline"
              >
                add content from other sources
              </button>
            </p>
          </div>

          {/* Owner filter dropdown */}
          {owners.length > 0 && (
            <div className="w-full md:w-48">
              <Select
                value={selectedOwner}
                onValueChange={(value) => {
                  setSelectedOwner(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Owner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Repositories</SelectItem>
                  {owners.map((owner) => (
                    <SelectItem key={owner.login} value={owner.login}>
                      {owner.type === "User" ? "User: " : "Org: "}
                      {owner.login}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="w-full md:w-auto flex flex-col md:flex-row items-stretch md:items-center gap-4">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search repositories..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9 pr-9"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setCurrentPage(1);
                  }}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-full focus:outline-hidden focus:ring-2 focus:ring-ring"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="select-all"
                  checked={allSelected}
                  onCheckedChange={handleSelectAll}
                  disabled={isToggling || paginatedRepos.length === 0}
                />
                <label htmlFor="select-all" className="text-sm font-medium whitespace-nowrap">
                  Select All
                </label>
              </div>
              {selectedCount > 0 && (
                <Button onClick={analyzeRepos} disabled={isToggling}>
                  Generate Portfolio ({selectedCount} selected)
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Repository Selection */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Available Repositories</h2>
              <span className="text-sm text-muted-foreground">
                {filteredRepos.length} repositories
              </span>
            </div>

            <div className="grid gap-4 max-h-[800px] overflow-y-auto">
              {isLoading
                ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32" />)
                : paginatedRepos.map((repo) => (
                    <Card key={repo.id} className="transition-shadow hover:shadow-md">
                      <CardHeader className="flex flex-row items-start gap-4 p-4">
                        <Checkbox
                          id={`repo-${repo.id}`}
                          checked={repo.selected}
                          onCheckedChange={(checked) => {
                            if (repo.id) {
                              toggleRepo({ id: repo.id, selected: !!checked });
                            }
                          }}
                          disabled={isToggling}
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <label
                              htmlFor={`repo-${repo.id}`}
                              className="text-base font-semibold cursor-pointer"
                            >
                              {repo.displayName || repo.name}
                            </label>
                            <span className="text-xs text-muted-foreground bg-secondary/50 px-2 py-1 rounded-full">
                              {repo.owner.type === "User" ? "User" : "Org"}: {repo.owner.login}
                            </span>
                            <a
                              href={repo.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-full flex items-center gap-1 transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              GitHub <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>

                          <div className="text-xs text-muted-foreground mt-1">
                            Updated {new Date(repo.metadata.updatedAt).toLocaleDateString()}
                          </div>

                          {repo.description && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {repo.description}
                            </p>
                          )}

                          <div className="flex flex-wrap gap-2 mt-2">
                            {repo.metadata.language && (
                              <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                                {repo.metadata.language}
                              </span>
                            )}
                            {repo.metadata.stars > 0 && (
                              <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full">
                                ★ {repo.metadata.stars}
                              </span>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <span className="flex items-center px-3 text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            )}
          </div>

          {/* Right Column - Selected Repositories */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Selected Repositories</h2>
              <span className="text-sm text-muted-foreground">{selectedCount} selected</span>
            </div>

            <div className="border-2 border-dashed border-muted rounded-lg p-4 min-h-[800px]">
              {selectedCount === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12">
                  <div className="w-16 h-16 mb-4 rounded-full bg-muted flex items-center justify-center">
                    <Search className="w-8 h-8" />
                  </div>
                  <p className="text-center font-medium">No repositories selected</p>
                  <p className="text-sm text-center mt-1">
                    Select repositories from the left to see them here
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[750px] overflow-y-auto">
                  {selectedRepos.map((repo) => (
                    <Card key={repo.id} className="border-primary/20 bg-primary/5">
                      <CardHeader className="p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-sm">
                                {repo.displayName || repo.name}
                              </h3>
                              <span className="text-xs text-muted-foreground bg-secondary/50 px-2 py-1 rounded-full">
                                {repo.owner.type === "User" ? "User" : "Org"}: {repo.owner.login}
                              </span>
                              <a
                                href={repo.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-full flex items-center gap-1 transition-colors"
                                onClick={(e) => e.stopPropagation()}
                              >
                                GitHub <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>

                            {repo.description && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {repo.description}
                              </p>
                            )}

                            <div className="flex flex-wrap gap-1 mt-2">
                              {repo.metadata.language && (
                                <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">
                                  {repo.metadata.language}
                                </span>
                              )}
                              {repo.metadata.stars > 0 && (
                                <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full">
                                  ★ {repo.metadata.stars}
                                </span>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => repo.id && toggleRepo({ id: repo.id, selected: false })}
                            className="ml-2 h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                            title="Remove from selection"
                            aria-label={`Remove ${repo.displayName || repo.name} from selection`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Generate Portfolio button appears above */}
      </div>

      <AnalysisProgress
        open={analysisProgress.isAnalyzing}
        totalRepos={selectedRepos.length}
        currentRepo={analysisProgress.currentRepo}
        repoName={analysisProgress.repoName}
        progress={analysisProgress.progress}
      />
    </div>
  );
}
