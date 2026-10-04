import { Github } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export function Header() {
  return (
    <header className="border-b bg-white/80 backdrop-blur-md shadow-xs">
      <div
        className="container mx-auto px-6 flex items-center justify-between"
        style={{ height: "100px" }}
      >
        <Link href="/">
          <div className="flex items-center group py-2 cursor-pointer">
            <img
              src="/logo.svg"
              alt="FolioLab Logo"
              className="h-13 group-hover:scale-105 transition-all duration-200 drop-shadow-xs"
            />
          </div>
        </Link>
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-2 hover:bg-primary/5 transition-colors duration-200"
          asChild
        >
          <a href="https://github.com/matmulai/foliolab" target="_blank" rel="noopener noreferrer">
            <Github className="h-4 w-4" />
            View on GitHub
          </a>
        </Button>
      </div>
    </header>
  );
}
