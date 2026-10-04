import type { BlogPost, FreeformContent, MediumPost, PortfolioItem } from "@shared/schema";
import { useState } from "react";
import { useLocation } from "wouter";
import {
  addPortfolioItem,
  addPortfolioItems,
  getBitbucketCredentials,
  getGitHubToken,
  getGitLabToken,
  saveBitbucketCredentials,
  saveGitLabToken,
} from "../lib/storage";

type DataSourceType = "rss" | "medium" | "gitlab" | "bitbucket" | "freeform";

export default function DataSourcesPage() {
  const [, setLocation] = useLocation();
  const [activeSource, setActiveSource] = useState<DataSourceType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Check if user came from GitHub flow
  const hasGitHubToken = !!getGitHubToken();

  // RSS Form State
  const [rssFeedUrl, setRssFeedUrl] = useState("");
  const [rssAuthor, setRssAuthor] = useState("");

  // Medium Form State
  const [mediumUsername, setMediumUsername] = useState("");

  // GitLab Form State
  const [gitlabToken, setGitlabToken] = useState(getGitLabToken() || "");
  const [gitlabUsername, setGitlabUsername] = useState("");

  // Bitbucket Form State
  const [bitbucketUsername, setBitbucketUsername] = useState(
    getBitbucketCredentials()?.username || "",
  );
  const [bitbucketAppPassword, setBitbucketAppPassword] = useState(
    getBitbucketCredentials()?.appPassword || "",
  );

  // Free-form State
  const [freeformTitle, setFreeformTitle] = useState("");
  const [freeformContent, setFreeformContent] = useState("");
  const [freeformDescription, setFreeformDescription] = useState("");
  const [freeformUrl, setFreeformUrl] = useState("");
  const [freeformType, setFreeformType] = useState<
    "project" | "achievement" | "skill" | "experience" | "other"
  >("other");
  const [freeformTags, setFreeformTags] = useState("");

  const handleRSSSubmit = async () => {
    if (!rssFeedUrl) {
      setError("Please enter an RSS feed URL");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/sources/rss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedUrl: rssFeedUrl, author: rssAuthor }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch RSS feed");
      }

      const data = await response.json();
      const posts = data.posts as BlogPost[];

      addPortfolioItems(posts as PortfolioItem[]);
      setSuccess(`Added ${posts.length} blog posts from RSS feed!`);
      setRssFeedUrl("");
      setRssAuthor("");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch RSS feed");
    } finally {
      setLoading(false);
    }
  };

  const handleMediumSubmit = async () => {
    if (!mediumUsername) {
      setError("Please enter a Medium username");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/sources/medium", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: mediumUsername }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch Medium posts");
      }

      const data = await response.json();
      const posts = data.posts as MediumPost[];

      addPortfolioItems(posts as PortfolioItem[]);
      setSuccess(`Added ${posts.length} Medium posts!`);
      setMediumUsername("");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch Medium posts");
    } finally {
      setLoading(false);
    }
  };

  const handleGitLabSubmit = async () => {
    if (!gitlabToken) {
      setError("Please enter a GitLab access token");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/sources/gitlab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: gitlabToken, username: gitlabUsername }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch GitLab projects");
      }

      const data = await response.json();
      const projects = data.projects as PortfolioItem[];

      saveGitLabToken(gitlabToken);
      addPortfolioItems(projects);
      setSuccess(`Added ${projects.length} GitLab projects!`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch GitLab projects");
    } finally {
      setLoading(false);
    }
  };

  const handleBitbucketSubmit = async () => {
    if (!bitbucketUsername || !bitbucketAppPassword) {
      setError("Please enter both username and app password");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/sources/bitbucket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: bitbucketUsername, appPassword: bitbucketAppPassword }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch Bitbucket repositories");
      }

      const data = await response.json();
      const repositories = data.repositories as PortfolioItem[];

      saveBitbucketCredentials(bitbucketUsername, bitbucketAppPassword);
      addPortfolioItems(repositories);
      setSuccess(`Added ${repositories.length} Bitbucket repositories!`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch Bitbucket repositories");
    } finally {
      setLoading(false);
    }
  };

  const handleFreeformSubmit = async () => {
    if (!freeformTitle || !freeformContent) {
      setError("Please enter both title and content");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/sources/freeform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: freeformTitle,
          content: freeformContent,
          description: freeformDescription || null,
          url: freeformUrl || undefined,
          contentType: freeformType,
          tags: freeformTags ? freeformTags.split(",").map((t) => t.trim()) : [],
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create free-form content");
      }

      const data = await response.json();
      const content = data.content as FreeformContent;

      addPortfolioItem(content as PortfolioItem);
      setSuccess("Added custom content!");
      setFreeformTitle("");
      setFreeformContent("");
      setFreeformDescription("");
      setFreeformUrl("");
      setFreeformTags("");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create content");
    } finally {
      setLoading(false);
    }
  };

  const dataSourceCards = [
    {
      id: "rss" as DataSourceType,
      title: "Blog RSS Feed",
      description: "Import blog posts from any RSS feed",
      icon: "📰",
      color: "bg-orange-50 border-orange-200",
    },
    {
      id: "medium" as DataSourceType,
      title: "Medium Posts",
      description: "Showcase your Medium articles",
      icon: "📝",
      color: "bg-green-50 border-green-200",
    },
    {
      id: "gitlab" as DataSourceType,
      title: "GitLab Projects",
      description: "Import projects from GitLab",
      icon: "🦊",
      color: "bg-purple-50 border-purple-200",
    },
    {
      id: "bitbucket" as DataSourceType,
      title: "Bitbucket Repos",
      description: "Add Bitbucket repositories",
      icon: "🪣",
      color: "bg-blue-50 border-blue-200",
    },
    {
      id: "freeform" as DataSourceType,
      title: "Custom Content",
      description: "Add any custom content you like",
      icon: "✍️",
      color: "bg-pink-50 border-pink-200",
    },
  ];

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => setLocation(hasGitHubToken ? "/repos" : "/")}
            className="text-gray-600 hover:text-gray-900 mb-4 flex items-center gap-2"
            aria-label={hasGitHubToken ? "Back to GitHub Repos" : "Back to Home"}
          >
            ← {hasGitHubToken ? "Back to GitHub Repos" : "Back to Home"}
          </button>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Add Data Sources</h1>
          <p className="text-gray-600">
            {hasGitHubToken
              ? "Expand your portfolio by importing content from multiple sources"
              : "Import content from any of these sources to build your portfolio"}
          </p>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4">
            {success}
          </div>
        )}

        {/* Data Source Cards */}
        {!activeSource && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {dataSourceCards.map((source) => (
              <button
                key={source.id}
                onClick={() => setActiveSource(source.id)}
                className={`${source.color} border-2 rounded-lg p-6 text-left hover:shadow-lg transition-shadow`}
              >
                <div className="text-4xl mb-3">{source.icon}</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{source.title}</h3>
                <p className="text-gray-600 text-sm">{source.description}</p>
              </button>
            ))}
          </div>
        )}

        {/* RSS Feed Form */}
        {activeSource === "rss" && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Add Blog RSS Feed</h2>
              <button
                onClick={() => setActiveSource(null)}
                className="text-gray-500 hover:text-gray-700"
                aria-label="Close form"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  RSS Feed URL *
                </label>
                <input
                  type="url"
                  value={rssFeedUrl}
                  onChange={(e) => setRssFeedUrl(e.target.value)}
                  placeholder="https://yourblog.com/feed.xml"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Author Name (optional)
                </label>
                <input
                  type="text"
                  value={rssAuthor}
                  onChange={(e) => setRssAuthor(e.target.value)}
                  placeholder="Your name"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={handleRSSSubmit}
                disabled={loading}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
              >
                {loading ? "Fetching..." : "Import Blog Posts"}
              </button>
            </div>
          </div>
        )}

        {/* Medium Form */}
        {activeSource === "medium" && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Add Medium Posts</h2>
              <button
                onClick={() => setActiveSource(null)}
                className="text-gray-500 hover:text-gray-700"
                aria-label="Close form"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Medium Username *
                </label>
                <input
                  type="text"
                  value={mediumUsername}
                  onChange={(e) => setMediumUsername(e.target.value)}
                  placeholder="@username or https://medium.com/@username"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Enter your Medium username or profile URL
                </p>
              </div>
              <button
                onClick={handleMediumSubmit}
                disabled={loading}
                className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:bg-gray-400"
              >
                {loading ? "Fetching..." : "Import Medium Posts"}
              </button>
            </div>
          </div>
        )}

        {/* GitLab Form */}
        {activeSource === "gitlab" && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Add GitLab Projects</h2>
              <button
                onClick={() => setActiveSource(null)}
                className="text-gray-500 hover:text-gray-700"
                aria-label="Close form"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  GitLab Personal Access Token *
                </label>
                <input
                  type="password"
                  value={gitlabToken}
                  onChange={(e) => setGitlabToken(e.target.value)}
                  placeholder="glpat-xxxxxxxxxxxxxxxxxxxx"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Create a token at GitLab Settings → Access Tokens (needs read_api scope)
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username (optional)
                </label>
                <input
                  type="text"
                  value={gitlabUsername}
                  onChange={(e) => setGitlabUsername(e.target.value)}
                  placeholder="Your GitLab username"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={handleGitLabSubmit}
                disabled={loading}
                className="w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 disabled:bg-gray-400"
              >
                {loading ? "Fetching..." : "Import GitLab Projects"}
              </button>
            </div>
          </div>
        )}

        {/* Bitbucket Form */}
        {activeSource === "bitbucket" && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Add Bitbucket Repositories</h2>
              <button
                onClick={() => setActiveSource(null)}
                className="text-gray-500 hover:text-gray-700"
                aria-label="Close form"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bitbucket Username *
                </label>
                <input
                  type="text"
                  value={bitbucketUsername}
                  onChange={(e) => setBitbucketUsername(e.target.value)}
                  placeholder="your-username"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  App Password *
                </label>
                <input
                  type="password"
                  value={bitbucketAppPassword}
                  onChange={(e) => setBitbucketAppPassword(e.target.value)}
                  placeholder="App password"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Create an app password at Bitbucket Settings → App passwords (needs
                  repository:read)
                </p>
              </div>
              <button
                onClick={handleBitbucketSubmit}
                disabled={loading}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
              >
                {loading ? "Fetching..." : "Import Bitbucket Repos"}
              </button>
            </div>
          </div>
        )}

        {/* Free-form Content Form */}
        {activeSource === "freeform" && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Add Custom Content</h2>
              <button
                onClick={() => setActiveSource(null)}
                className="text-gray-500 hover:text-gray-700"
                aria-label="Close form"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  value={freeformTitle}
                  onChange={(e) => setFreeformTitle(e.target.value)}
                  placeholder="Content title"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Content Type</label>
                <select
                  value={freeformType}
                  onChange={(e) => setFreeformType(e.target.value as any)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="project">Project</option>
                  <option value="achievement">Achievement</option>
                  <option value="skill">Skill</option>
                  <option value="experience">Experience</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Content *</label>
                <textarea
                  value={freeformContent}
                  onChange={(e) => setFreeformContent(e.target.value)}
                  placeholder="Describe your work, achievement, or experience..."
                  rows={6}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Short Description (optional)
                </label>
                <input
                  type="text"
                  value={freeformDescription}
                  onChange={(e) => setFreeformDescription(e.target.value)}
                  placeholder="Brief summary"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL (optional)
                </label>
                <input
                  type="url"
                  value={freeformUrl}
                  onChange={(e) => setFreeformUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tags (optional, comma-separated)
                </label>
                <input
                  type="text"
                  value={freeformTags}
                  onChange={(e) => setFreeformTags(e.target.value)}
                  placeholder="react, typescript, web-development"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={handleFreeformSubmit}
                disabled={loading}
                className="w-full bg-pink-600 text-white py-2 px-4 rounded-lg hover:bg-pink-700 disabled:bg-gray-400"
              >
                {loading ? "Adding..." : "Add Custom Content"}
              </button>
            </div>
          </div>
        )}

        {/* Continue Button */}
        <div className="flex justify-center gap-4">
          {hasGitHubToken && (
            <button
              onClick={() => setLocation("/repos")}
              className="bg-white border-2 border-gray-300 text-gray-700 py-3 px-8 rounded-lg hover:bg-gray-50 transition-all shadow-lg"
              aria-label="Back to GitHub Selection"
            >
              ← Back to GitHub Selection
            </button>
          )}
          <button
            onClick={() => setLocation("/preview")}
            className="bg-linear-to-r from-blue-600 to-indigo-600 text-white py-3 px-8 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg"
          >
            {hasGitHubToken ? "Continue to Portfolio →" : "Preview Portfolio →"}
          </button>
        </div>
      </div>
    </div>
  );
}
