import fs from "node:fs";
import path from "node:path";
import module from "node:module";
import YAML from "yaml";
import TOML from "toml";
import { PYTHON_STDLIB } from "./python-stdlib";
import { CandidateSource, DiscoverResult, PackageCandidate, ProjectConfig, RegistryName } from "./types";

const TEXT_FILE_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".py", ".rs", ".php"]);
const MANIFEST_FILES = new Set([
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "requirements.txt",
  "pyproject.toml",
  "Pipfile",
  "Cargo.toml",
  "composer.json"
]);

const JS_BUILTINS = new Set(module.builtinModules.flatMap((entry) => [entry, entry.replace(/^node:/, "")]));
const DEFAULT_IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  ".next",
  ".turbo",
  ".venv",
  "venv",
  "vendor",
  "target",
  ".idea",
  ".pytest_cache",
  ".mypy_cache"
]);

function walkFiles(rootPath: string, config?: ProjectConfig): string[] {
  const results: string[] = [];
  const stack = [rootPath];
  const ignoreDirs = new Set([
    ...DEFAULT_IGNORE_DIRS,
    ...(config?.ignoreDirs ?? [])
  ]);

  while (stack.length > 0) {
    const current = stack.pop()!;
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!ignoreDirs.has(entry.name)) {
          stack.push(fullPath);
        }
        continue;
      }
      results.push(fullPath);
    }
  }

  return results;
}

function normalizeNodeSpecifier(specifier: string): string | undefined {
  if (!specifier || specifier.startsWith(".") || specifier.startsWith("/") || specifier.startsWith("node:")) {
    return undefined;
  }
  if (JS_BUILTINS.has(specifier)) {
    return undefined;
  }
  if (specifier.startsWith("@")) {
    const parts = specifier.split("/");
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : specifier;
  }
  return specifier.split("/")[0];
}

function normalizePythonSpecifier(specifier: string): string | undefined {
  if (!specifier || specifier.startsWith(".")) {
    return undefined;
  }
  const normalized = specifier.split(".")[0].split("[")[0].trim();
  if (!normalized || PYTHON_STDLIB.has(normalized)) {
    return undefined;
  }
  return normalized;
}

function normalizeRustSpecifier(specifier: string): string | undefined {
  if (!specifier || specifier.startsWith("crate::") || specifier.startsWith("self::") || specifier.startsWith("super::")) {
    return undefined;
  }
  return specifier.split("::")[0].trim();
}

function addCandidate(
  map: Map<string, PackageCandidate>,
  name: string | undefined,
  registry: RegistryName,
  source: CandidateSource
): void {
  if (!name) {
    return;
  }

  const key = `${registry}:${name}`;
  const existing = map.get(key);
  if (existing) {
    existing.sources.push(source);
    return;
  }
  map.set(key, { name, registry, sources: [source] });
}

function parsePackageJson(filePath: string, content: string, candidates: Map<string, PackageCandidate>): void {
  const data = JSON.parse(content) as Record<string, Record<string, string>>;
  const dependencySections = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];
  for (const section of dependencySections) {
    for (const dependency of Object.keys(data[section] ?? {})) {
      addCandidate(candidates, dependency, "npm", {
        filePath,
        kind: "manifest",
        language: "json"
      });
    }
  }
}

function parsePackageLock(filePath: string, content: string, candidates: Map<string, PackageCandidate>): void {
  const data = JSON.parse(content) as { packages?: Record<string, { name?: string }>; dependencies?: Record<string, unknown> };
  for (const dependency of Object.keys(data.dependencies ?? {})) {
    addCandidate(candidates, dependency, "npm", {
      filePath,
      kind: "lockfile",
      language: "json"
    });
  }
  for (const pkg of Object.values(data.packages ?? {})) {
    if (pkg.name) {
      addCandidate(candidates, pkg.name, "npm", {
        filePath,
        kind: "lockfile",
        language: "json"
      });
    }
  }
}

function parsePnpmLock(filePath: string, content: string, candidates: Map<string, PackageCandidate>): void {
  const data = YAML.parse(content) as { importers?: Record<string, { dependencies?: Record<string, unknown>; devDependencies?: Record<string, unknown> }> };
  for (const importer of Object.values(data.importers ?? {})) {
    for (const dependency of Object.keys(importer.dependencies ?? {})) {
      addCandidate(candidates, dependency, "npm", {
        filePath,
        kind: "lockfile",
        language: "yaml"
      });
    }
    for (const dependency of Object.keys(importer.devDependencies ?? {})) {
      addCandidate(candidates, dependency, "npm", {
        filePath,
        kind: "lockfile",
        language: "yaml"
      });
    }
  }
}

