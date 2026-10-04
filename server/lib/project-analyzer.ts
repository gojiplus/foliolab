import { Octokit } from "@octokit/rest";

export interface ProjectStructure {
  rootFiles: string[];
  directories: string[];
  packageFiles: PackageInfo[];
  configFiles: ConfigInfo[];
  sourceFiles: SourceFileInfo[];
  frameworkIndicators: FrameworkInfo[];
  projectType: string;
  techStack: string[];
}

export interface PackageInfo {
  name: string;
  type:
    | "package.json"
    | "requirements.txt"
    | "Cargo.toml"
    | "go.mod"
    | "pom.xml"
    | "Gemfile"
    | "composer.json";
  dependencies?: string[];
  scripts?: string[];
  description?: string;
}

export interface ConfigInfo {
  name: string;
  type: "config" | "build" | "deployment" | "testing" | "linting";
  framework?: string;
}

export interface SourceFileInfo {
  name: string;
  extension: string;
  language: string;
  isEntryPoint: boolean;
  size?: number;
}

export interface FrameworkInfo {
  framework: string;
  confidence: number;
  indicators: string[];
}

// File patterns for different project types and frameworks
interface FrameworkPattern {
  files: string[];
  dependencies?: string[];
  configs?: string[];
  patterns: string[];
}

const FRAMEWORK_PATTERNS: Record<string, FrameworkPattern> = {
  React: {
    files: ["package.json"],
    dependencies: ["react", "@types/react", "react-dom"],
    configs: ["vite.config.js", "webpack.config.js", "craco.config.js"],
    patterns: ["src/App.jsx", "src/App.tsx", "public/index.html"],
  },
  "Next.js": {
    files: ["package.json", "next.config.js", "next.config.mjs"],
    dependencies: ["next"],
    patterns: ["pages/", "app/", "src/pages/", "src/app/"],
  },
  "Vue.js": {
    files: ["package.json"],
    dependencies: ["vue", "@vue/cli"],
    configs: ["vue.config.js", "vite.config.js"],
    patterns: ["src/App.vue", "src/main.js"],
  },
  Angular: {
    files: ["package.json", "angular.json"],
    dependencies: ["@angular/core", "@angular/cli"],
    patterns: ["src/app/", "src/main.ts"],
  },
  "Express.js": {
    files: ["package.json"],
    dependencies: ["express"],
    patterns: ["server.js", "app.js", "index.js", "src/server.js"],
  },
  Django: {
    files: ["requirements.txt", "manage.py", "pyproject.toml"],
    dependencies: ["django"],
    patterns: ["settings.py", "urls.py", "wsgi.py"],
  },
  Flask: {
    files: ["requirements.txt", "app.py"],
    dependencies: ["flask"],
    patterns: ["app.py", "main.py", "run.py"],
  },
  "Spring Boot": {
    files: ["pom.xml", "build.gradle"],
    dependencies: ["spring-boot"],
    patterns: ["src/main/java/", "Application.java"],
  },
  "Ruby on Rails": {
    files: ["Gemfile", "config/application.rb"],
    dependencies: ["rails"],
    patterns: ["app/", "config/", "db/"],
  },
  Laravel: {
    files: ["composer.json", "artisan"],
    dependencies: ["laravel/framework"],
    patterns: ["app/", "routes/", "resources/"],
  },
  Rust: {
    files: ["Cargo.toml"],
    patterns: ["src/main.rs", "src/lib.rs"],
  },
  Go: {
    files: ["go.mod", "go.sum"],
    patterns: ["main.go", "cmd/", "internal/"],
  },
  Python: {
    files: ["requirements.txt", "setup.py", "pyproject.toml", "Pipfile"],
    patterns: ["main.py", "app.py", "__init__.py"],
  },
  "Mobile App (React Native)": {
    files: ["package.json"],
    dependencies: ["react-native", "@react-native"],
    configs: ["metro.config.js", "react-native.config.js"],
    patterns: ["App.js", "App.tsx", "index.js"],
  },
  "Mobile App (Flutter)": {
    files: ["pubspec.yaml"],
    patterns: ["lib/main.dart", "android/", "ios/"],
  },
  "Desktop App (Electron)": {
    files: ["package.json"],
    dependencies: ["electron"],
    patterns: ["main.js", "src/main/", "public/electron.js"],
  },
};

const ENTRY_POINT_REGEX =
  /main\.js|main\.ts|index\.js|index\.ts|app\.js|app\.ts|server\.js|server\.ts|main\.py|app\.py|main\.go|main\.rs|lib\.rs|main\.java|application\.java/i;

