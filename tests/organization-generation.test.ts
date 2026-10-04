import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  generateOrganization,
  type OrganizationServices,
} from "../server/lib/organization-generator.js";
import { organizationConfigSchema } from "../shared/organization.js";
import type { Repository } from "../shared/schema.js";
import { themes } from "../shared/themes.js";

function repository(id = 1): Repository {
  return {
    id,
    name: `project-${id}`,
    displayName: null,
    description: "Repository description",
    url: `https://github.com/acme/project-${id}`,
    summary: null,
    selected: false,
    source: "github",
    owner: { login: "acme", type: "Organization", avatarUrl: null },
    metadata: {
      id,
      stars: 10,
      language: "TypeScript",
      topics: ["web", "tools"],
      updatedAt: "2026-01-01T00:00:00Z",
      url: null,
    },
  };
}

let directory: string;
let configPath: string;
let dataFile: string;
let outputDirectory: string;
let repos: Repository[];
let services: OrganizationServices;
const run = (force = false) =>
  generateOrganization({ configPath, dataFile, outputDirectory, force }, services);
const saved = () => readFile(dataFile, "utf8");
const html = () => readFile(join(outputDirectory, "index.html"), "utf8");
const config = (extra = {}) =>
  writeFile(configPath, JSON.stringify({ organization: "acme", ...extra }));

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "foliolab-test-"));
  configPath = join(directory, "config.json");
  dataFile = join(directory, "data.json");
  outputDirectory = join(directory, "site");
  await config();
  repos = [repository()];
  services = {
    discover: vi.fn(async () => ({
      organization: {
        login: "acme",
        name: "ACME Research",
        description: "Public research software",
        avatarUrl: null,
        url: "https://github.com/acme",
      },
      repositories: repos,
    })),
    readme: vi.fn(async (_owner, name) => `# ${name}\n\nProject source content`),
    structure: vi.fn(async () => "A TypeScript library"),
    summarize: vi.fn(async () => "A factual project summary."),
  };
});
afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

