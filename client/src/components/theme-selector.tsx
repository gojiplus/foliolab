import { themes } from "@shared/themes";
import { Check } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface ThemeSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
}

export function ThemeSelector({ value, onValueChange }: ThemeSelectorProps) {
  const selectedTheme = themes.find((t) => t.id === value) || themes[1]; // Default to modern if not found

  // Helper function to get theme preview class
  const getThemePreviewClass = (themeId: string) => {
    return `theme-preview-${themeId}`;
  };

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-[320px] h-[80px] p-2">
        <SelectValue>
          {value && (
            <div className="flex items-center gap-4 w-full">
              <div
                className={cn(
                  "w-10 h-10 rounded-md overflow-hidden shrink-0",
                  getThemePreviewClass(selectedTheme.id),
                )}
              >
                <div
                  className="h-5 w-full"
                  style={{
                    background:
                      "linear-gradient(45deg, var(--primary) 0%, var(--primary-foreground) 100%)",
                  }}
                />
                <div className="h-5 w-full accent" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate text-base">{selectedTheme.name}</p>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {selectedTheme.description}
                </p>
              </div>
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="w-[320px] max-h-[400px]">
        {themes.map((theme) => (
          <SelectItem key={theme.id} value={theme.id} className="relative flex items-center py-4">
            <div className="flex items-center gap-4 w-full">
              <div
                className={cn(
                  "w-10 h-10 rounded-md overflow-hidden shrink-0",
                  getThemePreviewClass(theme.id),
                )}
              >
                <div
                  className="h-5 w-full"
                  style={{
                    background:
                      "linear-gradient(45deg, var(--primary) 0%, var(--primary-foreground) 100%)",
                  }}
                />
                <div className="h-5 w-full accent" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate text-base">{theme.name}</p>
                <p className="text-sm text-muted-foreground line-clamp-2">{theme.description}</p>
              </div>
              {value === theme.id && <Check className="h-5 w-5 text-primary shrink-0 ml-2" />}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