const CONFIG_REGEX =
  /webpack\.config|vite\.config|rollup\.config|babel\.config|eslint|prettier|tsconfig|jest\.config|cypress\.config|docker|nginx\.conf|apache\.conf|\.env|config\.yml|config\.yaml/;

const PACKAGE_FILES = new Set([
  "package.json",
  "requirements.txt",
  "cargo.toml",
  "go.mod",
  "go.sum",
  "pom.xml",
  "build.gradle",
  "gemfile",
  "composer.json",
  "pubspec.yaml",
]);

const SOURCE_EXT_REGEX =
  /\.(?:js|ts|jsx|tsx|py|java|go|rs|rb|php|cpp|c|cs|swift|kt|dart|vue|svelte)$/;

const MAJOR_TECH_REGEX =
  /react|vue|angular|express|django|flask|spring|rails|laravel|mongodb|postgresql|mysql|redis|docker|kubernetes|aws|azure|gcp|firebase|graphql|apollo|prisma|typeorm|sequelize/i;

export async function analyzeProjectStructure(
  accessToken: string,
  owner: string,
  repo: string,
  options: { strict?: boolean; octokit?: Octokit } = {},
): Promise<ProjectStructure> {
  const octokit = options.octokit || new Octokit({ auth: accessToken });

  try {
    // Get repository contents
    const { data: contents } = await octokit.repos.getContent({
      owner,
      repo,
      path: "",
    });

    if (!Array.isArray(contents)) {
      throw new Error("Repository contents is not an array");
    }

    const structure: ProjectStructure = {
      rootFiles: [],
      directories: [],
      packageFiles: [],
      configFiles: [],
      sourceFiles: [],
      frameworkIndicators: [],
      projectType: "Unknown",
      techStack: [],
    };

    // Analyze root level files and directories
    for (const item of contents) {
      if (item.type === "file") {
        structure.rootFiles.push(item.name);
        await analyzeFile(octokit, owner, repo, item, structure, options.strict);
      } else if (item.type === "dir") {
        structure.directories.push(item.name);
      }
    }

    // Detect frameworks and project type
    structure.frameworkIndicators = detectFrameworks(structure);
    structure.projectType = determineProjectType(structure);
    structure.techStack = extractTechStack(structure);

    return structure;
  } catch (error) {
    if (options.strict) throw error;
    console.warn(`Failed to analyze project structure for ${owner}/${repo}:`, error);
    return {
      rootFiles: [],
      directories: [],
      packageFiles: [],
      configFiles: [],
      sourceFiles: [],
      frameworkIndicators: [],
      projectType: "Unknown",
      techStack: [],
    };
  }
}

async function analyzeFile(
  octokit: Octokit,
  owner: string,
  repo: string,
  file: any,
  structure: ProjectStructure,
  strict = false,
): Promise<void> {
  const fileName = file.name.toLowerCase();

  // Analyze package files
  if (isPackageFile(fileName)) {
    try {
      const packageInfo = await analyzePackageFile(octokit, owner, repo, file, strict);
      if (packageInfo) {
        structure.packageFiles.push(packageInfo);
      }
    } catch (error) {
      if (strict) throw error;
      console.warn(`Failed to analyze package file ${file.name}:`, error);
    }
  }

  // Analyze config files
  if (isConfigFile(fileName)) {
    structure.configFiles.push({
      name: file.name,
      type: getConfigType(fileName),
      framework: getConfigFramework(fileName),
    });
  }

  // Analyze source files
  if (isSourceFile(fileName)) {
    structure.sourceFiles.push({
      name: file.name,
      extension: getFileExtension(file.name),
      language: getLanguageFromExtension(getFileExtension(file.name)),
      isEntryPoint: isEntryPoint(file.name),
      size: file.size,
    });
  }
}

async function analyzePackageFile(
  octokit: Octokit,
  owner: string,
  repo: string,
  file: any,
  strict = false,
): Promise<PackageInfo | null> {
  try {
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path: file.name,
      mediaType: { format: "raw" },
    });

    const content = data.toString();
    const fileName = file.name.toLowerCase();

    if (fileName === "package.json") {
      return analyzePackageJson(content);
    } else if (fileName === "requirements.txt") {
      return analyzeRequirementsTxt(content);
    } else if (fileName === "cargo.toml") {
      return analyzeCargoToml(content);
    } else if (fileName === "go.mod") {
      return analyzeGoMod(content);
    }

    return null;
  } catch (error) {
    if (strict) throw error;
    console.warn(`Failed to fetch package file content:`, error);
    return null;
  }
}

