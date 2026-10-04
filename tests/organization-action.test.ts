import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createOrganizationSource } from "../server/lib/organization-source.js";
import { organizationConfigSchema } from "../shared/organization.js";

const exec = promisify(execFile);
let directory: string;
let server: Server;
let baseURL: string;
let requests: string[];
let completions: Record<string, unknown>[];
let list: ReturnType<typeof githubRepo>[];
let readmeStatus: number;
let structureStatus: number;
let secondPageStatus: number;
let completionStatus: number;
let completion: { finish_reason: string; message: { content: string; refusal?: string } };
const githubSecret = "fake-github-secret";
const aiSecret = "fake-openai-secret";

function githubRepo(id: number) {
  return {
    id,
    name: `project-${id}`,
    full_name: `acme/project-${id}`,
    owner: { login: "acme" },
    private: false,
    archived: false,
    fork: false,
    html_url: `https://github.com/acme/project-${id}`,
    description: "A public project",
    language: "TypeScript",
    topics: ["tools"],
    stargazers_count: 3,
    updated_at: "2026-01-01T00:00:00Z",
    homepage: null,
  };
}

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "foliolab-action-test-"));
  requests = [];
  completions = [];
  list = [githubRepo(1)];
  readmeStatus = 200;
  structureStatus = 200;
  secondPageStatus = 200;
  completionStatus = 200;
  completion = {
    finish_reason: "stop",
    message: { content: JSON.stringify({ summary: "A useful public software project." }) },
  };
  server = createServer(async (req, res) => {
    const url = new URL(req.url || "/", "http://localhost");
    requests.push(url.pathname + url.search);
    res.setHeader("Content-Type", "application/json");
    const respond = (value: unknown, status = 200) => {
      res.statusCode = status;
      res.end(JSON.stringify(value));
    };
    if (url.pathname === "/orgs/acme")
      return respond({
        login: "acme",
        name: "ACME Research",
        description: "Open research tools",
        avatar_url: "https://avatars.githubusercontent.com/u/1",
        html_url: "https://github.com/acme",
      });
    if (url.pathname === "/orgs/acme/repos") {
      const page = Number(url.searchParams.get("page") || 1);
      if (page > 1 && secondPageStatus !== 200)
        return respond({ message: "Failure" }, secondPageStatus);
      return respond(list.slice((page - 1) * 100, page * 100));
    }
    if (/\/repos\/acme\/project-\d+\/readme/.test(url.pathname)) {
      return respond(
        {
          content: Buffer.from("# Public project\n\nSource evidence for summary.").toString(
            "base64",
          ),
          encoding: "base64",
        },
        readmeStatus,
      );
    }
    if (/\/repos\/acme\/project-\d+\/contents\/?$/.test(url.pathname)) {
      return respond(
        [
          { name: "package.json", type: "file", size: 100 },
          { name: "src", type: "dir" },
        ],
        structureStatus,
      );
    }
    if (url.pathname.endsWith("/contents/package.json")) {
      res.setHeader("Content-Type", "text/plain");
      res.end(
        JSON.stringify({ description: "A package without a README", dependencies: { react: "1" } }),
      );
      return;
    }
    if (url.pathname === "/v1/chat/completions") {
      let body = "";
      for await (const part of req) body += part;
      completions.push(JSON.parse(body));
      return respond(
        completionStatus === 200
          ? { choices: [completion] }
          : { error: { message: `secret ${aiSecret}` } },
        completionStatus,
      );
    }
    respond({ message: "Unexpected endpoint" }, 404);
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No fixture server address");
  baseURL = `http://127.0.0.1:${address.port}`;
  vi.stubEnv("GITHUB_API_URL", baseURL);
  await writeFile(
    join(directory, "foliolab.config.json"),
    JSON.stringify({ organization: "acme", endpoint: `${baseURL}/v1` }),
  );
});
afterEach(async () => {
  if (server?.listening) {
    server.closeAllConnections();
    await new Promise<void>((done, reject) =>
      server.close((error) => (error ? reject(error) : done())),
    );
  }
  await rm(directory, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

function environment() {
  // Do not inherit developer credentials or workflow command files into subprocess fixtures.
  return {
    PATH: process.env.PATH,
    HOME: directory,
    GITHUB_API_URL: baseURL,
    GITHUB_TOKEN: githubSecret,
    OPENAI_API_KEY: aiSecret,
    OPENAI_MAX_RETRIES: "0",
  };
}

async function cli(...args: string[]) {
  return exec(
    process.execPath,
    [resolve("node_modules/tsx/dist/cli.mjs"), resolve("scripts/generate-portfolio.ts"), ...args],
    { cwd: directory, env: environment(), timeout: 20000 },
  );
}

async function action(extra: Record<string, string> = {}) {
  const output = join(directory, "action-output");
  const summary = join(directory, "action-summary");
  await writeFile(output, "");
  await writeFile(summary, "");
  const result = await exec(process.execPath, [resolve("action-dist/index.cjs")], {
    cwd: directory,
    env: {
      ...environment(),
      GITHUB_OUTPUT: output,
      GITHUB_STEP_SUMMARY: summary,
      "INPUT_GITHUB-TOKEN": githubSecret,
      "INPUT_OPENAI-API-KEY": aiSecret,
      ...extra,
    },
    timeout: 20000,
  });
  return {
    ...result,
    outputs: await readFile(output, "utf8"),
    summary: await readFile(summary, "utf8"),
  };
}

describe("organization GitHub adapter", () => {
  it("paginates all repositories and never discovers the authenticated user", async () => {
    list = Array.from({ length: 101 }, (_, index) => githubRepo(index + 1));
    const source = createOrganizationSource(githubSecret);
    const result = await source.discover(organizationConfigSchema.parse({ organization: "acme" }));
    expect(result.repositories).toHaveLength(101);
    expect(requests.some((url) => url.includes("page=2"))).toBe(true);
    expect(requests.some((url) => url.includes("type=public"))).toBe(true);
    expect(requests.every((url) => url.startsWith("/orgs/acme"))).toBe(true);
  });

  it("enforces public ownership, filters forks/archives, and gives exclusions precedence", async () => {
    list = Array.from({ length: 6 }, (_, index) => githubRepo(index + 1));
    list[1].fork = true;
    list[2].archived = true;
    list[3].private = true;
    list[4].owner.login = "other-org";
    const source = createOrganizationSource(githubSecret);
    expect(
      (
        await source.discover(organizationConfigSchema.parse({ organization: "acme" }))
      ).repositories.map((repo) => repo.id),
    ).toEqual([1, 6]);
    const filtered = await source.discover(
      organizationConfigSchema.parse({
        organization: "acme",
        includeForks: true,
        includeArchived: true,
        includeRepos: ["PROJECT-1", "project-2", "project-3", "project-4"],
        excludeRepos: ["project-2"],
      }),
    );
    expect(filtered.repositories.map((repo) => repo.id)).toEqual([1, 3]);
  });

  it("fails the entire discovery on a later-page failure", async () => {
    list = Array.from({ length: 101 }, (_, index) => githubRepo(index + 1));
    secondPageStatus = 403;
    await expect(
      createOrganizationSource(githubSecret).discover(
        organizationConfigSchema.parse({ organization: "acme" }),
      ),
    ).rejects.toThrow("Could not fetch all");
  });

  it("uses project structure for a missing README and propagates source failures", async () => {
    const source = createOrganizationSource(githubSecret);
    readmeStatus = 404;
    expect(await source.readme("acme", "project-1")).toBe("");
    const structure = await source.structure("acme", "project-1");
    expect(structure).toContain("A package without a README");
    expect(structure).toContain("React");
    expect(structure).not.toMatch(/Angular|Express|Mobile|Next.js/);
    readmeStatus = 403;
    await expect(source.readme("acme", "project-1")).rejects.toThrow("Could not fetch README");
    structureStatus = 403;
    await expect(source.structure("acme", "project-1")).rejects.toThrow("Could not analyze");
  });
});

describe("CLI and bundled Action", () => {
  it("runs the CLI without a web service and reuses its saved data in the bundled Action", async () => {
    const initial = await cli();
    expect(JSON.parse(initial.stdout)).toMatchObject({ generatedCount: 1, repositoryCount: 1 });
    const first = await readFile(join(directory, "foliolab-data.json"), "utf8");
    expect(completions).toHaveLength(1);
    const result = await action({ "INPUT_OPENAI-API-KEY": "", OPENAI_API_KEY: "" });
    expect(result.outputs).toMatch(/data-changed<<[^\n]+\nfalse\n/);
    expect(result.outputs).toMatch(/generated-count<<[^\n]+\n0\n/);
    expect(result.outputs).toMatch(/reused-count<<[^\n]+\n1\n/);
    expect(result.summary).toContain("Summaries reused");
    expect(completions).toHaveLength(1);
    expect(await readFile(join(directory, "foliolab-data.json"), "utf8")).toBe(first);
    const site = await readFile(join(directory, "_site/index.html"), "utf8");
    expect(site).toContain("ACME Research");
    expect(site).not.toContain("'s Portfolio");
    expect(first + site + result.outputs + result.summary).not.toContain(githubSecret);
    expect(first + site + result.outputs + result.summary).not.toContain(aiSecret);
    expect(site).not.toMatch(/(?:href|src)="\/(?!\/)/);
    expect(requests.some((url) => url.includes("/api/repositories") || url === "/user")).toBe(
      false,
    );
  }, 30000);

  it("supports Action paths, configured model, and forced regeneration", async () => {
    await writeFile(
      join(directory, "custom.json"),
      JSON.stringify({ organization: "acme", model: "fixture-model", endpoint: `${baseURL}/v1` }),
    );
    const inputs = {
      INPUT_CONFIG: "custom.json",
      "INPUT_DATA-FILE": "custom-data.json",
      "INPUT_OUTPUT-DIRECTORY": "public",
    };
    await action(inputs);
    await action({ ...inputs, INPUT_FORCE: "true" });
    expect(completions).toHaveLength(2);
    expect(completions[0].model).toBe("fixture-model");
    expect(await readFile(join(directory, "public/index.html"), "utf8")).toContain(
      "A useful public software project",
    );
  }, 30000);

  it("fails with a nonzero exit and preserves outputs on provider errors without logging secrets", async () => {
    await cli();
    const before = await readFile(join(directory, "foliolab-data.json"), "utf8");
    completionStatus = 401;
    await expect(cli("--force")).rejects.toMatchObject({ code: 1 });
    try {
      await action({ INPUT_FORCE: "true" });
      expect.fail("Expected Action failure");
    } catch (error) {
      expect(error).toMatchObject({ code: 1 });
      const logs =
        `${(error as { stdout: string }).stdout}\n${(error as { stderr: string }).stderr}`
          .split("\n")
          .filter((line) => !line.startsWith("::add-mask::"))
          .join("\n");
      expect(logs).not.toContain(aiSecret);
      expect(logs).not.toContain(githubSecret);
      expect(logs).toContain("Summary generation failed");
    }
    expect(await readFile(join(directory, "foliolab-data.json"), "utf8")).toBe(before);
  }, 30000);

  it.each(["invalid-json", "empty-summary", "truncated", "refusal"])(
    "rejects %s model responses",
    async (failure) => {
      if (failure === "invalid-json") completion.message.content = "invalid";
      if (failure === "empty-summary") completion.message.content = '{"summary":""}';
      if (failure === "truncated") completion.finish_reason = "length";
      if (failure === "refusal") completion.message.refusal = "Cannot comply";
      await expect(cli()).rejects.toMatchObject({ code: 1 });
      await expect(readFile(join(directory, "foliolab-data.json"))).rejects.toMatchObject({
        code: "ENOENT",
      });
    },
    30000,
  );

  it("requires an AI key for uncached work and rejects invalid config without API calls", async () => {
    await expect(action({ "INPUT_OPENAI-API-KEY": "", OPENAI_API_KEY: "" })).rejects.toMatchObject({
      code: 1,
    });
    expect(completions).toHaveLength(0);
    requests = [];
    await writeFile(join(directory, "foliolab.config.json"), '{"organization":"acme","typo":true}');
    await expect(cli()).rejects.toMatchObject({ code: 1 });
    expect(requests).toHaveLength(0);
  }, 30000);
});
