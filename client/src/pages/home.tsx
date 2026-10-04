import { Database, FileQuestion, Github, Info, Mail, Shield } from "lucide-react";
import { useEffect } from "react";
import { Link } from "wouter";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { clearAllData } from "@/lib/queryClient";
import { clearStorage } from "@/lib/storage";

export default function Home() {
  // Clear all data when the component mounts
  useEffect(() => {
    clearStorage(); // Clear local storage data
    clearAllData(); // Clear query cache
  }, []);

  // Add clearAllData to the GitHub auth button click
  const handleStartClick = () => {
    clearAllData(); // Clear all data before starting new auth
    clearStorage(); // Clear local storage as well
  };

  return (
    <div className="min-h-screen flex flex-col bg-linear-to-br from-primary/5 to-primary/10">
      {/* Main Content */}
      <main className="flex-1">
        <div className="container mx-auto px-4 py-20">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-6xl font-bold bg-linear-to-r from-primary to-primary/60 bg-clip-text text-transparent mb-6 animate-in fade-in slide-in-from-bottom-4 duration-1000">
              Create Your Developer Portfolio in Minutes
            </h1>
            <p className="text-lg text-muted-foreground mb-12 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-200">
              Build a beautiful portfolio from GitHub, GitLab, Bitbucket, Medium, blogs, and more
            </p>

            <Card className="mb-8">
              <CardContent className="p-6">
                <div className="grid gap-4">
                  <Button
                    asChild
                    size="lg"
                    className="w-full hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl"
                    onClick={handleStartClick}
                  >
                    <Link href="/auth/github" className="flex items-center justify-center gap-2">
                      <Github className="w-5 h-5" />
                      Start with GitHub
                    </Link>
                  </Button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">Or</span>
                    </div>
                  </div>

                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="w-full hover:scale-105 transition-all duration-200 border-2"
                  >
                    <Link href="/select-sources" className="flex items-center justify-center gap-2">
                      <Database className="w-5 h-5" />
                      Add from Other Sources
                    </Link>
                  </Button>

                  <div className="flex items-center gap-2 justify-center text-sm text-muted-foreground">
                    <Info className="w-4 h-4" />
                    <span>GitLab, Bitbucket, Medium, Blog RSS, or custom content</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-8 md:grid-cols-3 mt-20">
              <div className="text-center">
                <h3 className="text-xl font-semibold mb-2">Multiple Sources</h3>
                <p className="text-muted-foreground">
                  Import from GitHub, GitLab, Bitbucket, Medium, blogs, or add custom content
                </p>
              </div>
              <div className="text-center">
                <h3 className="text-xl font-semibold mb-2">AI-Powered Summaries</h3>
                <p className="text-muted-foreground">
                  Get intelligent descriptions generated from your projects and posts
                </p>
              </div>
              <div className="text-center">
                <h3 className="text-xl font-semibold mb-2">Beautiful Design</h3>
                <p className="text-muted-foreground">
                  Your portfolio will look professional and polished automatically
                </p>
              </div>
            </div>

            {/* FAQs Section */}
            <div className="mt-20">
              <h2 className="text-3xl font-bold mb-8">Frequently Asked Questions</h2>
              <div className="grid gap-6 text-left">
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="item-1">
                    <AccordionTrigger className="text-lg font-semibold">
                      How does it work?
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground text-base">
                      Import content from GitHub, GitLab, Bitbucket, Medium, your blog, or add
                      custom content. Select what you want to showcase, and we'll generate beautiful
                      summaries using AI. Deploy your portfolio with one click to GitHub Pages or
                      Vercel.
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="item-2">
                    <AccordionTrigger className="text-lg font-semibold">
                      What sources can I use?
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground text-base">
                      You can import from GitHub (OAuth), GitLab (personal access token), Bitbucket
                      (app password), Medium (username), any blog RSS feed, or create custom
                      free-form content. Mix and match as many sources as you like!
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="item-3">
                    <AccordionTrigger className="text-lg font-semibold">
                      Is it free to use?
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground text-base">
                      FolioLab is open-source and free to use.
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="item-4">
                    <AccordionTrigger className="text-lg font-semibold">
                      What data do you collect?
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground text-base">
                      We don't store any of your data.
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </div>

            <Card className="mt-12 bg-primary/5">
              <CardContent className="p-6">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 mt-1 text-primary" />
                  <div className="text-left">
                    <h3 className="font-semibold mb-2">Privacy First</h3>
                    <p className="text-sm text-muted-foreground">
                      Your data stays completely private. All content from any source is stored only
                      in your browser's local storage. We never store your tokens, credentials, or
                      portfolio data on our servers. Everything is processed client-side.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-white/80 backdrop-blur-md shadow-xs py-6">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center"></div>
            <div className="flex items-center gap-8">
              <a
                href="https://github.com/matmulai/foliolab"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors duration-200"
              >
                <Github className="h-4 w-4" />
                GitHub
              </a>
              <a
                href="https://github.com/matmulai/foliolab/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors duration-200"
              >
                <FileQuestion className="h-4 w-4" />
                FAQs
              </a>
              <a
                href="https://github.com/matmulai/foliolab"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors duration-200"
              >
                <Mail className="h-4 w-4" />
                Contact Developers
              </a>
            </div>
          </div>
          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>
              Made with ❤️ by the{" "}
              <a
                href="https://github.com/matmulai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                MatMul AI
              </a>{" "}
              team
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