function analyzePackageJson(content: string): PackageInfo {
  try {
    const pkg = JSON.parse(content);
    return {
      name: "package.json",
      type: "package.json",
      dependencies: [
        ...Object.keys(pkg.dependencies || {}),
        ...Object.keys(pkg.devDependencies || {}),
      ],
      scripts: Object.keys(pkg.scripts || {}),
      description: pkg.description,
    };
  } catch (_error) {
    return {
      name: "package.json",
      type: "package.json",
      dependencies: [],
      scripts: [],
    };
  }
}

function analyzeRequirementsTxt(content: string): PackageInfo {
  const dependencies = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.split("==")[0].split(">=")[0].split("<=")[0].trim());

  return {
    name: "requirements.txt",
    type: "requirements.txt",
    dependencies,
  };
}

function analyzeCargoToml(content: string): PackageInfo {
  const dependencies: string[] = [];
  const lines = content.split("\n");
  let inDependencies = false;

  for (const line of lines) {
    if (line.trim() === "[dependencies]") {
      inDependencies = true;
      continue;
    }
    if (line.trim().startsWith("[") && line.trim() !== "[dependencies]") {
      inDependencies = false;
      continue;
    }
    if (inDependencies && line.includes("=")) {
      const dep = line.split("=")[0].trim();
      if (dep) dependencies.push(dep);
    }
  }

  return {
    name: "Cargo.toml",
    type: "Cargo.toml",
    dependencies,
  };
}

function analyzeGoMod(content: string): PackageInfo {
  const dependencies: string[] = [];
  const lines = content.split("\n");

  for (const line of lines) {
    if (line.trim().startsWith("require ")) {
      const dep = line.replace("require ", "").trim().split(" ")[0];
      if (dep) dependencies.push(dep);
    }
  }

  return {
    name: "go.mod",
    type: "go.mod",
    dependencies,
  };
}

export function detectFrameworks(structure: ProjectStructure): FrameworkInfo[] {
  const frameworks: FrameworkInfo[] = [];

  const rootFilesSet = new Set(structure.rootFiles);
  const directoriesSet = new Set(structure.directories);

  // Flatten dependencies for faster lookup
  const allDependencies = new Set<string>();
  for (const pkg of structure.packageFiles) {
    if (pkg.dependencies) {
      for (const dep of pkg.dependencies) {
        allDependencies.add(dep);
      }
    }
  }
  const uniqueDependencies = Array.from(allDependencies);

  for (const [frameworkName, patterns] of Object.entries(FRAMEWORK_PATTERNS)) {
    let confidence = 0;
    const indicators: string[] = [];

    // Check for required files
    if (patterns.files) {
      for (const file of patterns.files) {
        if (rootFilesSet.has(file) && !isPackageFile(file.toLowerCase())) {
          confidence += 30;
          indicators.push(`Has ${file}`);
        }
      }
    }

    // Check for dependencies
    if (patterns.dependencies) {
      for (const dep of patterns.dependencies) {
        if (uniqueDependencies.includes(dep)) {
          confidence += 40;
          indicators.push(`Uses ${dep}`);
        }
      }
    }

    // Check for config files
    if (patterns.configs) {
      for (const config of patterns.configs) {
        if (rootFilesSet.has(config)) {
          confidence += 20;
          indicators.push(`Has ${config}`);
        }
      }
    }

    // Check for directory patterns
    if (patterns.patterns) {
      for (const pattern of patterns.patterns) {
        if (pattern.endsWith("/")) {
          // Directory pattern
          const dirName = pattern.slice(0, -1);
          if (directoriesSet.has(dirName)) {
            confidence += 15;
            indicators.push(`Has ${dirName}/ directory`);
          }
        } else {
          // File pattern
          if (rootFilesSet.has(pattern)) {
            confidence += 25;
            indicators.push(`Has ${pattern}`);
          }
        }
      }
    }

    if (confidence > 20) {
      frameworks.push({
        framework: frameworkName,
        confidence,
        indicators,
      });
    }
  }

  return frameworks.sort((a, b) => b.confidence - a.confidence);
}

function determineProjectType(structure: ProjectStructure): string {
  if (structure.frameworkIndicators.length > 0) {
    return structure.frameworkIndicators[0].framework;
  }

  // Fallback to language-based detection
  const languages = structure.sourceFiles.map((f) => f.language);
  const primaryLanguage = getMostCommonLanguage(languages);

  if (primaryLanguage) {
    return `${primaryLanguage} Project`;
  }

  return "Unknown";
}

