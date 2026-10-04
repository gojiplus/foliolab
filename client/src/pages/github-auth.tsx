import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { removeGitHubToken, saveGitHubToken } from "@/lib/storage";

function getGithubAuthUrl() {
  const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
  if (!clientId) {
    throw new Error("GitHub Client ID is not configured");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${window.location.origin}/auth/github`,
    scope: "repo,read:user,read:org",
    state: crypto.randomUUID(),
  });

  return `https://github.com/login/oauth/authorize?${params}`;
}

export default function GithubAuth() {
  const [, setLocation] = useLocation();

  const { mutate: authenticate, error: authError } = useMutation({
    mutationFn: async (code: string) => {
      const res = await apiRequest("POST", "/api/fetch-repos", { code });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Authentication failed");
      }

      const data = await res.json();

      // Store GitHub token and username for later use
      if (data.accessToken) {
        saveGitHubToken(data.accessToken);
        localStorage.setItem("github_username", data.username);

        // Initialize repositories in query cache
        queryClient.setQueryData(["/api/repositories"], {
          repositories: data.repositories.map((repo: any) => ({
            ...repo,
            selected: false, // Initialize all repos as unselected
            summary: null, // Initialize all repos without summaries
          })),
        });
      }

      return data;
    },
    onSuccess: () => {
      // Clear the OAuth code after successful authentication
      sessionStorage.removeItem("github_oauth_code");
      setLocation("/repos");
    },
    onError: (error) => {
      console.error("Authentication error:", error);
      // Clear any existing data on error
      queryClient.clear();
      removeGitHubToken();
      localStorage.removeItem("github_username");
    },
  });

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    const error = urlParams.get("error");
    const errorDescription = urlParams.get("error_description");

    if (error) {
      console.error("GitHub OAuth Error:", error, errorDescription);
      return;
    }

    if (code) {
      // Check if this code has already been used
      const usedCode = sessionStorage.getItem("github_oauth_code");
      if (usedCode === code) {
        console.warn("OAuth code already used, redirecting to new auth");
        window.location.href = getGithubAuthUrl();
        return;
      }

      // Store the code to prevent reuse
      sessionStorage.setItem("github_oauth_code", code);

      // Clear any existing data before starting new auth
      queryClient.clear();
      removeGitHubToken();
      localStorage.removeItem("github_username");
      authenticate(code);
    } else {
      // Clear any stored OAuth code when starting fresh
      sessionStorage.removeItem("github_oauth_code");
      window.location.href = getGithubAuthUrl();
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-primary/5 to-primary/10">
      <Card className="w-full max-w-md">
        <CardContent className="p-6">
          {authError ? (
            <div className="space-y-4">
              <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
                  <span className="text-destructive text-xl">⚠</span>
                </div>
                <h2 className="text-lg font-semibold text-destructive mb-2">
                  Authentication Failed
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                  {authError instanceof Error
                    ? authError.message
                    : "An error occurred during authentication"}
                </p>
                <p className="text-xs text-muted-foreground mb-4">
                  This usually happens when the authorization code has expired or been used already.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => (window.location.href = getGithubAuthUrl())}
                  className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                >
                  Try Again
                </button>
                <button
                  onClick={() => setLocation("/")}
                  className="w-full px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 transition-colors"
                >
                  Go Home
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-4 animate-spin" />
              <p>Authenticating with GitHub...</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
