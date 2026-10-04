import type { Repository } from "../../shared/schema.js";
import { themes } from "../../shared/themes.js";

export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function capitalizeFirstLetter(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function sanitizeUrl(url: string | null | undefined): string {
  if (!url) return "#";
  const trimmed = url.trim();
  // Check for dangerous protocols
  if (/^(javascript:|data:|vbscript:)/i.test(trimmed)) {
    return "#";
  }
  return escapeHtml(trimmed);
}

export interface PortfolioIdentity {
  login: string;
  type: "User" | "Organization";
  displayName?: string | null;
}

export function generatePortfolioHtml(
  identity: PortfolioIdentity,
  repositories: Repository[],
  introduction?: {
    introduction: string;
    skills: string[];
    interests: string[];
  },
  avatarUrl?: string | null,
  theme: {
    id: string;
    preview: {
      background: string;
      text: string;
      accent: string;
      card: string;
      border: string;
    };
    layout: {
      container: string;
      header: string;
      content: string;
      profile: string;
    };
  } = themes[1],
  customTitle?: string | null,
): string {
  if (!repositories || repositories.length === 0) {
    throw new Error("No repositories provided for portfolio generation");
  }

  const displayName =
    identity.displayName ||
    (identity.type === "Organization" ? identity.login : capitalizeFirstLetter(identity.login));
  const portfolioTitle =
    customTitle || (identity.type === "Organization" ? displayName : `${displayName}'s Portfolio`);

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(portfolioTitle)}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <style>
    /* Define gradient backgrounds for themes */
    .bg-gradient-to-br.from-indigo-50.via-white.to-purple-50 {
      background: linear-gradient(to bottom right, #eef2ff, #ffffff, #faf5ff);
    }
    .bg-gradient-to-r.from-indigo-500.to-purple-500 {
      background: linear-gradient(to right, #6366f1, #a855f7);
      color: white;
    }
    /* Shadow styling for cards */
    .card-shadow {
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
      transition: box-shadow 0.3s ease, transform 0.3s ease;
    }
    .card-shadow:hover {
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.1);
      transform: translateY(-2px);
    }
    /* Button styling */
    .icon-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 4px;
      transition: all 0.2s ease;
    }
    .icon-button:hover {
      opacity: 0.8;
    }
    </style>
</head>
<body class="${theme.preview.background}">
    <div class="container mx-auto px-4 py-20">
        <div class="${theme.layout.container}">
            <header class="${theme.layout.header}">
                <div class="${theme.layout.profile}">
                    ${
                      avatarUrl
                        ? `
                    <div class="mb-6">
                        <img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(displayName)}" class="w-32 h-32 rounded-full mx-auto border-4 border-gray-200 shadow-lg">
                    </div>
                    `
                        : ""
                    }
                    <h1 class="text-4xl font-bold mb-6 ${theme.preview.text}">${escapeHtml(portfolioTitle)}</h1>
                    ${
                      introduction
                        ? `
                    <div class="max-w-2xl ${theme.id === "modern" ? "text-center" : "text-left"}">
                        <p class="${theme.preview.text} mb-8 leading-relaxed">${escapeHtml(introduction.introduction)}</p>
                        <div class="flex flex-wrap gap-3 ${theme.id === "modern" ? "justify-center" : ""} mb-8">
                            ${introduction.skills
                              .map((skill) =>
                                theme.id === "modern"
                                  ? `<span class="px-3 py-1 rounded-full text-sm font-medium bg-gradient-to-r from-indigo-500 to-purple-500 text-white">${escapeHtml(skill)}</span>`
                                  : `<span class="${theme.preview.accent} px-3 py-1 rounded-full text-sm font-medium">${escapeHtml(skill)}</span>`,
                              )
                              .join("")}
                        </div>
                        ${
                          introduction.interests.length
                            ? `<p class="${theme.preview.text} text-sm mb-8">
                            <span class="font-medium">Interests:</span> ${introduction.interests.map((interest) => escapeHtml(interest)).join(", ")}
                        </p>`
                            : ""
                        }
                    </div>
                    `
                        : ""
                    }
                </div>
            </header>

            <div class="${theme.layout.content}">
                ${repositories
                  .map((repo) => {
                    if (!repo || typeof repo !== "object") {
                      console.error("Invalid repository object:", repo);
                      return "";
                    }

                    const topics = Array.isArray(repo.metadata?.topics) ? repo.metadata.topics : [];
                    const description = repo.summary || repo.description || "";

                    const marginClass = theme.id === "minimal" ? "mb-6" : "";

                    return `
                    <article class="${theme.preview.card} p-6 relative card-shadow ${marginClass}">
                        <div class="flex justify-between items-start">
                            <h2 class="text-2xl font-semibold mb-2 ${theme.preview.text}">${escapeHtml(repo.displayName || repo.name || "Untitled Project")}</h2>
                            <div class="flex items-center gap-2">
                                ${
                                  repo.metadata?.stars > 0
                                    ? `
                                <span class="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full flex items-center">
                                    ★ ${repo.metadata.stars}
                                </span>
                                `
                                    : ""
                                }
                                <a href="${sanitizeUrl(repo.url)}" class="icon-button border border-gray-200 bg-white" target="_blank" title="View on GitHub">
                                    <i class="fab fa-github"></i>
                                </a>
                                ${
                                  repo.metadata?.url
                                    ? `<a href="${sanitizeUrl(repo.metadata.url)}" class="icon-button border border-gray-200 bg-white" target="_blank" title="View Live Demo">
                                        <i class="fas fa-external-link-alt"></i>
                                    </a>`
                                    : ""
                                }
                            </div>
                        </div>
                        <p class="${theme.preview.text} mb-4">${escapeHtml(description)}</p>
                        <div class="flex gap-2 flex-wrap">
                            ${topics
                              .map((topic) =>
                                theme.id === "modern"
                                  ? `<span class="px-2 py-1 rounded-full text-sm bg-gradient-to-r from-indigo-500 to-purple-500 text-white">${escapeHtml(topic)}</span>`
                                  : `<span class="${theme.preview.accent} px-2 py-1 rounded-full text-sm">${escapeHtml(topic)}</span>`,
                              )
                              .join("")}
                        </div>
                    </article>
                  `;
                  })
                  .join("")}
            </div>
        </div>
    </div>
</body>
</html>`;
}