function extractTechStack(structure: ProjectStructure): string[] {
  const techStack = new Set<string>();

  // Add frameworks
  for (const f of structure.frameworkIndicators) {
    techStack.add(f.framework);
  }

  // Add languages
  structure.sourceFiles.forEach((f) => {
    if (f.language) techStack.add(f.language);
  });

  // Add major dependencies
  structure.packageFiles.forEach((pkg) => {
    if (pkg.dependencies) {
      pkg.dependencies.forEach((dep) => {
        // Add major/well-known dependencies
        if (isMajorTechnology(dep)) {
          techStack.add(dep);
        }
      });
    }
  });

  return Array.from(techStack);
}

function isPackageFile(fileName: string): boolean {
  return PACKAGE_FILES.has(fileName);
}

function isConfigFile(fileName: string): boolean {
  return CONFIG_REGEX.test(fileName);
}

function isSourceFile(fileName: string): boolean {
  return SOURCE_EXT_REGEX.test(fileName);
}

function getConfigType(
  fileName: string,
): "config" | "build" | "deployment" | "testing" | "linting" {
  if (fileName.includes("webpack") || fileName.includes("vite") || fileName.includes("rollup")) {
    return "build";
  }
  if (fileName.includes("docker") || fileName.includes("nginx") || fileName.includes("apache")) {
    return "deployment";
  }
  if (fileName.includes("jest") || fileName.includes("cypress") || fileName.includes("test")) {
    return "testing";
  }
  if (fileName.includes("eslint") || fileName.includes("prettier") || fileName.includes("lint")) {
    return "linting";
  }
  return "config";
}

function getConfigFramework(fileName: string): string | undefined {
  if (fileName.includes("webpack")) return "Webpack";
  if (fileName.includes("vite")) return "Vite";
  if (fileName.includes("rollup")) return "Rollup";
  if (fileName.includes("babel")) return "Babel";
  return undefined;
}

function getFileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  return lastDot > 0 ? fileName.substring(lastDot) : "";
}

function getLanguageFromExtension(extension: string): string {
  const languageMap: Record<string, string> = {
    ".js": "JavaScript",
    ".ts": "TypeScript",
    ".jsx": "React",
    ".tsx": "React",
    ".py": "Python",
    ".java": "Java",
    ".go": "Go",
    ".rs": "Rust",
    ".rb": "Ruby",
    ".php": "PHP",
    ".cpp": "C++",
    ".c": "C",
    ".cs": "C#",
    ".swift": "Swift",
    ".kt": "Kotlin",
    ".dart": "Dart",
    ".vue": "Vue.js",
    ".svelte": "Svelte",
  };
  return languageMap[extension] || extension.substring(1).toUpperCase();
}

function isEntryPoint(fileName: string): boolean {
  return ENTRY_POINT_REGEX.test(fileName);
}

function getMostCommonLanguage(languages: string[]): string | null {
  if (languages.length === 0) return null;

  const counts = languages.reduce(
    (acc, lang) => {
      acc[lang] = (acc[lang] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return Object.entries(counts).sort(([, a], [, b]) => b - a)[0][0];
}

function isMajorTechnology(dependency: string): boolean {
  return MAJOR_TECH_REGEX.test(dependency);
}

export function generateProjectSummary(structure: ProjectStructure): string {
  const parts: string[] = [];

  // Project type and main framework
  if (structure.projectType !== "Unknown") {
    parts.push(`This is a ${structure.projectType} project`);
  }

  // Tech stack
  if (structure.techStack.length > 0) {
    parts.push(`built with ${structure.techStack.slice(0, 5).join(", ")}`);
  }

  // Key features based on structure
  const features: string[] = [];

  if (structure.directories.includes("api") || structure.directories.includes("server")) {
    features.push("backend API");
  }
  if (structure.directories.includes("client") || structure.directories.includes("frontend")) {
    features.push("frontend interface");
  }
  if (
    structure.directories.includes("mobile") ||
    structure.frameworkIndicators.some((f) => f.framework.includes("Mobile"))
  ) {
    features.push("mobile application");
  }
  if (structure.directories.includes("docs") || structure.directories.includes("documentation")) {
    features.push("documentation");
  }
  if (structure.directories.includes("tests") || structure.directories.includes("test")) {
    features.push("test suite");
  }

  if (features.length > 0) {
    parts.push(`featuring ${features.join(", ")}`);
  }

  // Package information
  const mainPackage = structure.packageFiles.find((p) => p.description);
  if (mainPackage?.description) {
    parts.push(`Description: ${mainPackage.description}`);
  }

  return `${parts.join(". ")}.`;
}