function parseYarnLock(filePath: string, content: string, candidates: Map<string, PackageCandidate>): void {
  const matches = content.matchAll(/^("?)(@?[^@\s"']+?(?:\/[^@\s"']+?)?)@/gm);
  for (const match of matches) {
    const normalized = normalizeNodeSpecifier(match[2]);
    addCandidate(candidates, normalized, "npm", {
      filePath,
      kind: "lockfile",
      language: "yaml"
    });
  }
}

function parseRequirements(filePath: string, content: string, candidates: Map<string, PackageCandidate>): void {
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith("-")) {
      continue;
    }
    const match = line.match(/^([A-Za-z0-9_.-]+)/);
    addCandidate(candidates, match?.[1], "pypi", {
      filePath,
      kind: "manifest",
      language: "text"
    });
  }
}

function parsePyProject(filePath: string, content: string, candidates: Map<string, PackageCandidate>): void {
  const data = TOML.parse(content) as {
    project?: { dependencies?: string[]; "optional-dependencies"?: Record<string, string[]> };
    tool?: { poetry?: { dependencies?: Record<string, unknown>; group?: Record<string, { dependencies?: Record<string, unknown> }> } };
  };

  for (const dependency of data.project?.dependencies ?? []) {
    const match = dependency.match(/^([A-Za-z0-9_.-]+)/);
    addCandidate(candidates, match?.[1], "pypi", {
      filePath,
      kind: "pyproject",
      language: "toml"
    });
  }

  for (const values of Object.values(data.project?.["optional-dependencies"] ?? {})) {
    for (const dependency of values) {
      const match = dependency.match(/^([A-Za-z0-9_.-]+)/);
      addCandidate(candidates, match?.[1], "pypi", {
        filePath,
        kind: "pyproject",
        language: "toml"
      });
    }
  }

  for (const dependency of Object.keys(data.tool?.poetry?.dependencies ?? {})) {
    if (dependency !== "python") {
      addCandidate(candidates, dependency, "pypi", {
        filePath,
        kind: "pyproject",
        language: "toml"
      });
    }
  }

  for (const group of Object.values(data.tool?.poetry?.group ?? {})) {
    for (const dependency of Object.keys(group.dependencies ?? {})) {
      addCandidate(candidates, dependency, "pypi", {
        filePath,
        kind: "pyproject",
        language: "toml"
      });
    }
  }
}

function parsePipfile(filePath: string, content: string, candidates: Map<string, PackageCandidate>): void {
  const data = TOML.parse(content) as { packages?: Record<string, unknown>; "dev-packages"?: Record<string, unknown> };
  for (const dependency of Object.keys(data.packages ?? {})) {
    addCandidate(candidates, dependency, "pypi", {
      filePath,
      kind: "pipfile",
      language: "toml"
    });
  }
  for (const dependency of Object.keys(data["dev-packages"] ?? {})) {
    addCandidate(candidates, dependency, "pypi", {
      filePath,
      kind: "pipfile",
      language: "toml"
    });
  }
}

function parseCargo(filePath: string, content: string, candidates: Map<string, PackageCandidate>): void {
  const data = TOML.parse(content) as {
    dependencies?: Record<string, unknown>;
    "dev-dependencies"?: Record<string, unknown>;
    "build-dependencies"?: Record<string, unknown>;
  };
  for (const section of ["dependencies", "dev-dependencies", "build-dependencies"] as const) {
    for (const dependency of Object.keys(data[section] ?? {})) {
      addCandidate(candidates, dependency, "crates", {
        filePath,
        kind: "manifest",
        language: "toml"
      });
    }
  }
}

function parseComposer(filePath: string, content: string, candidates: Map<string, PackageCandidate>): void {
  const data = JSON.parse(content) as { require?: Record<string, string>; "require-dev"?: Record<string, string> };
  for (const section of ["require", "require-dev"] as const) {
    for (const dependency of Object.keys(data[section] ?? {})) {
      if (dependency !== "php") {
        addCandidate(candidates, dependency, "packagist", {
          filePath,
          kind: "manifest",
          language: "json"
        });
      }
    }
  }
}

