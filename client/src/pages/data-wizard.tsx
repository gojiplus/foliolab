import type {
  BlogPost,
  FreeformContent,
  MediumPost,
  PortfolioItem,
  SourceType,
} from "@shared/schema";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  addPortfolioItem,
  addPortfolioItems,
  getBitbucketCredentials,
  getGitHubToken,
  getGitLabToken,
  saveBitbucketCredentials,
  saveGitHubToken,
  saveGitLabToken,
} from "../lib/storage";
import {
  getNextIncompleteSource,
  getWizardState,
  isWizardComplete,
  markSourceComplete,
} from "../lib/wizard-state";

export default function DataWizardPage() {
  const [, setLocation] = useLocation();
  const [wizardState, setWizardState] = useState(getWizardState());
  const [currentSource, setCurrentSource] = useState<SourceType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form states for each source
  const [rssFeedUrl, setRssFeedUrl] = useState("");
  const [rssAuthor, setRssAuthor] = useState("");
  const [mediumUsername, setMediumUsername] = useState("");
  const [gitlabToken, setGitlabToken] = useState(getGitLabToken() || "");
  const [gitlabUsername, setGitlabUsername] = useState("");
  const [bitbucketUsername, setBitbucketUsername] = useState(
    getBitbucketCredentials()?.username || "",
  );
  const [bitbucketAppPassword, setBitbucketAppPassword] = useState(
    getBitbucketCredentials()?.appPassword || "",
  );
  const [githubToken, setGithubToken] = useState(getGitHubToken() || "");
  const [freeformTitle, setFreeformTitle] = useState("");
  const [freeformContent, setFreeformContent] = useState("");
  const [freeformDescription, setFreeformDescription] = useState("");
  const [freeformUrl, setFreeformUrl] = useState("");
  const [freeformType, setFreeformType] = useState<
    "project" | "achievement" | "skill" | "experience" | "other"
  >("other");
  const [freeformTags, setFreeformTags] = useState("");

  useEffect(() => {
    if (!wizardState) {
      setLocation("/select-sources");
      return;
    }

    const nextSource = getNextIncompleteSource();
    if (nextSource) {
      setCurrentSource(nextSource);
    } else if (isWizardComplete()) {
      // All sources complete, go to selection page
      setLocation("/select-items");
    }
  }, [wizardState]);

  const handleSkipSource = () => {
    if (!currentSource) return;

    markSourceComplete(currentSource);
    setWizardState(getWizardState());
    setError(null);
    setSuccess(null);

    const nextSource = getNextIncompleteSource();
    if (nextSource) {
      setCurrentSource(nextSource);
    } else {
      setLocation("/select-items");
    }
  };

  const handleSourceComplete = (itemCount: number) => {
    if (!currentSource) return;

    markSourceComplete(currentSource);
    setSuccess(`Added ${itemCount} items from ${currentSource}!`);

    setTimeout(() => {
      setWizardState(getWizardState());
      setError(null);
      setSuccess(null);

      const nextSource = getNextIncompleteSource();
      if (nextSource) {
        setCurrentSource(nextSource);
      } else {
        setLocation("/select-items");
      }
    }, 1500);
  };

  const handleGitHubSubmit = async () => {
    if (!githubToken) {
      setError("Please enter a GitHub personal access token");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/github/repos", {
        headers: { Authorization: `Bearer ${githubToken}` },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch GitHub repositories");
      }

      const data = await response.json();
      const repos = data.repositories;

      saveGitHubToken(githubToken);
      addPortfolioItems(repos);
      handleSourceComplete(repos.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch repositories");
    } finally {
      setLoading(false);
    }
  };

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
      setRssFeedUrl("");
      setRssAuthor("");
      handleSourceComplete(posts.length);
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
      setMediumUsername("");
      handleSourceComplete(posts.length);
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
      handleSourceComplete(projects.length);
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
      handleSourceComplete(repositories.length);
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
      setFreeformTitle("");
      setFreeformContent("");
      setFreeformDescription("");
      setFreeformUrl("");
      setFreeformTags("");
      handleSourceComplete(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create content");
    } finally {
      setLoading(false);
    }
  };

  if (!wizardState || !currentSource) {
    return null;
  }

  const currentStepIndex = wizardState.selectedSources.indexOf(currentSource) + 1;
  const totalSourceSteps = wizardState.selectedSources.length;

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100 p-4">
      <div className="max-w-3xl mx-auto">
        {/* Progress Indicator */}
        <div className="bg-white rounded-lg shadow-xs p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">
              Step {currentStepIndex + 1} of {totalSourceSteps + 2}
            </span>
            <span className="text-sm text-gray-500">
              Importing data ({currentStepIndex}/{totalSourceSteps})
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${(currentStepIndex / (totalSourceSteps + 2)) * 100}%` }}
            ></div>
          </div>
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

        {/* GitHub Form */}
        {currentSource === "github" && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-4">Connect GitHub</h2>
            <p className="text-gray-600 mb-6">
              Enter your GitHub personal access token to import your repositories
            </p>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="github-token-wizard"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Personal Access Token *
                </label>
                <input
                  id="github-token-wizard"
                  type="password"
                  value={githubToken}
                  onChange={(e) => setGithubToken(e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Create a token at GitHub Settings → Developer settings → Personal access tokens
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleSkipSource}
                  disabled={loading}
                  className="flex-1 bg-white border-2 border-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-50"
                >
                  Skip
                </button>
                <button
                  onClick={handleGitHubSubmit}
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {loading ? "Fetching..." : "Import Repositories"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* RSS Form */}
        {currentSource === "blog_rss" && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-4">Add Blog RSS Feed</h2>
            <p className="text-gray-600 mb-6">Import blog posts from your RSS feed</p>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="rss-url-wizard"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  RSS Feed URL *
                </label>
                <input
                  id="rss-url-wizard"
                  type="url"
                  value={rssFeedUrl}
                  onChange={(e) => setRssFeedUrl(e.target.value)}
                  placeholder="https://yourblog.com/feed.xml"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label
                  htmlFor="rss-author-wizard"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Author Name (optional)
                </label>
                <input
                  id="rss-author-wizard"
                  type="text"
                  value={rssAuthor}
                  onChange={(e) => setRssAuthor(e.target.value)}
                  placeholder="Your name"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleSkipSource}
                  disabled={loading}
                  className="flex-1 bg-white border-2 border-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-50"
                >
                  Skip
                </button>
                <button
                  onClick={handleRSSSubmit}
                  disabled={loading}
                  className="flex-1 bg-orange-600 text-white py-2 px-4 rounded-lg hover:bg-orange-700 disabled:bg-gray-400"
                >
                  {loading ? "Fetching..." : "Import Blog Posts"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Medium Form */}
        {currentSource === "medium" && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-4">Add Medium Posts</h2>
            <p className="text-gray-600 mb-6">Import your Medium articles</p>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="medium-username-wizard"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Medium Username *
                </label>
                <input
                  id="medium-username-wizard"
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
              <div className="flex gap-3">
                <button
                  onClick={handleSkipSource}
                  disabled={loading}
                  className="flex-1 bg-white border-2 border-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-50"
                >
                  Skip
                </button>
                <button
                  onClick={handleMediumSubmit}
                  disabled={loading}
                  className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:bg-gray-400"
                >
                  {loading ? "Fetching..." : "Import Medium Posts"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* GitLab Form */}
        {currentSource === "gitlab" && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-4">Add GitLab Projects</h2>
            <p className="text-gray-600 mb-6">Connect your GitLab account to import projects</p>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="gitlab-token-wizard"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  GitLab Personal Access Token *
                </label>
                <input
                  id="gitlab-token-wizard"
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
                <label
                  htmlFor="gitlab-username-wizard"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Username (optional)
                </label>
                <input
                  id="gitlab-username-wizard"
                  type="text"
                  value={gitlabUsername}
                  onChange={(e) => setGitlabUsername(e.target.value)}
                  placeholder="Your GitLab username"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleSkipSource}
                  disabled={loading}
                  className="flex-1 bg-white border-2 border-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-50"
                >
                  Skip
                </button>
                <button
                  onClick={handleGitLabSubmit}
                  disabled={loading}
                  className="flex-1 bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 disabled:bg-gray-400"
                >
                  {loading ? "Fetching..." : "Import GitLab Projects"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bitbucket Form */}
        {currentSource === "bitbucket" && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-4">Add Bitbucket Repositories</h2>
            <p className="text-gray-600 mb-6">Connect your Bitbucket account</p>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="bitbucket-username-wizard"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Bitbucket Username *
                </label>
                <input
                  id="bitbucket-username-wizard"
                  type="text"
                  value={bitbucketUsername}
                  onChange={(e) => setBitbucketUsername(e.target.value)}
                  placeholder="your-username"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label
                  htmlFor="bitbucket-password-wizard"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  App Password *
                </label>
                <input
                  id="bitbucket-password-wizard"
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
              <div className="flex gap-3">
                <button
                  onClick={handleSkipSource}
                  disabled={loading}
                  className="flex-1 bg-white border-2 border-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-50"
                >
                  Skip
                </button>
                <button
                  onClick={handleBitbucketSubmit}
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {loading ? "Fetching..." : "Import Bitbucket Repos"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Freeform Form */}
        {currentSource === "freeform" && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-4">Add Custom Content</h2>
            <p className="text-gray-600 mb-6">Create custom portfolio content</p>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="freeform-title-wizard"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Title *
                </label>
                <input
                  id="freeform-title-wizard"
                  type="text"
                  value={freeformTitle}
                  onChange={(e) => setFreeformTitle(e.target.value)}
                  placeholder="Content title"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label
                  htmlFor="freeform-type-wizard"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Content Type
                </label>
                <select
                  id="freeform-type-wizard"
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
                <label
                  htmlFor="freeform-content-wizard"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Content *
                </label>
                <textarea
                  id="freeform-content-wizard"
                  value={freeformContent}
                  onChange={(e) => setFreeformContent(e.target.value)}
                  placeholder="Describe your work, achievement, or experience..."
                  rows={6}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label
                  htmlFor="freeform-description-wizard"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Short Description (optional)
                </label>
                <input
                  id="freeform-description-wizard"
                  type="text"
                  value={freeformDescription}
                  onChange={(e) => setFreeformDescription(e.target.value)}
                  placeholder="Brief summary"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label
                  htmlFor="freeform-url-wizard"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  URL (optional)
                </label>
                <input
                  id="freeform-url-wizard"
                  type="url"
                  value={freeformUrl}
                  onChange={(e) => setFreeformUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label
                  htmlFor="freeform-tags-wizard"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Tags (optional, comma-separated)
                </label>
                <input
                  id="freeform-tags-wizard"
                  type="text"
                  value={freeformTags}
                  onChange={(e) => setFreeformTags(e.target.value)}
                  placeholder="react, typescript, web-development"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleSkipSource}
                  disabled={loading}
                  className="flex-1 bg-white border-2 border-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-50"
                >
                  Skip
                </button>
                <button
                  onClick={handleFreeformSubmit}
                  disabled={loading}
                  className="flex-1 bg-pink-600 text-white py-2 px-4 rounded-lg hover:bg-pink-700 disabled:bg-gray-400"
                >
                  {loading ? "Adding..." : "Add Custom Content"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Back Button */}
        <div className="mt-6 text-center">
          <button
            onClick={() => setLocation("/select-sources")}
            className="text-gray-600 hover:text-gray-900"
          >
            ← Back to source selection
          </button>
        </div>
      </div>
    </div>
  );
}
