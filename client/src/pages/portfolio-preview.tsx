import type { PortfolioItem, Repository } from "@shared/schema";
import { themes } from "@shared/themes";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowLeft,
  Camera,
  Check,
  Edit2,
  ExternalLink,
  Github,
  GripVertical,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { DeploymentActions } from "@/components/deployment-actions";
import { ThemeSelector } from "@/components/theme-selector";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { getPortfolioItems } from "@/lib/storage";
import { cn } from "@/lib/utils";

interface UserIntroduction {
  introduction: string;
  skills: string[];
  interests: string[];
  customImageUrl?: string;
}

interface UserInfo {
  username: string;
  avatarUrl: string | null;
}

// Helper function to capitalize first letter
const capitalizeFirstLetter = (str: string) => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

const getItemTitle = (item: PortfolioItem): string => {
  if (item.source === "github" || item.source === "gitlab" || item.source === "bitbucket") {
    return item.displayName || item.name;
  }
  return item.title || "Untitled";
};

const getItemSummary = (item: PortfolioItem): string => {
  if (item.source === "github" || item.source === "gitlab" || item.source === "bitbucket") {
    return item.summary || "";
  }
  if (item.source === "linkedin") {
    return item.summary || "";
  }
  if (item.source === "freeform") {
    return item.description || "";
  }
  return item.summary || item.description || "";
};

const _getItemUrl = (item: PortfolioItem): string | undefined => {
  if (item.url) return item.url;
  if (item.source === "github" || item.source === "gitlab" || item.source === "bitbucket") {
    return item.metadata.url || undefined;
  }
  return undefined;
};