function parseCodeImports(filePath: string, content: string, candidates: Map<string, PackageCandidate>): void {
  const extension = path.extname(filePath);
  const lines = content.split(/\r?\n/);

  if ([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"].includes(extension)) {
    const regex =
      /\b(?:import\s+(?:type\s+)?(?:.+?\s+from\s+)?|export\s+.+?\s+from\s+|require\(|import\()\s*["'`]([^"'`]+)["'`]/g;
    lines.forEach((line, index) => {
      for (const match of line.matchAll(regex)) {
        const normalized = normalizeNodeSpecifier(match[1]);
        addCandidate(candidates, normalized, "npm", {
          filePath,
          kind: line.includes("require(") ? "require" : "import",
          line: index + 1,
          language: extension.replace(".", "")
        });
      }
    });
  }

  if (extension === ".py") {
    lines.forEach((line, index) => {
      const importMatch = line.match(/^\s*import\s+([A-Za-z0-9_.,\s]+)/);
      if (importMatch) {
        for (const chunk of importMatch[1].split(",")) {
          const normalized = normalizePythonSpecifier(chunk.trim().split(/\s+/)[0]);
          addCandidate(candidates, normalized, "pypi", {
            filePath,
            kind: "import",
            line: index + 1,
            language: "python"
          });
        }
      }

      const fromMatch = line.match(/^\s*from\s+([A-Za-z0-9_.]+)\s+import\s+/);
      if (fromMatch) {
        const normalized = normalizePythonSpecifier(fromMatch[1]);
        addCandidate(candidates, normalized, "pypi", {
          filePath,
          kind: "import",
          line: index + 1,
          language: "python"
        });
      }
    });
  }

  if (extension === ".rs") {
    lines.forEach((line, index) => {
      const useMatch = line.match(/^\s*use\s+([A-Za-z0-9_:]+)/);
      if (useMatch) {
        const normalized = normalizeRustSpecifier(useMatch[1]);
        addCandidate(candidates, normalized, "crates", {
          filePath,
          kind: "use",
          line: index + 1,
          language: "rust"
        });
      }
    });
  }
}

function parseFile(filePath: string, candidates: Map<string, PackageCandidate>, contentOverride?: string): void {
  const fileName = path.basename(filePath);
  const extension = path.extname(filePath);
  const content = contentOverride ?? fs.readFileSync(filePath, "utf8");

  if (fileName === "package.json") {
    parsePackageJson(filePath, content, candidates);
  } else if (fileName === "package-lock.json") {
    parsePackageLock(filePath, content, candidates);
  } else if (fileName === "pnpm-lock.yaml") {
    parsePnpmLock(filePath, content, candidates);
  } else if (fileName === "yarn.lock") {
    parseYarnLock(filePath, content, candidates);
  } else if (fileName === "requirements.txt") {
    parseRequirements(filePath, content, candidates);
  } else if (fileName === "pyproject.toml") {
    parsePyProject(filePath, content, candidates);
  } else if (fileName === "Pipfile") {
    parsePipfile(filePath, content, candidates);
  } else if (fileName === "Cargo.toml") {
    parseCargo(filePath, content, candidates);
  } else if (fileName === "composer.json") {
    parseComposer(filePath, content, candidates);
  }

  if (TEXT_FILE_EXTENSIONS.has(extension)) {
    parseCodeImports(filePath, content, candidates);
  }
}

export function discoverProjectPackages(projectPath: string, config?: ProjectConfig): DiscoverResult {
  const files = walkFiles(projectPath, config).filter((filePath) => {
    const fileName = path.basename(filePath);
    return MANIFEST_FILES.has(fileName) || (config?.includeCodeImports !== false && TEXT_FILE_EXTENSIONS.has(path.extname(filePath)));
  });

  const candidates = new Map<string, PackageCandidate>();
  for (const filePath of files) {
    try {
      parseFile(filePath, candidates);
    } catch {
      continue;
    }
  }

  const sortedCandidates = [...candidates.values()]
    .map((candidate) => ({
      ...candidate,
      sources: candidate.sources.sort((a, b) => a.filePath.localeCompare(b.filePath) || (a.line ?? 0) - (b.line ?? 0))
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    filesScanned: files.length,
    candidates: sortedCandidates
  };
}

export function discoverFilePackages(filePath: string, content?: string): DiscoverResult {
  const candidates = new Map<string, PackageCandidate>();
  parseFile(filePath, candidates, content);
  return {
    filesScanned: 1,
    candidates: [...candidates.values()].sort((a, b) => a.name.localeCompare(b.name))
  };
}
