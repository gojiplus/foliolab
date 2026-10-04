import * as core from "@actions/core";
import { generateOrganization } from "../server/lib/organization-generator.js";

async function run() {
  const githubToken = core.getInput("github-token") || process.env.GITHUB_TOKEN;
  const apiKey = core.getInput("openai-api-key") || process.env.OPENAI_API_KEY;
  if (githubToken) core.setSecret(githubToken);
  if (apiKey) core.setSecret(apiKey);
  const result = await generateOrganization({
    configPath: core.getInput("config") || undefined,
    dataFile: core.getInput("data-file") || undefined,
    outputDirectory: core.getInput("output-directory") || undefined,
    githubToken,
    apiKey,
    force: core.getInput("force") ? core.getBooleanInput("force") : false,
  });
  core.setOutput("data-file", result.dataFile);
  core.setOutput("output-directory", result.outputDirectory);
  core.setOutput("data-changed", result.dataChanged);
  core.setOutput("repository-count", result.repositoryCount);
  core.setOutput("generated-count", result.generatedCount);
  core.setOutput("reused-count", result.reusedCount);
  await core.summary
    .addHeading("FolioLab organization site")
    .addTable([
      ["Repositories", String(result.repositoryCount)],
      ["Summaries generated", String(result.generatedCount)],
      ["Summaries reused", String(result.reusedCount)],
      ["Saved data changed", String(result.dataChanged)],
    ])
    .write();
}

run().catch((error) =>
  core.setFailed(error instanceof Error ? error.message : "Organization generation failed"),
);
