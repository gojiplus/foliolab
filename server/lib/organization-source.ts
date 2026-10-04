import { Octokit } from "@octokit/rest";
import type { OrganizationConfig } from "../../shared/organization.js";
import { getOrganizationRepositories } from "./github.js";
import { analyzeProjectStructure, generateProjectSummary } from "./project-analyzer.js";

export function createOrganizationSource(token: string) {
  const octokit = new Octokit({
    auth: token,
    baseUrl: process.env.GITHUB_API_URL || "https://api.github.com",
    request: { timeout: 30000 },
  });
  return {
    async discover(config: OrganizationConfig) {
      try {
        const { data } = await octokit.orgs.get({ org: config.organization });
        const organization = {
          login: data.login,
          name: data.name || null,
          description: data.description || null,
          avatarUrl: data.avatar_url || null,
          url: data.html_url,
        };
        const repositories = await getOrganizationRepositories(octokit, organization, config);
        return { organization, repositories };
      } catch {
        throw new Error(`Could not fetch all public repositories for ${config.organization}`);
      }
    },
    async readme(owner: string, repo: string) {
      try {
        const { data } = await octokit.repos.getReadme({ owner, repo });
        return Buffer.from(data.content, "base64").toString("utf8");
      } catch (error) {
        if ((error as { status?: number }).status === 404) return "";
        throw new Error(`Could not fetch README for ${owner}/${repo}`);
      }
    },
    async structure(owner: string, repo: string) {
      try {
        const structure = await analyzeProjectStructure(token, owner, repo, {
          strict: true,
          octokit,
        });
        // Sort API-provided lists before deriving the text used for generation and hashing.
        structure.rootFiles.sort();
        structure.directories.sort();
        structure.packageFiles.sort((a, b) => a.name.localeCompare(b.name));
        structure.configFiles.sort((a, b) => a.name.localeCompare(b.name));
        structure.sourceFiles.sort((a, b) => a.name.localeCompare(b.name));
        structure.techStack.sort();
        return generateProjectSummary(structure);
      } catch (error) {
        // Empty repositories have no root contents; metadata is still useful.
        if ((error as { status?: number }).status === 404) return "No project files available.";
        throw new Error(`Could not analyze project structure for ${owner}/${repo}`);
      }
    },
  };
}