export default function PortfolioPreview() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [selectedItems, setSelectedItems] = useState<PortfolioItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userIntro, setUserIntro] = useState<UserIntroduction | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [customTitle, setCustomTitle] = useState<string | null>(null);
  const [selectedTheme, setSelectedTheme] = useState("modern");
  const theme = themes.find((t) => t.id === selectedTheme) || themes[0];

  // Edit state management
  const [editingIntro, setEditingIntro] = useState(false);
  const [editingSkills, setEditingSkills] = useState(false);
  const [editingInterests, setEditingInterests] = useState(false);
  const [editingItem, setEditingItem] = useState<string | number | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingItemTitle, setEditingItemTitle] = useState<string | number | null>(null);
  const [editingImage, setEditingImage] = useState(false);

  // Temporary edit values
  const [tempIntro, setTempIntro] = useState("");
  const [tempSkills, setTempSkills] = useState<string[]>([]);
  const [tempInterests, setTempInterests] = useState<string[]>([]);
  const [tempItemSummary, setTempItemSummary] = useState("");
  const [tempTitle, setTempTitle] = useState("");
  const [tempItemTitle, setTempItemTitle] = useState("");
  const [tempImageUrl, setTempImageUrl] = useState("");
  const [newSkill, setNewSkill] = useState("");
  const [newInterest, setNewInterest] = useState("");

  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Generate user introduction
  const { mutate: generateIntro, isPending: isGenerating } = useMutation({
    mutationFn: async (repositories: Repository[]) => {
      const res = await apiRequest("POST", "/api/user/introduction", {
        repositories,
      });
      const data = await res.json();
      return data;
    },
    onSuccess: (data) => {
      setUserIntro(data.introduction);
      setUserInfo(data.user);
    },
    onError: (err) => {
      console.error("Error generating introduction:", err);
      toast({
        title: "Warning",
        description: "Could not generate personalized introduction. Proceeding with basic preview.",
        variant: "destructive",
      });
    },
  });

  // Edit handlers
  const startEditingIntro = () => {
    if (userIntro) {
      setTempIntro(userIntro.introduction);
      setEditingIntro(true);
    }
  };

  const startEditingSkills = () => {
    if (userIntro) {
      setTempSkills([...userIntro.skills]);
      setEditingSkills(true);
    }
  };

  const startEditingInterests = () => {
    if (userIntro) {
      setTempInterests([...userIntro.interests]);
      setEditingInterests(true);
    }
  };

  const startEditingItem = (itemId: string | number, summary: string) => {
    setTempItemSummary(summary);
    setEditingItem(itemId);
  };

  const startEditingTitle = () => {
    if (userInfo) {
      setTempTitle(`${capitalizeFirstLetter(userInfo.username)}'s Portfolio`);
      setEditingTitle(true);
    }
  };

  const startEditingItemTitle = (itemId: string | number, title: string) => {
    setTempItemTitle(title);
    setEditingItemTitle(itemId);
  };

  const startEditingImage = () => {
    setTempImageUrl(userIntro?.customImageUrl || "");
    setEditingImage(true);
  };

  const saveIntro = () => {
    if (userIntro) {
      setUserIntro({ ...userIntro, introduction: tempIntro });
      setEditingIntro(false);
      toast({
        title: "Introduction Updated",
        description: "Your introduction has been updated successfully.",
      });
    }
  };

  const saveSkills = () => {
    if (userIntro) {
      setUserIntro({ ...userIntro, skills: tempSkills });
      setEditingSkills(false);
      toast({
        title: "Skills Updated",
        description: "Your skills have been updated successfully.",
      });
    }
  };

  const saveInterests = () => {
    if (userIntro) {
      setUserIntro({ ...userIntro, interests: tempInterests });
      setEditingInterests(false);
      toast({
        title: "Interests Updated",
        description: "Your interests have been updated successfully.",
      });
    }
  };

  const saveItemSummary = () => {
    if (editingItem !== null) {
      setSelectedItems((items) =>
        items.map((item) => {
          if (item.id === editingItem) {
            if (item.source === "freeform") {
              return { ...item, description: tempItemSummary };
            }
            return { ...item, summary: tempItemSummary } as PortfolioItem;
          }
          return item;
        }),
      );
      setEditingItem(null);
      toast({
        title: "Item Summary Updated",
        description: "The item summary has been updated successfully.",
      });
    }
  };

  const saveTitle = () => {
    setCustomTitle(tempTitle);
    setEditingTitle(false);
    toast({
      title: "Portfolio Title Updated",
      description: "Your portfolio title has been updated successfully.",
    });
  };

  const _saveItemTitle = () => {
    if (editingItemTitle !== null) {
      setSelectedItems((items) =>
        items.map((item) => {
          if (item.id === editingItemTitle) {
            if (
              item.source === "github" ||
              item.source === "gitlab" ||
              item.source === "bitbucket"
            ) {
              return { ...item, displayName: tempItemTitle };
            } else if (
              item.source === "blog_rss" ||
              item.source === "medium" ||
              item.source === "freeform" ||
              item.source === "linkedin"
            ) {
              return { ...item, title: tempItemTitle };
            }
          }
          return item;
        }),
      );
      setEditingItemTitle(null);
      toast({
        title: "Item Title Updated",
        description: "The item title has been updated successfully.",
      });
    }
  };

  const saveImageUrl = () => {
    if (userIntro) {
      setUserIntro({ ...userIntro, customImageUrl: tempImageUrl });
      setEditingImage(false);
      toast({
        title: "Profile Image Updated",
        description: "Your profile image has been updated successfully.",
      });
    }
  };

  const cancelEdit = () => {
    setEditingIntro(false);
    setEditingSkills(false);
    setEditingInterests(false);
    setEditingItem(null);
    setEditingTitle(false);
    setEditingItemTitle(null);
    setEditingImage(false);
    setTempIntro("");
    setTempSkills([]);
    setTempInterests([]);
    setTempItemSummary("");
    setTempTitle("");
    setTempItemTitle("");
    setTempImageUrl("");
    setNewSkill("");
    setNewInterest("");
  };

  const addSkill = () => {
    if (newSkill.trim() && !tempSkills.includes(newSkill.trim())) {
      setTempSkills([...tempSkills, newSkill.trim()]);
      setNewSkill("");
    }
  };

  const removeSkill = (index: number) => {
    setTempSkills(tempSkills.filter((_, i) => i !== index));
  };

  const addInterest = () => {
    if (newInterest.trim() && !tempInterests.includes(newInterest.trim())) {
      setTempInterests([...tempInterests, newInterest.trim()]);
      setNewInterest("");
    }
  };

  const removeInterest = (index: number) => {
    setTempInterests(tempInterests.filter((_, i) => i !== index));
  };

  const _deleteItemSummary = (itemId: string | number) => {
    setSelectedItems((items) =>
      items.map((item) => (item.id === itemId ? { ...item, summary: "" } : item)),
    );
    toast({
      title: "Summary Deleted",
      description: "The item summary has been removed.",
    });
  };

  const deleteItem = (itemId: string | number) => {
    setSelectedItems((items) => items.filter((item) => item.id !== itemId));
    toast({
      title: "Item Removed",
      description: "The item has been removed from your portfolio.",
    });
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();

    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newItems = [...selectedItems];
    const draggedItem = newItems[draggedIndex];

    // Remove the dragged item
    newItems.splice(draggedIndex, 1);

    // Insert at the new position
    newItems.splice(dropIndex, 0, draggedItem);

    setSelectedItems(newItems);
    setDraggedIndex(null);
    setDragOverIndex(null);

    toast({
      title: "Item Reordered",
      description: "The item order has been updated.",
    });
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  useEffect(() => {
    // Load selected items from localStorage
    const allItems = getPortfolioItems();
    const filtered = allItems.filter((item) => item.selected);
    setSelectedItems(filtered);
    setIsLoading(false);

    if (filtered.length > 0) {
      // Only generate intro if we have GitHub repos
      const githubRepos = filtered.filter((item) => item.source === "github") as Repository[];
      if (githubRepos.length > 0) {
        generateIntro(githubRepos);
      } else {
        // For non-GitHub items, create a basic intro
        setUserInfo({
          username: "Portfolio",
          avatarUrl: null,
        });
        setUserIntro({
          introduction: "Welcome to my portfolio! Here's a showcase of my work and writing.",
          skills: [],
          interests: [],
        });
      }
    } else {
      toast({
        title: "No Items Selected",
        description: "Please go back and select items to include in your portfolio.",
        variant: "destructive",
      });
    }
  }, [toast, generateIntro]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-primary/5 to-primary/10">
        <div className="container mx-auto px-4 py-20">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-2xl font-bold mb-4">Loading Portfolio...</h1>
            <Skeleton className="h-20 mb-4" />
            <Skeleton className="h-40" />
          </div>
        </div>
      </div>
    );
  }

  if (isLoading || isGenerating) {
    return (
      <div className="min-h-screen bg-linear-to-br from-primary/5 to-primary/10">
        <div className="container mx-auto px-4 py-20">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <Skeleton className="h-32 w-32 rounded-full mx-auto mb-6" />
              <Skeleton className="h-12 w-64 mx-auto mb-4" />
              <Skeleton className="h-6 w-96 mx-auto" />
            </div>
            <div className="grid gap-8">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-8 w-64" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-24 mb-4" />
                    <div className="flex gap-2">
                      <Skeleton className="h-6 w-20" />
                      <Skeleton className="h-6 w-20" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const renderPortfolioContent = () => {
    const isMinimal = selectedTheme === "minimal";
    const isModern = selectedTheme === "modern";
    const isElegant = selectedTheme === "elegant";

    // Skip rendering for Elegant theme as we handle it directly in the layout
    if (isElegant) {
      return null;
    }

    // For other themes
    return (
      <div
        className={
          isMinimal
            ? "" // For Minimal, we'll apply the grid layout at the parent level
            : cn(theme.layout.content, "grid grid-cols-1 gap-6") // For others, use theme styling plus grid
        }
      >
        {selectedItems.map((item, index) => (
          <Card
            key={item.id}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            className={cn(
              theme.preview.card,
              isMinimal ? "mb-2" : "mb-4", // Reduce spacing for Minimal theme
              isModern ? "shadow-lg hover:shadow-xl transition-shadow" : "",
              draggedIndex === index ? "opacity-50" : "",
              dragOverIndex === index ? "border-blue-500 border-2" : "",
              "cursor-move relative group",
            )}
          >
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex items-start gap-2 flex-1">
                  <GripVertical className="h-5 w-5 text-gray-400 mt-1 cursor-grab active:cursor-grabbing" />
                  <div className="relative group flex-1">
                    {editingItemTitle === item.id ? (
                      <div className="space-y-2">
                        <Input
                          value={tempItemTitle}
                          onChange={(e) => setTempItemTitle(e.target.value)}
                          className="text-2xl font-semibold"
                          placeholder="Enter title..."
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={saveTitle} aria-label="Save repository title">
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={cancelEdit}
                            aria-label="Cancel editing"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <h2 className={cn("text-2xl font-semibold", theme.preview.text)}>
                          {getItemTitle(item)}
                        </h2>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => startEditingItemTitle(item.id, getItemTitle(item))}
                          aria-label="Edit item title"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-2">
                  {(item.source === "github" ||
                    item.source === "gitlab" ||
                    item.source === "bitbucket") &&
                    item.metadata.stars > 0 && (
                      <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full flex items-center">
                        ★ {item.metadata.stars}
                      </span>
                    )}
                  {item.url && (
                    <Button variant="outline" size="icon" asChild aria-label="View item">
                      <a href={item.url} target="_blank" rel="noopener noreferrer">
                        {item.source === "github" ? (
                          <Github className="h-4 w-4" />
                        ) : (
                          <ExternalLink className="h-4 w-4" />
                        )}
                      </a>
                    </Button>
                  )}
                  {(item.source === "github" ||
                    item.source === "gitlab" ||
                    item.source === "bitbucket") &&
                    item.metadata.url && (
                      <Button variant="outline" size="icon" asChild>
                        <a href={item.metadata.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Item summary or description */}
              {getItemSummary(item) ? (
                <div className="relative group">
                  {editingItem === item.id ? (
                    <div className="space-y-3">
                      <Textarea
                        value={tempItemSummary}
                        onChange={(e) => setTempItemSummary(e.target.value)}
                        className="min-h-[100px]"
                        placeholder="Enter summary..."
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={saveItemSummary}
                          aria-label="Save repository summary"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={cancelEdit}
                          aria-label="Cancel editing"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className={cn("mb-4", theme.preview.text)}>{getItemSummary(item)}</p>
                      <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => startEditingItem(item.id, getItemSummary(item))}
                          aria-label="Edit item summary"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteItem(item.id)}
                          className="text-red-500 hover:text-red-700"
                          title="Remove from portfolio"
                          aria-label="Remove from portfolio"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </>
                  )}
                  {/* Topics for repos */}
                  {(item.source === "github" ||
                    item.source === "gitlab" ||
                    item.source === "bitbucket") &&
                    item.metadata.topics.length > 0 && (
                      <div className="flex gap-2 flex-wrap">
                        {item.metadata.topics.map((topic) => (
                          <span
                            key={topic}
                            className={
                              isModern
                                ? "px-2 py-1 rounded-full text-sm bg-linear-to-r from-indigo-500 to-purple-500 text-white"
                                : "px-2 py-1 rounded-full text-sm bg-slate-800 text-white" // Explicit styling for Minimal theme
                            }
                          >
                            {topic}
                          </span>
                        ))}
                      </div>
                    )}
                  {/* Tags for other types */}
                  {(item.source === "blog_rss" ||
                    item.source === "medium" ||
                    item.source === "freeform") &&
                    item.tags && (
                      <div className="flex gap-2 flex-wrap">
                        {item.tags.map((tag) => (
                          <span
                            key={tag}
                            className={
                              isModern
                                ? "px-2 py-1 rounded-full text-sm bg-linear-to-r from-indigo-500 to-purple-500 text-white"
                                : "px-2 py-1 rounded-full text-sm bg-slate-800 text-white"
                            }
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                </div>
              ) : (
                <div className="space-y-4">
                  <Skeleton className="h-24" />
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-6 w-20" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const renderProfile = () => {
    // Track current theme for conditional styling
    const isMinimal = selectedTheme === "minimal";
    const isElegant = selectedTheme === "elegant";
    const isModern = selectedTheme === "modern";

    // Create the profile content
    return (
      <div
        className={
          isMinimal
            ? "sticky top-8 flex flex-col items-center" // Simplified for Minimal, as we set the container above
            : isElegant
              ? "flex flex-col items-center w-full" // Center everything for Elegant theme
              : cn(theme.layout.header, "flex flex-col") // Use theme styling for other themes
        }
      >
        {userInfo && (
          <>
            <div className="relative group mb-6">
              <Avatar className="w-32 h-32">
                <AvatarImage
                  src={userIntro?.customImageUrl || userInfo.avatarUrl || undefined}
                  alt={userInfo.username}
                  onError={(e) => {
                    // Fallback to GitHub avatar if custom URL fails
                    if (userIntro?.customImageUrl && e.currentTarget.src !== userInfo.avatarUrl) {
                      e.currentTarget.src = userInfo.avatarUrl || "";
                    }
                  }}
                />
                <AvatarFallback>{userInfo.username.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <Button
                size="sm"
                variant="secondary"
                className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full p-0 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                onClick={startEditingImage}
              >
                <Camera className="h-4 w-4" />
              </Button>
            </div>

            {/* Image URL Editor */}
            {editingImage && (
              <div className="mb-6 p-4 border rounded-lg bg-white shadow-xs max-w-md mx-auto">
                <h3 className="text-lg font-semibold mb-2">Edit Profile Image</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Enter a custom image URL or leave empty to use your GitHub avatar
                </p>
                <div className="space-y-4">
                  <Input
                    type="url"
                    placeholder="https://example.com/your-image.jpg"
                    value={tempImageUrl}
                    onChange={(e) => setTempImageUrl(e.target.value)}
                    className="w-full"
                  />
                  <div className="flex gap-2 justify-center">
                    <Button size="sm" onClick={saveImageUrl}>
                      <Check className="h-4 w-4 mr-2" />
                      Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={cancelEdit}>
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            )}
            <div className="relative group">
              {editingTitle ? (
                <div className="space-y-2">
                  <Input
                    value={tempTitle}
                    onChange={(e) => setTempTitle(e.target.value)}
                    className="text-center text-4xl font-bold"
                    placeholder="Enter portfolio title..."
                  />
                  <div className="flex gap-2 justify-center">
                    <Button size="sm" onClick={saveTitle} aria-label="Save portfolio title">
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={cancelEdit}
                      aria-label="Cancel editing"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <h1 className={cn("text-4xl font-bold mb-6", theme.preview.text)}>
                    {customTitle || `${capitalizeFirstLetter(userInfo.username)}'s Portfolio`}
                  </h1>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={startEditingTitle}
                    aria-label="Edit portfolio title"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </>
        )}

        {userIntro && (
          <div
            className={cn(
              "space-y-6",
              isMinimal ? "text-left" : "text-center",
              isElegant ? "max-w-3xl mx-auto" : "", // Add max width for Elegant theme
            )}
          >
            <div className="relative group">
              {editingIntro ? (
                <div className="space-y-2">
                  <Textarea
                    value={tempIntro}
                    onChange={(e) => setTempIntro(e.target.value)}
                    className="min-h-[100px]"
                    placeholder="Enter your introduction..."
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveIntro} aria-label="Save introduction">
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={cancelEdit}
                      aria-label="Cancel editing"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className={cn("leading-relaxed", theme.preview.text)}>
                    {userIntro.introduction}
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={startEditingIntro}
                    aria-label="Edit introduction"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
            <div className="relative group">
              {editingSkills ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {tempSkills.map((skill, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-gray-200 text-gray-800"
                      >
                        <span>{skill}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-4 w-4 p-0 hover:bg-red-100"
                          onClick={() => removeSkill(index)}
                          aria-label={`Remove skill ${skill}`}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={newSkill}
                      onChange={(e) => setNewSkill(e.target.value)}
                      placeholder="Add new skill..."
                      onKeyPress={(e) => e.key === "Enter" && addSkill()}
                      className="flex-1"
                    />
                    <Button size="sm" onClick={addSkill} aria-label="Add skill">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveSkills} aria-label="Save skills">
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={cancelEdit}
                      aria-label="Cancel editing"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className={cn("flex flex-wrap gap-2", isMinimal ? "" : "justify-center")}>
                    {userIntro.skills.map((skill, index) => (
                      <span
                        key={index}
                        className={
                          isModern
                            ? "px-3 py-1 rounded-full text-sm font-medium bg-linear-to-r from-indigo-500 to-purple-500 text-white"
                            : isElegant
                              ? "px-3 py-1 rounded-full text-sm font-medium bg-stone-900 text-stone-50" // Special styling for Elegant
                              : "px-3 py-1 rounded-full text-sm font-medium bg-slate-800 text-white" // Default for Minimal
                        }
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={startEditingSkills}
                    aria-label="Edit skills"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
            <div className="relative group">
              {editingInterests ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {tempInterests.map((interest, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-1 px-2 py-1 rounded text-sm bg-gray-200 text-gray-800"
                      >
                        <span>{interest}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-4 w-4 p-0 hover:bg-red-100"
                          onClick={() => removeInterest(index)}
                          aria-label={`Remove interest ${interest}`}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={newInterest}
                      onChange={(e) => setNewInterest(e.target.value)}
                      placeholder="Add new interest..."
                      onKeyPress={(e) => e.key === "Enter" && addInterest()}
                      className="flex-1"
                    />
                    <Button size="sm" onClick={addInterest} aria-label="Add interest">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveInterests} aria-label="Save interests">
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={cancelEdit}
                      aria-label="Cancel editing"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className={cn("text-sm", theme.preview.text)}>
                    <span className="font-medium">Interests:</span> {userIntro.interests.join(", ")}
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={startEditingInterests}
                    aria-label="Edit interests"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className={cn(
        "min-h-screen transition-colors",
        theme.preview.background,
        selectedTheme === "elegant" ? "bg-stone-50" : "",
      )}
    >
      <div className="container mx-auto px-4 py-20">
        <div className="flex flex-col gap-8">
          <div className="flex items-center justify-between mb-8">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation("/repos")}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Repositories
            </Button>

            <ThemeSelector value={selectedTheme} onValueChange={setSelectedTheme} />
          </div>

          {/* Simple Editing Hint */}
          <div className="text-center mb-4">
            <p className="text-sm text-muted-foreground">
              💡 Tip: Your portfolio is fully customizable! Hover over elements to edit, drag
              repositories to reorder, or delete summaries
            </p>
          </div>

          {/* For specific themes, use explicit grid layouts */}
          {selectedTheme === "minimal" ? (
            // Minimal theme layout - 2 columns with left sidebar
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-4 flex justify-center">{renderProfile()}</div>
              <div className="lg:col-span-8">{renderPortfolioContent()}</div>
            </div>
          ) : selectedTheme === "elegant" ? (
            // Elegant theme layout - grid layout with repos side by side
            <div className="flex flex-col items-center">
              <div className="flex flex-col items-center text-center mb-16 max-w-3xl">
                {renderProfile()}
              </div>
              <div className="w-full max-w-6xl mx-auto px-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {selectedItems.map((item, index) => (
                    <Card
                      key={item.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, index)}
                      onDragEnd={handleDragEnd}
                      className={cn(
                        "border-l-4 border-stone-900 rounded-none shadow-[0_2px_40px_-12px_rgba(0,0,0,0.1)] bg-white h-full cursor-move relative group",
                        draggedIndex === index ? "opacity-50" : "",
                        dragOverIndex === index ? "border-blue-500 border-2" : "",
                      )}
                    >
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div className="flex items-start gap-2 flex-1">
                            <GripVertical className="h-5 w-5 text-gray-400 mt-1 cursor-grab active:cursor-grabbing" />
                            <div className="relative group flex-1">
                              {editingItemTitle === item.id ? (
                                <div className="space-y-2">
                                  <Input
                                    value={tempItemTitle}
                                    onChange={(e) => setTempItemTitle(e.target.value)}
                                    className="text-2xl font-semibold"
                                    placeholder="Enter title..."
                                  />
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      onClick={saveTitle}
                                      aria-label="Save repository title"
                                    >
                                      <Check className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={cancelEdit}
                                      aria-label="Cancel editing"
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <h2 className={cn("text-2xl font-semibold", theme.preview.text)}>
                                    {getItemTitle(item)}
                                  </h2>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() =>
                                      startEditingItemTitle(item.id, getItemTitle(item))
                                    }
                                    aria-label="Edit item title"
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-2">
                            {(item.source === "github" ||
                              item.source === "gitlab" ||
                              item.source === "bitbucket") &&
                              item.metadata.stars > 0 && (
                                <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full flex items-center">
                                  ★ {item.metadata.stars}
                                </span>
                              )}
                            {item.url && (
                              <Button variant="outline" size="icon" asChild aria-label="View item">
                                <a href={item.url} target="_blank" rel="noopener noreferrer">
                                  {item.source === "github" ? (
                                    <Github className="h-4 w-4" />
                                  ) : (
                                    <ExternalLink className="h-4 w-4" />
                                  )}
                                </a>
                              </Button>
                            )}
                            {(item.source === "github" ||
                              item.source === "gitlab" ||
                              item.source === "bitbucket") &&
                              item.metadata.url && (
                                <Button variant="outline" size="icon" asChild>
                                  <a
                                    href={item.metadata.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </a>
                                </Button>
                              )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {/* Item summary or description */}
                        {getItemSummary(item) ? (
                          <div className="relative group">
                            {editingItem === item.id ? (
                              <div className="space-y-3">
                                <Textarea
                                  value={tempItemSummary}
                                  onChange={(e) => setTempItemSummary(e.target.value)}
                                  className="min-h-[100px]"
                                  placeholder="Enter summary..."
                                />
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={saveItemSummary}
                                    aria-label="Save repository summary"
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={cancelEdit}
                                    aria-label="Cancel editing"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <p className={cn("mb-4", theme.preview.text)}>
                                  {getItemSummary(item)}
                                </p>
                                <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => startEditingItem(item.id, getItemSummary(item))}
                                    aria-label="Edit item summary"
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => deleteItem(item.id)}
                                    className="text-red-500 hover:text-red-700"
                                    title="Remove from portfolio"
                                    aria-label="Remove from portfolio"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </>
                            )}
                            {/* Topics for repos */}
                            {(item.source === "github" ||
                              item.source === "gitlab" ||
                              item.source === "bitbucket") &&
                              item.metadata.topics.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                  {item.metadata.topics.map((topic) => (
                                    <Badge
                                      key={topic}
                                      variant="outline"
                                      className="bg-stone-900 text-stone-50"
                                    >
                                      {topic}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            {/* Tags for other types */}
                            {(item.source === "blog_rss" ||
                              item.source === "medium" ||
                              item.source === "freeform") &&
                              item.tags && (
                                <div className="flex flex-wrap gap-2">
                                  {item.tags.map((tag) => (
                                    <Badge
                                      key={tag}
                                      variant="outline"
                                      className="bg-stone-900 text-stone-50"
                                    >
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <Skeleton className="h-24" />
                            <div className="flex gap-2">
                              <Skeleton className="h-6 w-20" />
                              <Skeleton className="h-6 w-20" />
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            // Default layout for other themes
            <div className={theme.layout.container}>
              {renderProfile()}
              {renderPortfolioContent()}
            </div>
          )}

          <DeploymentActions
            repositories={selectedItems.filter((item) => item.source === "github") as Repository[]}
            userInfo={userInfo}
            introduction={userIntro}
            theme={theme}
            customTitle={customTitle}
          />
        </div>
      </div>
    </div>
  );
}
