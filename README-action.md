# Organization websites with FolioLab

FolioLab builds a GitHub Pages website from one organization's public repositories. A scheduled Action fetches repository metadata, reuses saved AI summaries, and renders the site directly on the runner. It does not call the hosted FolioLab app or require GitHub OAuth.

## Set up a website

1. Create a website repository, or choose an existing repository whose website you intend to replace. Use `<organization>.github.io` for the organization's root site; project repositories also work.
2. Copy [the configuration](examples/organization-site/foliolab.config.json) to `foliolab.config.json` at the repository root and set `organization`.
3. Copy [the workflow](examples/organization-site/deploy.yml) to `.github/workflows/organization-site.yml`. Replace `REPLACE_WITH_COMMIT_SHA` with the full FolioLab commit containing the Action bundle. Set the workflow's branch if your default branch is not `main`.
4. Add the repository Actions secret `OPENAI_API_KEY`. The standard `GITHUB_TOKEN` reads public repositories and commits generated data; no personal access token is needed for public discovery.
5. In **Settings → Pages**, choose **GitHub Actions** as the publishing source. Repository rules must allow the workflow's generated-data commits. Keep any custom domain configured in Pages settings.
6. Run **Organization website** from the Actions tab. The deployment job links to the published website.

The example runs monthly at 03:17 UTC on the first day, on manual dispatch, and when its configuration or workflow changes. Edit the workflow's cron expression to change the cadence. Scheduled runs use the default branch and may be delayed. GitHub automatically disables schedules in public repositories after 60 days without repository activity; unchanged FolioLab runs do not create keepalive commits. Re-enable the workflow if that happens. [GitHub scheduling documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)

The Action builds files. The caller's workflow commits data and deploys through GitHub's official Pages actions. Runs are serialized, and a failed generation or rejected data commit prevents deployment. The example never force-pushes. [GitHub Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

## Configuration

```json
{
  "organization": "acme",
  "theme": "modern",
  "title": "ACME open source",
  "introduction": "Tools from our research and engineering teams.",
  "includeRepos": [],
  "excludeRepos": ["acme.github.io"],
  "includeForks": false,
  "includeArchived": false,
  "model": "gpt-4o"
}
```

Only `organization` is required. Personal accounts and multiple organizations are outside this Action's scope. Private repositories are never included, regardless of the token's permissions.

| Field | Default and behavior |
| --- | --- |
| `organization` | Required GitHub organization login. |
| `includeRepos` | Empty means all eligible repositories. Otherwise use exact repository names, without an owner prefix. Names are case-insensitive. |
| `excludeRepos` | Repository names to omit. Exclusions win over inclusions. |
| `includeForks` | `false`; set `true` to make forks eligible. |
| `includeArchived` | `false`; set `true` to make archived repositories eligible. |
| `theme` | `modern`; also supports `minimal` and `elegant`. |
| `title` | Organization display name, falling back to its login. |
| `introduction` | Organization description. Use an empty string to hide it. |
| `model` | `OPENAI_API_MODEL`, then FolioLab's default (`gpt-4o`). |
| `endpoint` | `OPENAI_API_BASE_URL`, then `https://api.openai.com/v1`. Optional base URL for a compatible Chat Completions provider. Credentials belong in secrets, not this URL. |

A configured model must support FolioLab's Chat Completions JSON mode and generation parameters. Configured model/endpoint values override environment variables. Unknown configuration fields, themes, malformed data, and an empty repository selection fail the run.

## Saved data and updates

`foliolab-data.json` is the durable data layer. Commit it in the website repository and let subsequent runs read it. It contains a schema version, organization profile, repository metadata, summaries, and content fingerprints. The file contains no credentials or raw README content; summaries and repository information are public.

Each run refreshes metadata and sorts projects by stars, then name. Summary fingerprints cover the cleaned source text actually sent to the model, descriptive metadata, model, endpoint, and prompt/settings. Stars and update timestamps do not enter the prompt. A change to those metrics, the theme, or the website introduction does not regenerate summaries. README evidence is capped at 6,000 characters after cleaning; changes outside that input do not invalidate a summary. Projects without a usable README use FolioLab's project-structure analysis.

New or changed projects need the AI key. An unchanged run can reuse its saved summaries without one. Select **force** during manual dispatch to regenerate everything. Regeneration incurs provider usage charges; deleting the data file also discards reusable summaries. The Action does not impose a monetary spending limit.

Repositories that disappear, become private, or no longer pass the filters are removed after a successful complete fetch. Fetch failures, invalid AI responses, and schema errors fail the run before generated outputs are replaced. The previously deployed website remains available. Do not share one data file between different organizations.

The output directory contains `index.html`, `.nojekyll`, and `portfolio.json`. The public JSON uses the same repository records without generation fingerprints. Keep this directory dedicated to generated output and outside the configuration/data paths. FolioLab rejects symlinked output directories and directories containing unrelated files. FolioLab's existing renderer loads Tailwind and icons from external CDNs, so viewing the styled page requires those resources.

## Action interface

Use `gojiplus/foliolab@<full-commit-sha>` with these inputs:

| Input | Default |
| --- | --- |
| `config` | `foliolab.config.json` |
| `data-file` | `foliolab-data.json` |
| `output-directory` | `_site` |
| `github-token` | `${{ github.token }}` |
| `openai-api-key` | Falls back to `OPENAI_API_KEY` in the environment. |
| `force` | `false` |

Paths are relative to the caller's working directory. Configuration and saved data must be separate files outside the generated site directory. If you change the data/output paths, also update the workflow's commit and Pages upload steps.

Outputs are `data-file`, `output-directory` (absolute paths), `data-changed` (`true`/`false`), `repository-count`, `generated-count`, and `reused-count`. The Action writes those counts to the workflow summary. It runs on Node 24 and ships its dependencies in a committed bundle; the consuming workflow does not install Node packages.

## Run locally

In a FolioLab checkout with Node 24:

```bash
npm ci
npm run generate:org -- --config /path/to/website/foliolab.config.json \
  --data-file /path/to/website/foliolab-data.json \
  --output-directory /path/to/website/_site
```

Set `GITHUB_TOKEN` and, when generating summaries, `OPENAI_API_KEY` in the environment. Add `--force` to regenerate all summaries. The CLI writes the same files as the Action, prints paths/counts as JSON, and exits nonzero on failure. Neither the CLI nor the Action starts Express.

## Development checks

```bash
npm run lint
npm run check
npm run build
npm run build:action
npm run test:run
npm run check:action
```

The integration tests run the actual CLI and Action bundle against local fake GitHub and AI servers; they need loopback access but no API keys or paid requests. Rebuild and commit `action-dist/index.cjs` whenever its source changes. CI rejects a bundle that differs from the checked-in source build.

This feature does not migrate existing generator consumers or reproduce generator's old JSON format. MatmulAI's existing workflow and generator remain separate until that migration is undertaken.
