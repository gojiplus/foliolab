import type { PortfolioItem, SourceType } from "@shared/schema";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  getPortfolioItems,
  savePortfolioItems,
  togglePortfolioItemSelection,
} from "../lib/storage";
import { clearWizardState } from "../lib/wizard-state";

const sourceLabels: Record<SourceType, { label: string; icon: string; color: string }> = {
  github: { label: "GitHub", icon: "🐙", color: "bg-gray-100 text-gray-800" },
  blog_rss: { label: "Blog Posts", icon: "📰", color: "bg-orange-100 text-orange-800" },
  medium: { label: "Medium", icon: "📝", color: "bg-green-100 text-green-800" },
  gitlab: { label: "GitLab", icon: "🦊", color: "bg-purple-100 text-purple-800" },
  bitbucket: { label: "Bitbucket", icon: "🪣", color: "bg-blue-100 text-blue-800" },
  linkedin: { label: "LinkedIn", icon: "🔗", color: "bg-cyan-100 text-cyan-800" },
  freeform: { label: "Custom", icon: "✍️", color: "bg-pink-100 text-pink-800" },
};

// Helper functions to safely access properties across different item types
const getItemTitle = (item: PortfolioItem): string => {
  if (item.source === "github" || item.source === "gitlab" || item.source === "bitbucket") {
    return (item as any).displayName || (item as any).name;
  }
  if ("title" in item) {
    return item.title || "Untitled";
  }
  return "Untitled";
};

const getItemDescription = (item: PortfolioItem): string | null => {
  if ("description" in item && item.description !== null) {
    return item.description;
  }
  if (item.source === "linkedin" && "content" in item) {
    return item.content || null;
  }
  if (item.source === "freeform" && "content" in item) {
    return (item as any).description || item.content;
  }
  return null;
};

const getItemTags = (item: PortfolioItem): string[] => {
  if ("tags" in item && Array.isArray(item.tags)) {
    return item.tags;
  }
  if ((item.source === "github" || item.source === "gitlab") && "metadata" in item) {
    return (item as any).metadata?.topics || [];
  }
  return [];
};

