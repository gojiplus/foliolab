import { Octokit } from "@octokit/rest";
import type { Organization, Repository } from "@shared/schema";

interface GithubUser {
  githubId: string;
  username: string;
  avatarUrl: string | null;
}

/**
 * Octokit error interface for better type safety
 */
interface OctokitError extends Error {
  status?: number;
  response?: {
    status: number;
    data: any;
  };
}

/**
 * Type guard to check if an error is an Octokit error
 * @param error - The error to check
 * @returns True if the error is an OctokitError
 */
function isOctokitError(error: unknown): error is OctokitError {
  return (
    error instanceof Error &&
    ("status" in error || ("response" in error && typeof (error as any).response === "object"))
  );
}

/**
 * Generic pagination helper for GitHub API calls
 * Automatically handles pagination to retrieve all results
 *
 * @param fetchPage - Function that fetches a single page of results
 * @param perPage - Number of items per page (default: 100)
 * @returns Promise containing all paginated results
 */
async function paginateGithubAPI<T>(
  fetchPage: (page: number) => Promise<T[]>,
  perPage: number = 100,
): Promise<T[]> {
  const results: T[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const data = await fetchPage(page);

    if (data.length === 0) {
      hasMore = false;
    } else {
      results.push(...data);
      hasMore = data.length === perPage;
      if (hasMore) {
        page++;
      }
    }
  }

  return results;
}

export async function getGithubUser(accessToken: string): Promise<GithubUser> {
  const octokit = new Octokit({ auth: accessToken });
  const { data } = await octokit.users.getAuthenticated();
  return {
    githubId: data.id.toString(),
    username: data.login,
    avatarUrl: data.avatar_url || null,
  };
}

export async function checkRepositoryExists(
  accessToken: string,
  username: string,
  repoName: string,
): Promise<boolean> {
  const octokit = new Octokit({ auth: accessToken });
  try {
    await octokit.repos.get({
      owner: username,
      repo: repoName,
    });
    return true;
  } catch (error) {
    if (isOctokitError(error) && error.status === 404) {
      return false;
    }
    throw error;
  }
}

