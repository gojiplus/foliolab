import { Router } from "express";
import { themes } from "../../shared/themes.js";
import {
  commitPortfolioFiles,
  createPortfolioRepository,
  deployToGitHubPages,
  getGithubUser,
} from "../lib/github.js";
import { generateUserIntroduction } from "../lib/openai.js";
import { generatePortfolioHtml } from "../lib/portfolio-generator.js";
import { safeJsonStringify } from "../lib/security.js";

const router = Router();

router.post("/api/deploy/github", async (req, res) => {
  const { accessToken, downloadOnly, repositories, themeId, introduction, customTitle } = req.body;

  if (!accessToken) {
    return res.status(400).json({ error: "GitHub access token is required" });
  }

  try {
    const user = await getGithubUser(accessToken);
    let userIntroduction = introduction;

    if (!userIntroduction) {
      const serverApiKey = process.env.OPENAI_API_KEY;
      if (!serverApiKey) {
        return res.status(500).json({
          error: "OpenAI API key not configured",
          details: "OPENAI_API_KEY environment variable is required",
        });
      }
      userIntroduction = await generateUserIntroduction(repositories, serverApiKey);
    }

    const theme = themes.find((t) => t.id === themeId) || themes[1];
    const html = generatePortfolioHtml(
      { login: user.username, type: "User" },
      repositories,
      userIntroduction,
      user.avatarUrl,
      theme,
      customTitle,
    );

    if (downloadOnly) {
      return res.json({ html });
    }

    const { repoUrl, wasCreated } = await createPortfolioRepository(accessToken, user.username);
    await commitPortfolioFiles(accessToken, user.username, [
      {
        path: "index.html",
        content: html,
      },
    ]);

    res.json({
      success: true,
      repoUrl,
      wasCreated,
      message: wasCreated
        ? "Repository created and portfolio files added successfully"
        : "Portfolio repository updated successfully",
    });
  } catch (error) {
    console.error("Failed to deploy to GitHub:", error);
    res.status(500).json({
      error: "Failed to deploy to GitHub",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

router.post("/api/deploy/github-pages", async (req, res) => {
  const { accessToken, repositories, themeId, introduction, customTitle } = req.body;

  if (!accessToken) {
    return res.status(400).json({ error: "GitHub access token is required" });
  }

  if (!Array.isArray(repositories) || repositories.length === 0) {
    return res.status(400).json({ error: "No repositories provided for deployment" });
  }

  try {
    const user = await getGithubUser(accessToken);

    let userIntroduction = introduction;

    if (!userIntroduction) {
      const serverApiKey = process.env.OPENAI_API_KEY;
      if (!serverApiKey) {
        return res.status(500).json({
          error: "OpenAI API key not configured",
          details: "OPENAI_API_KEY environment variable is required",
        });
      }
      userIntroduction = await generateUserIntroduction(repositories, serverApiKey);
    }

    const theme = themes.find((t) => t.id === themeId) || themes[1];
    const html = generatePortfolioHtml(
      { login: user.username, type: "User" },
      repositories,
      userIntroduction,
      user.avatarUrl,
      theme,
      customTitle,
    );

    const { url, wasCreated } = await deployToGitHubPages(accessToken, user.username, html);

    res.json({
      success: true,
      url,
      wasCreated,
      message: wasCreated
        ? "GitHub Pages repository created and portfolio deployed successfully"
        : "Portfolio deployed to GitHub Pages successfully",
    });
  } catch (error) {
    console.error("Failed to deploy to GitHub Pages:", error);
    res.status(500).json({
      error: "Failed to deploy to GitHub Pages",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get("/api/deploy/vercel/config", (_req, res) => {
  res.json({
    integrationSlug: "foliolab",
    redirectUri: `${process.env.APP_URL}/api/deploy/vercel/callback`,
  });
});

router.post("/api/deploy/vercel/auth", async (req, res) => {
  const { code } = req.body;

  try {
    const params = new URLSearchParams();
    params.append("client_id", process.env.VERCEL_CLIENT_ID!);
    params.append("client_secret", process.env.VERCEL_CLIENT_SECRET!);
    params.append("code", code);
    params.append("redirect_uri", `${process.env.APP_URL}/api/deploy/vercel/callback`);

    const tokenResponse = await fetch("https://api.vercel.com/v2/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      throw new Error(`Vercel OAuth error: ${tokenData.error_description || tokenData.error}`);
    }

    res.json({
      accessToken: tokenData.access_token,
      teamId: tokenData.team_id,
    });
  } catch (error) {
    console.error("Vercel OAuth error:", error);
    res.status(500).json({
      error: "Failed to authenticate with Vercel",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

router.post("/api/deploy/vercel", async (req, res) => {
  const {
    accessToken,
    teamId,
    username,
    repositories,
    themeId,
    introduction,
    userInfo,
    customTitle,
  } = req.body;

  if (!accessToken || !username) {
    return res.status(400).json({ error: "Vercel access token and username are required" });
  }

  try {
    let userAvatar = null as string | null;
    try {
      if (userInfo?.avatarUrl) {
        userAvatar = userInfo.avatarUrl;
      } else {
        const githubToken = req.headers.authorization?.replace("Bearer ", "");
        if (githubToken) {
          const githubUser = await getGithubUser(githubToken);
          userAvatar = githubUser.avatarUrl;
        }
      }
    } catch (userError) {
      console.warn("Could not fetch user avatar:", userError);
    }

    const theme = themes.find((t) => t.id === themeId) || themes[1];
    const html = generatePortfolioHtml(
      { login: username, type: "User" },
      repositories,
      introduction,
      userAvatar,
      theme,
      customTitle,
    );

    const repoName = `${username}-foliolab`;
    const githubToken = req.headers.authorization?.replace("Bearer ", "");

    if (!githubToken) {
      return res.status(401).json({ error: "GitHub token is required" });
    }

    try {
      const githubUser = await getGithubUser(githubToken);
      if (githubUser.username !== username) {
        throw new Error("GitHub token does not match the provided username");
      }
    } catch (error) {
      console.error("GitHub token validation error:", error);
      return res.status(401).json({
        error: "Invalid GitHub token",
        details: "Please reconnect your GitHub account",
      });
    }

    const { repoUrl } = await createPortfolioRepository(githubToken, username, repoName);

    await commitPortfolioFiles(
      githubToken,
      username,
      [
        {
          path: "index.html",
          content: html,
        },
      ],
      repoName,
    );

    const getProjectResponse = await fetch(`https://api.vercel.com/v9/projects/${repoName}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(teamId ? { "X-Vercel-Team-Id": teamId } : {}),
      },
    });

    let _projectData;
    if (!getProjectResponse.ok) {
      const createProjectResponse = await fetch("https://api.vercel.com/v9/projects", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          ...(teamId ? { "X-Vercel-Team-Id": teamId } : {}),
        },
        body: JSON.stringify({
          name: repoName,
          gitRepository: {
            repo: `${username}/${repoName}`,
            type: "github",
          },
          framework: null,
          buildCommand: null,
          outputDirectory: ".",
        }),
      });

      if (!createProjectResponse.ok) {
        const error = await createProjectResponse.json();
        throw new Error(`Vercel Project error: ${error.error?.message || "Unknown error"}`);
      }
      _projectData = await createProjectResponse.json();
    } else {
      _projectData = await getProjectResponse.json();
    }

    let connectedRepoId;
    try {
      const reposResponse = await fetch(
        `https://api.vercel.com/v1/projects/${repoName}/connected-repositories`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            ...(teamId ? { "X-Vercel-Team-Id": teamId } : {}),
          },
        },
      );

      if (reposResponse.ok) {
        const reposData = await reposResponse.json();
        const connectedRepo = reposData.repositories?.find(
          (repo: any) => repo.url === `https://github.com/${username}/${repoName}`,
        );

        if (connectedRepo?.id) {
          connectedRepoId = connectedRepo.id;
        }
      }
    } catch (error) {
      console.warn("Error getting connected repositories:", error);
    }

    if (!connectedRepoId) {
      try {
        const githubResponse = await fetch(`https://api.github.com/repos/${username}/${repoName}`, {
          headers: {
            Authorization: `token ${githubToken}`,
            Accept: "application/vnd.github.v3+json",
          },
        });

        if (githubResponse.ok) {
          const repoData = await githubResponse.json();
          connectedRepoId = repoData.id.toString();
        } else {
          connectedRepoId = `github-${username}-${repoName}`;
        }
      } catch (githubError) {
        console.error("Failed to get repository from GitHub:", githubError);
        connectedRepoId = `github-${username}-${repoName}`;
      }
    }

    const deploymentResponse = await fetch("https://api.vercel.com/v13/deployments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...(teamId ? { "X-Vercel-Team-Id": teamId } : {}),
      },
      body: JSON.stringify({
        name: repoName,
        project: repoName,
        gitSource: {
          type: "github",
          repo: `${username}/${repoName}`,
          ref: "main",
          repoId: connectedRepoId,
        },
      }),
    });

    if (!deploymentResponse.ok) {
      const error = await deploymentResponse.json();
      throw new Error(`Vercel Deployment error: ${error.error?.message || "Unknown error"}`);
    }

    const deploymentData = await deploymentResponse.json();

    res.json({
      projectId: repoName,
      deploymentId: deploymentData.id,
      url: `https://${repoName}.vercel.app`,
      repoUrl,
    });
  } catch (error) {
    console.error("Failed to deploy to Vercel:", error);
    res.status(500).json({
      error: "Failed to deploy to Vercel",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get("/api/deploy/vercel/status/:deploymentId", async (req, res) => {
  const { deploymentId } = req.params;
  const { accessToken } = req.query as { accessToken?: string };

  if (!accessToken) {
    return res.status(400).json({ error: "Vercel access token is required" });
  }

  try {
    const statusResponse = await fetch(`https://api.vercel.com/v13/deployments/${deploymentId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const statusData = await statusResponse.json();

    if (statusData.error) {
      throw new Error(`Vercel Status error: ${statusData.error.message || "Unknown error"}`);
    }

    res.json({
      ready: statusData.ready,
      state: statusData.state,
      url: statusData.url,
    });
  } catch (error) {
    console.error("Failed to check Vercel deployment status:", error);
    res.status(500).json({
      error: "Failed to check deployment status",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get("/api/deploy/vercel/callback", async (req, res) => {
  const { code, configurationId, teamId } = req.query as Record<string, string>;

  if (!code || !configurationId) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  try {
    const params = new URLSearchParams();
    params.append("client_id", process.env.VERCEL_CLIENT_ID!);
    params.append("client_secret", process.env.VERCEL_CLIENT_SECRET!);
    params.append("code", code as string);
    params.append("redirect_uri", `${process.env.APP_URL}/api/deploy/vercel/callback`);

    const tokenResponse = await fetch("https://api.vercel.com/v2/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      throw new Error(`Vercel OAuth error: ${tokenData.error_description || tokenData.error}`);
    }

    res.send(`
        <!DOCTYPE html>
        <html>
        <body>
          <script>
            window.opener.postMessage(
              ${safeJsonStringify({
                type: "vercel-oauth-success",
                token: tokenData.access_token,
                teamId: teamId || "",
                configurationId: configurationId,
              })},
              window.location.origin
            );
            window.close();
          </script>
          <p>Authorization successful! You can close this window.</p>
        </body>
        </html>
      `);
  } catch (error) {
    console.error("Vercel integration callback error:", error);
    res.status(500).send(`
        <!DOCTYPE html>
        <html>
        <body>
          <script>
            window.opener.postMessage(
              ${safeJsonStringify({
                type: "vercel-oauth-error",
                error: error instanceof Error ? error.message : "Unknown error",
              })},
              window.location.origin
            );
            window.close();
          </script>
          <p>Authorization failed. You can close this window.</p>
        </body>
        </html>
      `);
  }
});

export default router;