export default function SelectItemsPage() {
  const [, setLocation] = useLocation();
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [filter, setFilter] = useState<SourceType | "all">("all");

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = () => {
    const allItems = getPortfolioItems();
    setItems(allItems);
  };

  const handleToggleSelection = (id: string | number) => {
    togglePortfolioItemSelection(id);
    loadItems();
  };

  const handleSelectAll = () => {
    const updatedItems = items.map((item) => ({ ...item, selected: true }));
    savePortfolioItems(updatedItems);
    loadItems();
  };

  const handleDeselectAll = () => {
    const updatedItems = items.map((item) => ({ ...item, selected: false }));
    savePortfolioItems(updatedItems);
    loadItems();
  };

  const handleContinue = () => {
    const selectedCount = items.filter((item) => item.selected).length;
    if (selectedCount === 0) {
      if (!confirm("No items selected. Continue anyway?")) {
        return;
      }
    }

    // Clear wizard state when moving to preview
    clearWizardState();
    setLocation("/preview");
  };

  const filteredItems = useMemo(
    () => (filter === "all" ? items : items.filter((item) => item.source === filter)),
    [items, filter],
  );

  const groupedItems = useMemo(
    () =>
      filteredItems.reduce(
        (acc, item) => {
          const source = item.source;
          if (!acc[source]) {
            acc[source] = [];
          }
          acc[source].push(item);
          return acc;
        },
        {} as Record<string, PortfolioItem[]>,
      ),
    [filteredItems],
  );

  const selectedCount = items.filter((item) => item.selected).length;
  const totalCount = items.length;

  const uniqueSources = useMemo(
    () => Array.from(new Set(items.map((item) => item.source))),
    [items],
  );

  const sourceCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    items.forEach((item) => {
      counts[item.source] = (counts[item.source] || 0) + 1;
    });
    return counts;
  }, [items]);

  if (totalCount === 0) {
    return (
      <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100 p-4 flex items-center justify-center">
        <div className="max-w-md bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="text-6xl mb-4">📦</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Items Imported</h2>
          <p className="text-gray-600 mb-6">
            You haven't imported any items yet. Go back and import some data sources.
          </p>
          <button
            onClick={() => setLocation("/select-sources")}
            className="bg-blue-600 text-white py-2 px-6 rounded-lg hover:bg-blue-700"
          >
            Import Data Sources
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Select Portfolio Items</h1>
          <p className="text-gray-600">
            Choose which items you'd like to include in your portfolio
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="bg-white rounded-lg shadow-xs p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center font-semibold">
                ✓
              </div>
              <span className="text-sm text-gray-500">Sources</span>
            </div>
            <div className="flex-1 h-1 bg-green-600 mx-4"></div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center font-semibold">
                ✓
              </div>
              <span className="text-sm text-gray-500">Import</span>
            </div>
            <div className="flex-1 h-1 bg-blue-600 mx-4"></div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold">
                3
              </div>
              <span className="font-medium text-gray-900">Select</span>
            </div>
            <div className="flex-1 h-1 bg-gray-200 mx-4"></div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center font-semibold">
                4
              </div>
              <span className="text-gray-500">Preview</span>
            </div>
          </div>
        </div>

        {/* Stats and Actions Bar */}
        <div className="bg-white rounded-lg shadow-xs p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-gray-700">
              <span className="font-semibold text-blue-600">{selectedCount}</span> of{" "}
              <span className="font-semibold">{totalCount}</span> selected
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSelectAll}
              className="text-sm bg-blue-50 text-blue-700 px-4 py-2 rounded-lg hover:bg-blue-100"
            >
              Select All
            </button>
            <button
              onClick={handleDeselectAll}
              className="text-sm bg-gray-50 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-100"
            >
              Deselect All
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="bg-white rounded-lg shadow-xs p-2 mb-6 flex gap-2 overflow-x-auto">
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 rounded-lg whitespace-nowrap ${
              filter === "all"
                ? "bg-blue-600 text-white"
                : "bg-gray-50 text-gray-700 hover:bg-gray-100"
            }`}
          >
            All ({totalCount})
          </button>
          {uniqueSources.map((source) => {
            const count = sourceCounts[source] || 0;
            const sourceInfo = sourceLabels[source];
            return (
              <button
                key={source}
                onClick={() => setFilter(source)}
                className={`px-4 py-2 rounded-lg whitespace-nowrap flex items-center gap-2 ${
                  filter === source
                    ? "bg-blue-600 text-white"
                    : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                }`}
              >
                <span>{sourceInfo.icon}</span>
                <span>
                  {sourceInfo.label} ({count})
                </span>
              </button>
            );
          })}
        </div>

        {/* Items List */}
        <div className="space-y-6 mb-6">
          {Object.entries(groupedItems).map(([source, sourceItems]) => {
            const sourceInfo = sourceLabels[source as SourceType];

            return (
              <div key={source} className="bg-white rounded-lg shadow-xs p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">{sourceInfo.icon}</span>
                  <h2 className="text-xl font-semibold text-gray-900">{sourceInfo.label}</h2>
                  <span className="text-sm text-gray-500">({sourceItems.length} items)</span>
                </div>

                <div className="space-y-2">
                  {sourceItems.map((item, _itemIndex) => {
                    const itemId =
                      item.source === "github" || item.source === "gitlab"
                        ? (item as any).id
                        : item.id;

                    // Use composite key to ensure uniqueness
                    const itemKey = `${item.source}-${itemId}`;

                    return (
                      <div
                        key={itemKey}
                        role="checkbox"
                        aria-checked={item.selected}
                        tabIndex={0}
                        onClick={() => handleToggleSelection(itemId)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleToggleSelection(itemId);
                          }
                        }}
                        className={`p-4 border-2 rounded-lg cursor-pointer transition-all focus:outline-hidden focus:ring-2 focus:ring-blue-500 ${
                          item.selected
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:border-gray-300 bg-white"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Checkbox */}
                          <div className="mt-1">
                            <div
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                item.selected
                                  ? "bg-blue-600 border-blue-600"
                                  : "bg-white border-gray-300"
                              }`}
                            >
                              {item.selected && <span className="text-white text-xs">✓</span>}
                            </div>
                          </div>

                          {/* Content */}
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900 mb-1">
                              {getItemTitle(item)}
                            </h3>
                            {getItemDescription(item) && (
                              <p className="text-sm text-gray-600 line-clamp-2">
                                {getItemDescription(item)}
                              </p>
                            )}

                            {/* Meta Info */}
                            <div className="flex flex-wrap gap-2 mt-2">
                              <span className={`text-xs px-2 py-1 rounded ${sourceInfo.color}`}>
                                {sourceInfo.label}
                              </span>
                              {getItemTags(item).length > 0 && (
                                <>
                                  {getItemTags(item)
                                    .slice(0, 3)
                                    .map((tag) => (
                                      <span
                                        key={tag}
                                        className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded"
                                      >
                                        {tag}
                                      </span>
                                    ))}
                                  {getItemTags(item).length > 3 && (
                                    <span className="text-xs text-gray-500 px-2 py-1">
                                      +{getItemTags(item).length - 3} more
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between gap-4 sticky bottom-4 bg-white rounded-lg shadow-lg p-4">
          <button
            onClick={() => setLocation("/select-sources")}
            className="bg-white border-2 border-gray-300 text-gray-700 py-3 px-8 rounded-lg hover:bg-gray-50 transition-all"
          >
            ← Back
          </button>
          <button
            onClick={handleContinue}
            className="bg-linear-to-r from-blue-600 to-indigo-600 text-white py-3 px-8 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg"
          >
            Continue to Preview →
          </button>
        </div>
      </div>
    </div>
  );
}