export async function getUserOrganizations(accessToken: string): Promise<Organization[]> {
  const octokit = new Octokit({ auth: accessToken });

  try {
    const orgData = await paginateGithubAPI(async (page) => {
      const { data } = await octokit.orgs.listForAuthenticatedUser({
        per_page: 100,
        page,
      });
      return data;
    });

    const organizations = orgData.map((org) => ({
      id: org.id,
      login: org.login,
      name: org.description || null,
      avatarUrl: org.avatar_url || null,
    }));

    console.log(`Fetched ${organizations.length} organizations for user`);
    return organizations;
  } catch (error) {
    console.error("Failed to fetch user organizations:", error);
    // Don't return empty array - let the caller know there was an error
    throw new Error(
      `Failed to fetch organizations: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function getUserRepositories(
  octokit: Octokit,
  user: { login: string; type: "User"; avatarUrl: string | null },
): Promise<Repository[]> {
  try {
    const allRepos = await paginateGithubAPI(async (page) => {
      const { data } = await octokit.repos.listForAuthenticatedUser({
        visibility: "public",
        sort: "updated",
        per_page: 100,
        page,
      });
      return data;
    });

    // Apply filtering - make it less aggressive
    const filteredRepos = allRepos.filter((repo) => {
      const lowerName = repo.name.toLowerCase();
      return (
        !repo.archived && // Keep forks but remove archived repos
        !lowerName.includes("-folio") &&
        repo.name !== "foliolab-vercel"
        // Removed github.io filter as it might be legitimate portfolio sites
      );
    });

    console.log(
      `Fetched ${allRepos.length} repositories for user ${user.login}, ${filteredRepos.length} after filtering`,
    );

    return filteredRepos.map((repo) => {
      // Extract the actual owner from the repository URL
      const urlParts = repo.html_url.split("/");
      const repoOwner = urlParts[3]; // GitHub URLs follow the pattern: https://github.com/owner/repo

      // Determine if this is a user or organization based on the actual repo owner
      const isUserRepo = repoOwner === user.login;

      return {
        id: repo.id,
        name: repo.name,
        description: repo.description || null,
        url: repo.html_url,
        summary: null,
        selected: false,
        source: "github" as const,
        owner: {
          login: repoOwner,
          type: isUserRepo ? "User" : "Organization",
          avatarUrl: isUserRepo ? user.avatarUrl : null, // We might not have org avatar here
        },
        metadata: {
          id: repo.id,
          stars: typeof repo.stargazers_count === "number" ? repo.stargazers_count : 0,
          language: repo.language || null,
          topics: repo.topics || [],
          updatedAt: repo.updated_at || "",
          url: repo.homepage || null,
        },
      };
    });
  } catch (error) {
    console.error(`Failed to fetch repositories for user ${user.login}:`, error);
    // Don't return empty array - let the caller handle the error
    throw new Error(
      `Failed to fetch repositories for user ${user.login}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function getOrganizationRepositories(
  octokit: Octokit,
  org: { login: string; avatarUrl: string | null },
  filters?: {
    includeForks: boolean;
    includeArchived: boolean;
    includeRepos: string[];
    excludeRepos: string[];
  },
): Promise<Repository[]> {
  try {
    const allRepos = await paginateGithubAPI(async (page) => {
      const { data } = await octokit.repos.listForOrg({
        org: org.login,
        type: "public",
        sort: "updated",
        per_page: 100,
        page,
      });
      return data;
    });

    // Apply filtering - make it less aggressive
    const filteredRepos = allRepos.filter((repo) => {
      if (repo.private || repo.owner.login.toLowerCase() !== org.login.toLowerCase()) return false;
      if (filters) {
        const name = repo.name.toLowerCase();
        return (
          (filters.includeForks || !repo.fork) &&
          (filters.includeArchived || !repo.archived) &&
          (!filters.includeRepos.length || filters.includeRepos.includes(name)) &&
          !filters.excludeRepos.includes(name)
        );
      }
      return (
        !repo.archived &&
        !repo.name.toLowerCase().includes("-folio") &&
        repo.name !== "foliolab-vercel"
      );
    });

    if (!filters) {
      console.log(
        `Fetched ${allRepos.length} repositories for org ${org.login}, ${filteredRepos.length} after filtering`,
      );
    }

    return filteredRepos.map((repo) => {
      // Extract the actual owner from the repository URL
      const urlParts = repo.html_url.split("/");
      const repoOwner = urlParts[3]; // GitHub URLs follow the pattern: https://github.com/owner/repo

      return {
        id: repo.id,
        name: repo.name,
        description: repo.description || null,
        url: repo.html_url,
        summary: null,
        selected: false,
        source: "github" as const,
        owner: {
          login: repoOwner,
          type: "Organization", // This should always be an organization
          avatarUrl: org.avatarUrl,
        },
        metadata: {
          id: repo.id,
          stars: typeof repo.stargazers_count === "number" ? repo.stargazers_count : 0,
          language: repo.language || null,
          topics: repo.topics || [],
          updatedAt: repo.updated_at || "",
          url: repo.homepage || null,
        },
      };
    });
  } catch (error) {
    if (filters) throw error;
    console.error(`Failed to fetch repositories for org ${org.login}:`, error);
    // Don't return empty array - let the caller handle the error
    throw new Error(
      `Failed to fetch repositories for org ${org.login}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function getRepositories(accessToken: string): Promise<Repository[]> {
  const octokit = new Octokit({ auth: accessToken });

  try {
    // Get authenticated user info
    const { data: userData } = await octokit.users.getAuthenticated();
    const userInfo = {
      login: userData.login,
      type: "User" as const,
      avatarUrl: userData.avatar_url || null,
    };

    // Get user repositories with error handling
    let userRepos: Repository[] = [];
    try {
      userRepos = await getUserRepositories(octokit, userInfo);
    } catch (error) {
      console.warn("Failed to fetch user repositories, continuing with organizations only:", error);
      userRepos = [];
    }

    // Get user organizations with error handling
    let orgs: Organization[] = [];
    try {
      orgs = await getUserOrganizations(accessToken);
    } catch (error) {
      console.warn("Failed to fetch organizations, continuing with user repos only:", error);
      orgs = [];
    }

    // Get repositories for each organization concurrently with individual error handling
    const orgReposPromises = orgs.map(async (org) => {
      try {
        return await getOrganizationRepositories(octokit, {
          login: org.login,
          avatarUrl: org.avatarUrl,
        });
      } catch (error) {
        console.warn(
          `Failed to fetch repositories for organization ${org.login}, skipping:`,
          error,
        );
        return [];
      }
    });

    const orgReposResults = await Promise.all(orgReposPromises);
    const orgRepos = orgReposResults.flat();

    // Combine user and organization repositories, but deduplicate based on repo ID
    const allRepos = [...userRepos, ...orgRepos];

    console.log(`Repository Summary:
      - User repositories: ${userRepos.length}
      - Organization repositories: ${orgRepos.length}
      - Total before deduplication: ${allRepos.length}
      - Organizations processed: ${orgs.length}`);

    // Use a Map to deduplicate repositories by ID
    const uniqueReposMap = new Map<number, Repository>();

    for (const repo of allRepos) {
      if (!uniqueReposMap.has(repo.id)) {
        uniqueReposMap.set(repo.id, repo);
      }
    }

    const repositories = Array.from(uniqueReposMap.values());
    console.log(`Final repository count after deduplication: ${repositories.length}`);

    // Fetch READMEs and extract titles (in batches to avoid rate limiting)
    const BATCH_SIZE = parseInt(process.env.GITHUB_BATCH_SIZE || "10", 10);
    const BATCH_DELAY_MS = parseInt(process.env.GITHUB_BATCH_DELAY_MS || "100", 10);

    for (let i = 0; i < repositories.length; i += BATCH_SIZE) {
      const batch = repositories.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(repositories.length / BATCH_SIZE);

      console.log(`Processing README batch ${batchNumber}/${totalBatches} (${batch.length} repos)`);

      const results = await Promise.all(
        batch.map(async (repo): Promise<{ repo: string; success: boolean }> => {
          try {
            const readme = await getReadmeContent(octokit, repo.owner.login, repo.name);
            const displayName = extractTitleFromReadme(readme);

            // Update the repository with the display name from README
            if (displayName) {
              repo.displayName = displayName;
            }
            return { repo: `${repo.owner.login}/${repo.name}`, success: true };
          } catch (error) {
            console.warn(`Failed to process README for ${repo.owner.login}/${repo.name}:`, error);
            // Continue with other repositories, don't set displayName
            repo.displayName = null;
            return { repo: `${repo.owner.login}/${repo.name}`, success: false };
          }
        }),
      );

      // Log batch results for monitoring
      const failures = results.filter((r) => !r.success);
      if (failures.length > 0) {
        console.warn(`Batch ${batchNumber}: ${failures.length}/${batch.length} failures`);
      }

      // Add delay between batches to avoid rate limiting (except for last batch)
      if (i + BATCH_SIZE < repositories.length) {
        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    return repositories;
  } catch (error) {
    console.error("Failed to fetch repositories:", error);
    throw error;
  }
}

export async function createPortfolioRepository(
  accessToken: string,
  username: string,
  repoName: string = "foliolab-vercel",
): Promise<{ repoUrl: string; wasCreated: boolean }> {
  const octokit = new Octokit({ auth: accessToken });

  try {
    const exists = await checkRepositoryExists(accessToken, username, repoName);

    if (!exists) {
      const { data: repo } = await octokit.repos.createForAuthenticatedUser({
        name: repoName,
        description: "My automatically generated portfolio showcase",
        private: false,
        auto_init: true,
      });

      return { repoUrl: repo.html_url, wasCreated: true };
    } else {
      const { data: repo } = await octokit.repos.get({
        owner: username,
        repo: repoName,
      });

      return { repoUrl: repo.html_url, wasCreated: false };
    }
  } catch (error) {
    console.error("Failed to handle portfolio repository:", error);
    throw error;
  }
}

export function extractTitleFromReadme(readme: string | null): string | null {
  if (!readme) return null;

  // Look for a line starting with # at the beginning of the file
  const lines = readme.split("\n");
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith("#")) {
      // remove all leading # characters and trim spaces
      return trimmedLine.replace(/^#+/, "").trim();
    }
  }

  return null;
}

export async function getReadmeContent(
  clientOrToken: Octokit | string,
  owner: string,
  repo: string,
): Promise<string | null> {
  const octokit =
    typeof clientOrToken === "string" ? new Octokit({ auth: clientOrToken }) : clientOrToken;

  try {
    const { data } = await octokit.repos.getReadme({
      owner,
      repo,
      mediaType: { format: "raw" },
    });
    return data.toString();
  } catch (_error) {
    console.warn(`Failed to fetch README for ${owner}/${repo}:`);
    return null;
  }
}

export async function commitPortfolioFiles(
  accessToken: string,
  username: string,
  files: Array<{ path: string; content: string }>,
  repoName: string = "foliolab-vercel",
): Promise<void> {
  const octokit = new Octokit({ auth: accessToken });

  try {
    const { data: ref } = await octokit.git.getRef({
      owner: username,
      repo: repoName,
      ref: "heads/main",
    });

    const { data: tree } = await octokit.git.createTree({
      owner: username,
      repo: repoName,
      base_tree: ref.object.sha,
      tree: files.map((file) => ({
        path: file.path,
        mode: "100644",
        type: "blob",
        content: file.content,
      })),
    });

    const { data: commit } = await octokit.git.createCommit({
      owner: username,
      repo: repoName,
      message: "Update portfolio site",
      tree: tree.sha,
      parents: [ref.object.sha],
    });

    await octokit.git.updateRef({
      owner: username,
      repo: repoName,
      ref: "heads/main",
      sha: commit.sha,
    });
  } catch (error) {
    console.error("Failed to commit portfolio files:", error);
    throw error;
  }
}

export async function deployToGitHubPages(
  accessToken: string,
  username: string,
  html: string,
): Promise<{ url: string; wasCreated: boolean }> {
  const octokit = new Octokit({ auth: accessToken });
  const repoName = `${username}.github.io`;

  try {
    const exists = await checkRepositoryExists(accessToken, username, repoName);
    let wasCreated = false;

    if (!exists) {
      await octokit.repos.createForAuthenticatedUser({
        name: repoName,
        description: "My GitHub Pages website",
        private: false,
        auto_init: true,
      });
      wasCreated = true;
    }

    const { data: ref } = await octokit.git.getRef({
      owner: username,
      repo: repoName,
      ref: "heads/main",
    });

    const { data: tree } = await octokit.git.createTree({
      owner: username,
      repo: repoName,
      base_tree: ref.object.sha,
      tree: [
        {
          path: "portfolio.html",
          mode: "100644",
          type: "blob",
          content: html,
        },
      ],
    });

    const { data: commit } = await octokit.git.createCommit({
      owner: username,
      repo: repoName,
      message: wasCreated ? "Initial portfolio commit" : "Update portfolio page",
      tree: tree.sha,
      parents: [ref.object.sha],
    });

    await octokit.git.updateRef({
      owner: username,
      repo: repoName,
      ref: "heads/main",
      sha: commit.sha,
    });

    return {
      url: `https://${username}.github.io/portfolio.html`,
      wasCreated,
    };
  } catch (error) {
    console.error("Failed to deploy to GitHub Pages:", error);
    throw error;
  }
}
