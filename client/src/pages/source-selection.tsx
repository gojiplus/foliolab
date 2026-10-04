import type { SourceType } from "@shared/schema";
import { useState } from "react";
import { useLocation } from "wouter";
import { getGitHubToken } from "../lib/storage";
import { initializeWizardState } from "../lib/wizard-state";

interface SourceOption {
  type: SourceType;
  title: string;
  description: string;
  icon: string;
  color: string;
  requiresAuth: boolean;
}

export default function SourceSelectionPage() {
  const [, setLocation] = useLocation();
  const [selectedSources, setSelectedSources] = useState<SourceType[]>([]);
  const hasGitHubToken = !!getGitHubToken();

  const sourceOptions: SourceOption[] = [
    {
      type: "github",
      title: "GitHub Repositories",
      description: "Import your GitHub repositories",
      icon: "🐙",
      color: "bg-gray-50 border-gray-200",
      requiresAuth: true,
    },
    {
      type: "blog_rss",
      title: "Blog RSS Feed",
      description: "Import blog posts from any RSS feed",
      icon: "📰",
      color: "bg-orange-50 border-orange-200",
      requiresAuth: false,
    },
    {
      type: "medium",
      title: "Medium Posts",
      description: "Showcase your Medium articles",
      icon: "📝",
      color: "bg-green-50 border-green-200",
      requiresAuth: false,
    },
    {
      type: "gitlab",
      title: "GitLab Projects",
      description: "Import projects from GitLab",
      icon: "🦊",
      color: "bg-purple-50 border-purple-200",
      requiresAuth: true,
    },
    {
      type: "bitbucket",
      title: "Bitbucket Repos",
      description: "Add Bitbucket repositories",
      icon: "🪣",
      color: "bg-blue-50 border-blue-200",
      requiresAuth: true,
    },
    {
      type: "freeform",
      title: "Custom Content",
      description: "Add any custom content you like",
      icon: "✍️",
      color: "bg-pink-50 border-pink-200",
      requiresAuth: false,
    },
  ];

  const toggleSource = (type: SourceType) => {
    setSelectedSources((prev) =>
      prev.includes(type) ? prev.filter((s) => s !== type) : [...prev, type],
    );
  };

  const handleContinue = () => {
    if (selectedSources.length === 0) {
      alert("Please select at least one data source");
      return;
    }

    // Initialize wizard state
    initializeWizardState(selectedSources);

    // Navigate to wizard
    setLocation("/wizard");
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => setLocation("/")}
            className="text-gray-600 hover:text-gray-900 mb-4 flex items-center gap-2"
            aria-label="Back to Home"
          >
            ← Back to Home
          </button>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Build Your Portfolio</h1>
          <p className="text-gray-600 text-lg">Select the data sources you'd like to import from</p>
        </div>

        {/* Progress Indicator */}
        <div className="bg-white rounded-lg shadow-xs p-4 mb-8">
          <div
            className="grid grid-cols-2 gap-4 sm:flex sm:items-center sm:justify-between"
            role="list"
            aria-label="Progress steps"
          >
            <div className="flex items-center gap-3" role="listitem" aria-current="step">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold">
                1
              </div>
              <span className="font-medium text-gray-900">Select Sources</span>
            </div>
            <div className="flex-1 h-1 bg-gray-200 mx-4" aria-hidden="true"></div>
            <div className="flex items-center gap-3" role="listitem">
              <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center font-semibold">
                2
              </div>
              <span className="text-gray-500">Import Data</span>
            </div>
            <div className="flex-1 h-1 bg-gray-200 mx-4" aria-hidden="true"></div>
            <div className="flex items-center gap-3" role="listitem">
              <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center font-semibold">
                3
              </div>
              <span className="text-gray-500">Select Items</span>
            </div>
            <div className="flex-1 h-1 bg-gray-200 mx-4" aria-hidden="true"></div>
            <div className="flex items-center gap-3" role="listitem">
              <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center font-semibold">
                4
              </div>
              <span className="text-gray-500">Preview</span>
            </div>
          </div>
        </div>

        {/* Source Selection Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {sourceOptions.map((source) => {
            const isSelected = selectedSources.includes(source.type);
            const isGitHub = source.type === "github";
            const isDisabled = isGitHub && hasGitHubToken; // Already authenticated

            return (
              <button
                key={source.type}
                onClick={() => !isDisabled && toggleSource(source.type)}
                disabled={isDisabled}
                aria-pressed={isSelected}
                className={`${source.color} border-2 rounded-lg p-6 text-left hover:shadow-lg transition-all relative focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${
                  isSelected ? "ring-4 ring-blue-500/50" : ""
                } ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {/* Selection Checkbox */}
                <div className="absolute top-4 right-4" aria-hidden="true">
                  <div
                    className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                      isSelected ? "bg-blue-600 border-blue-600" : "bg-white border-gray-300"
                    }`}
                  >
                    {isSelected && <span className="text-white text-sm">✓</span>}
                  </div>
                </div>

                <div className="text-4xl mb-3">{source.icon}</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{source.title}</h3>
                <p className="text-gray-600 text-sm mb-3">{source.description}</p>

                {source.requiresAuth && (
                  <span className="inline-block text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                    Requires authentication
                  </span>
                )}

                {isDisabled && (
                  <span className="inline-block text-xs bg-green-100 text-green-800 px-2 py-1 rounded mt-2">
                    Already connected
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Selected Count */}
        {selectedSources.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-blue-900">
              <span className="font-semibold">{selectedSources.length}</span> source
              {selectedSources.length > 1 ? "s" : ""} selected
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-4">
          <button
            onClick={() => setLocation("/")}
            className="bg-white border-2 border-gray-300 text-gray-700 py-3 px-8 rounded-lg hover:bg-gray-50 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleContinue}
            disabled={selectedSources.length === 0}
            className="bg-linear-to-r from-blue-600 to-indigo-600 text-white py-3 px-8 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue to Import →
          </button>
        </div>
      </div>
    </div>
  );
}
