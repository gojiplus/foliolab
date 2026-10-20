import type { Repository } from "@shared/schema";
import type { Theme } from "@shared/themes";
import { Download, Globe, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { SiGithub } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { getGitHubToken } from "@/lib/storage";
import { DeploymentOverlay } from "./deployment-overlay";
import { VercelDeploymentOverlay } from "./vercel-deployment-overlay";

interface DeploymentActionsProps {
  onSuccess?: () => void;
  repositories: Repository[];
  userInfo?: {
    username: string;
    avatarUrl: string | null;
  } | null;
  introduction?: {
    introduction: string;
    skills: string[];
    interests: string[];
    customImageUrl?: string;
  } | null;
  theme?: Theme;
  customTitle?: string | null;
}

export function DeploymentActions({
  repositories,
  userInfo,
  introduction,
  theme,
  customTitle,
}: DeploymentActionsProps) {
  const [isCreatingRepo, setIsCreatingRepo] = useState(false);
  const [isDeployingToPages, setIsDeployingToPages] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showVercelDeployment, setShowVercelDeployment] = useState(false);
  const [showDeploymentOverlay, setShowDeploymentOverlay] = useState(false);
  const [deploymentInfo, setDeploymentInfo] = useState<{
    deploymentUrl: string;
    portfolioUrl: string;
    username: string;
  } | null>(null);
  const { toast } = useToast();

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      const res = await apiRequest("POST", "/api/deploy/github", {
        accessToken: getGitHubToken(),
        downloadOnly: true,
        repositories,
        userInfo,
        introduction,
        themeId: theme?.id,
        customTitle,
      });

      if (!res.ok) {
        throw new Error("Failed to generate portfolio");
      }

      const data = await res.json();

      const blob = new Blob([data.html], { type: "text/html" });
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "portfolio.html";
      document.body.appendChild(a);
      a.click();

      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Portfolio Downloaded",
        description: "Your portfolio has been downloaded successfully!",
      });
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to download portfolio. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDeployToPages = async () => {
    try {
      setIsDeployingToPages(true);
      const res = await apiRequest("POST", "/api/deploy/github-pages", {
        accessToken: getGitHubToken(),
        repositories,
        userInfo,
        introduction,
        themeId: theme?.id,
        customTitle,
      });

      if (!res.ok) {
        throw new Error("Failed to deploy to GitHub Pages");
      }

      const data = await res.json();

      if (data.success) {
        const username = localStorage.getItem("github_username");
        if (!username) throw new Error("GitHub username not found");

        setDeploymentInfo({
          deploymentUrl: `https://github.com/${username}/${username}.github.io/blob/main/portfolio.html`,
          portfolioUrl: `https://${username}.github.io/portfolio.html`,
          username,
        });
        setShowDeploymentOverlay(true);
      }

      toast({
        title: data.wasCreated ? "GitHub Pages Created" : "GitHub Pages Updated",
        description: data.message,
      });
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to deploy to GitHub Pages. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeployingToPages(false);
    }
  };

  const handleVercelDeploy = async () => {
    try {
      setIsCreatingRepo(true);

      const githubToken = getGitHubToken();
      if (!githubToken) {
        throw new Error("GitHub token not found. Please reconnect your GitHub account.");
      }

      const configRes = await fetch("/api/deploy/vercel/config");
      if (!configRes.ok) {
        throw new Error("Failed to get Vercel configuration");
      }
      const config = await configRes.json();

      const state = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      localStorage.setItem("vercel_csrf_token", state);
      localStorage.setItem("pending_repositories", JSON.stringify(repositories));

      const params = new URLSearchParams({
        source: "marketplace",
        state,
        next: `${window.location.origin}/api/deploy/vercel/callback`,
      });

      const integrationUrl = `https://vercel.com/integrations/${config.integrationSlug}/new?${params.toString()}`;

      const width = 600;
      const height = 800;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      window.open(
        integrationUrl,
        "Vercel Integration",
        `width=${width},height=${height},left=${left},top=${top}`,
      );
    } catch (error) {
      setIsCreatingRepo(false);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to initiate Vercel deployment. Please try again.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data.type === "vercel-oauth-success") {
        try {
          const username = localStorage.getItem("github_username");
          if (!username) throw new Error("GitHub username not found");

          const savedRepos = localStorage.getItem("pending_repositories");
          if (!savedRepos) throw new Error("No pending repositories found");
          const repositories = JSON.parse(savedRepos);

          localStorage.setItem("vercel_access_token", event.data.token);

          const deployResponse = await apiRequest("POST", "/api/deploy/vercel", {
            accessToken: event.data.token,
            teamId: event.data.teamId,
            username,
            repositories,
            themeId: theme?.id,
            introduction,
            userInfo,
            customTitle,
          });

          if (!deployResponse.ok) {
            throw new Error("Failed to deploy to Vercel");
          }

          const deployData = await deployResponse.json();

          localStorage.setItem("vercel_deployment_url", deployData.url);
          localStorage.setItem("vercel_deployment_id", deployData.deploymentId);

          setShowVercelDeployment(true);

          toast({
            title: "Deployment Started",
            description: "Your portfolio is being deployed to Vercel.",
          });

          localStorage.removeItem("pending_repositories");
          localStorage.removeItem("vercel_csrf_token");
        } catch (error) {
          console.error("Deployment error:", error);
          toast({
            title: "Deployment Error",
            description: error instanceof Error ? error.message : "Failed to deploy to Vercel",
            variant: "destructive",
          });
        } finally {
          setIsCreatingRepo(false);
        }
      } else if (event.data.type === "vercel-oauth-error") {
        toast({
          title: "Authorization Failed",
          description: event.data.error,
          variant: "destructive",
        });
        setIsCreatingRepo(false);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [toast, theme]);

  return (
    <div className="mt-12 flex flex-wrap justify-center gap-4">
      <Button
        onClick={handleDownload}
        disabled={isDownloading}
        variant="outline"
        className="flex items-center gap-2"
      >
        {isDownloading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        Download HTML
      </Button>

      <Button
        onClick={handleDeployToPages}
        disabled={isDeployingToPages}
        variant="outline"
        className="flex items-center gap-2"
      >
        {isDeployingToPages ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Globe className="h-4 w-4" />
        )}
        Deploy to GitHub Pages
      </Button>

      <Button
        onClick={handleVercelDeploy}
        disabled={isCreatingRepo}
        className="flex items-center gap-2"
      >
        {isCreatingRepo ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <SiGithub className="h-4 w-4" />
        )}
        Deploy to Vercel
      </Button>

      {deploymentInfo && (
        <DeploymentOverlay
          open={showDeploymentOverlay}
          onClose={() => setShowDeploymentOverlay(false)}
          deploymentUrl={deploymentInfo.deploymentUrl}
          portfolioUrl={deploymentInfo.portfolioUrl}
          username={deploymentInfo.username}
        />
      )}

      {showVercelDeployment && (
        <VercelDeploymentOverlay
          open={showVercelDeployment}
          onClose={() => setShowVercelDeployment(false)}
          username={localStorage.getItem("github_username") || ""}
        />
      )}
    </div>
  );
}