describe("organization pipeline", () => {
  it("persists data, renders organization identity, and reuses summaries on unchanged runs", async () => {
    expect(await run()).toMatchObject({
      repositoryCount: 1,
      generatedCount: 1,
      reusedCount: 0,
      dataChanged: true,
    });
    const first = await saved();
    expect(await run()).toMatchObject({ generatedCount: 0, reusedCount: 1, dataChanged: false });
    expect(await saved()).toBe(first);
    expect(services.summarize).toHaveBeenCalledTimes(1);
    expect(first).not.toContain("Project source content");
    expect(await html()).toContain("ACME Research");
    expect(await html()).toContain("Public research software");
    expect(await html()).not.toContain("Interests:");
    const exported = JSON.parse(await readFile(join(outputDirectory, "portfolio.json"), "utf8"));
    expect(exported.repositories[0].summary).toBe("A factual project summary.");
    expect(exported.repositories[0]).not.toHaveProperty("fingerprint");
  });

  it("refreshes metadata and stable sorting without regenerating summaries", async () => {
    repos = [repository(2), repository(1)];
    await run();
    expect(JSON.parse(await saved()).repositories.map((repo: Repository) => repo.id)).toEqual([
      1, 2,
    ]);
    repos[0].metadata.stars = 20;
    repos[0].metadata.updatedAt = "2026-02-01T00:00:00Z";
    repos[1].metadata.topics.reverse();
    expect(await run()).toMatchObject({ generatedCount: 0, dataChanged: true });
    const records = JSON.parse(await saved()).repositories;
    expect(records.map((repo: Repository) => repo.id)).toEqual([2, 1]);
    expect(records[0].metadata.stars).toBe(20);
    expect(services.summarize).toHaveBeenCalledTimes(2);
    expect(vi.mocked(services.summarize).mock.calls[0][0]).not.toContain('"stars"');
  });

  it("regenerates only the changed or newly added repository", async () => {
    repos = [repository(1), repository(2)];
    await run();
    services.readme = vi.fn(
      async (_owner, name) =>
        `# ${name}\n\n${name === "project-1" ? "Changed evidence" : "Project source content"}`,
    );
    expect(await run()).toMatchObject({ generatedCount: 1, reusedCount: 1 });
    repos.push(repository(3));
    expect(await run()).toMatchObject({ generatedCount: 1, reusedCount: 2 });
  });

  it("drops absent repositories only after a complete successful discovery", async () => {
    repos = [repository(1), repository(2)];
    await run();
    repos = [repository(2)];
    expect(await run()).toMatchObject({ generatedCount: 0, repositoryCount: 1 });
    expect(JSON.parse(await saved()).repositories.map((repo: Repository) => repo.id)).toEqual([2]);
  });

  it("falls back to project structure and invalidates when that evidence changes", async () => {
    services.readme = vi.fn(async () => "");
    await run();
    expect(services.structure).toHaveBeenCalledWith("acme", "project-1");
    expect(await run()).toMatchObject({ generatedCount: 0 });
    services.structure = vi.fn(async () => "A changed Python service");
    expect(await run()).toMatchObject({ generatedCount: 1 });
  });

  it("invalidates on model, endpoint, and forced generation", async () => {
    await run();
    await config({ model: "another-model" });
    expect(await run()).toMatchObject({ generatedCount: 1 });
    await config({ model: "another-model", endpoint: "https://provider.example/v1" });
    expect(await run()).toMatchObject({ generatedCount: 1 });
    expect(await run(true)).toMatchObject({ generatedCount: 1 });
  });

  it.each(themes.map((theme) => theme.id))(
    "renders theme %s without regenerating summaries",
    async (theme) => {
      await run();
      await config({
        theme,
        title: "<ACME & partners>",
        introduction: "<script>alert(1)</script>",
      });
      expect(await run()).toMatchObject({ generatedCount: 0, dataChanged: false });
      expect(await html()).toContain("&lt;ACME &amp; partners&gt;");
      expect(await html()).not.toContain("<script>alert(1)</script>");
    },
  );

  it.each(["discover", "readme", "structure", "summarize"] as const)(
    "preserves saved data and site when %s fails",
    async (method) => {
      await run();
      const beforeData = await saved();
      const beforeHtml = await html();
      if (method === "structure") services.readme = vi.fn(async () => "");
      services[method] = vi.fn().mockRejectedValue(new Error("Service failed"));
      await expect(run(true)).rejects.toThrow("Service failed");
      expect(await saved()).toBe(beforeData);
      expect(await html()).toBe(beforeHtml);
    },
  );

  it("rejects empty selection without removing existing output", async () => {
    await run();
    const before = await saved();
    repos = [];
    await expect(run()).rejects.toThrow("No eligible public repositories");
    expect(await saved()).toBe(before);
  });

  it.each(["not json", '{"version":2}', '{"version":1}'])(
    "rejects malformed saved data: %s",
    async (contents) => {
      await writeFile(dataFile, contents);
      await expect(run()).rejects.toThrow("Invalid saved portfolio data");
      expect(services.discover).not.toHaveBeenCalled();
      expect(await saved()).toBe(contents);
    },
  );

  it("rejects duplicate records and data for another organization", async () => {
    await run();
    const data = JSON.parse(await saved());
    data.repositories.push(data.repositories[0]);
    await writeFile(dataFile, JSON.stringify(data));
    await expect(run()).rejects.toThrow("Invalid saved portfolio data");
    data.repositories.pop();
    await writeFile(dataFile, JSON.stringify(data));
    await config({ organization: "different" });
    await expect(run()).rejects.toThrow("another organization");
  });

  it("rejects overlapping config/data/site paths before fetching", async () => {
    await expect(
      generateOrganization({ configPath, dataFile: configPath, outputDirectory }, services),
    ).rejects.toThrow("separate files");
    await expect(
      generateOrganization({ configPath, dataFile, outputDirectory: directory }, services),
    ).rejects.toThrow("outside the site");
    expect(services.discover).not.toHaveBeenCalled();
  });

  it("refuses unmanaged output files and symlinked output directories", async () => {
    await mkdir(outputDirectory);
    await writeFile(join(outputDirectory, "private-notes.txt"), "Do not publish");
    await expect(run()).rejects.toThrow("not generated by FolioLab");
    expect(services.discover).not.toHaveBeenCalled();
    await rm(outputDirectory, { recursive: true });
    await symlink(directory, outputDirectory);
    await expect(run()).rejects.toThrow("dedicated directory");
  });

  it("rejects empty model summaries", async () => {
    services.summarize = vi.fn(async () => " ");
    await expect(run()).rejects.toThrow("Empty summary");
    await expect(saved()).rejects.toMatchObject({ code: "ENOENT" });
  });
});

describe("organization configuration", () => {
  it("defaults to public original active projects with exact case-insensitive name filters", () => {
    expect(
      organizationConfigSchema.parse({ organization: "acme", includeRepos: ["Project-A"] }),
    ).toMatchObject({
      includeRepos: ["project-a"],
      excludeRepos: [],
      includeForks: false,
      includeArchived: false,
      theme: "modern",
    });
  });
  it.each([
    { organization: "user/repo" },
    { organization: "acme", theme: "unknown" },
    { organization: "acme", endpoint: "https://secret:password@provider.example/v1" },
    { organization: "acme", endpoint: "https://provider.example/v1?key=secret" },
    { organization: "acme", unexpected: true },
  ])("rejects invalid configuration %j", (value) => {
    expect(() => organizationConfigSchema.parse(value)).toThrow();
  });
});
