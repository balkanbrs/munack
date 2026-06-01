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
  "composer.json",
  "composer.lock"
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

const PYTHON_IMPORT_ALIASES = new Map<string, string>([
  ["yaml", "PyYAML"],
  ["pil", "Pillow"],
  ["sklearn", "scikit-learn"],
  ["cv2", "opencv-python"],
  ["crypto", "pycryptodome"],
  ["bs4", "beautifulsoup4"],
  ["fitz", "PyMuPDF"]
]);

interface PhpUseStatement {
  namespace: string;
  filePath: string;
  line: number;
}

function isComposerPlatformPackage(name: string): boolean {
  return (
    name === "php" ||
    name.startsWith("ext-") ||
    name.startsWith("lib-") ||
    name.startsWith("composer-")
  );
}

function canonicalizeRegistryName(name: string, registry: RegistryName): string {
  if (registry === "pypi") {
    const alias = PYTHON_IMPORT_ALIASES.get(name.toLowerCase());
    if (alias) {
      return alias;
    }
    return name.replace(/_/g, "-");
  }

  if (registry === "crates") {
    return name.replace(/_/g, "-");
  }

  return name;
}

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

function toStudlyCase(value: string): string {
  return value
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function collectPhpUseStatements(filePath: string, content: string): PhpUseStatement[] {
  const statements: PhpUseStatement[] = [];

  content.split(/\r?\n/).forEach((line, index) => {
    const match = line.match(/^\s*use\s+(?:function\s+|const\s+)?([^;]+);/);
    if (!match) {
      return;
    }

    const rawImport = match[1].trim();
    const imports = rawImport.includes("{")
      ? (() => {
          const groupedMatch = rawImport.match(/^(.*)\{(.*)\}$/);
          if (!groupedMatch) {
            return [rawImport];
          }

          const prefix = groupedMatch[1].trim().replace(/\\?$/, "\\");
          return groupedMatch[2]
            .split(",")
            .map((part) => `${prefix}${part.trim().split(/\s+as\s+/i)[0]}`);
        })()
      : rawImport.split(",").map((part) => part.trim().split(/\s+as\s+/i)[0]);

    for (const item of imports) {
      const namespace = item.trim().replace(/^\\+/, "");
      if (!namespace) {
        continue;
      }

      statements.push({
        namespace,
        filePath,
        line: index + 1
      });
    }
  });

  return statements;
}

function matchDeclaredPhpPackage(statement: PhpUseStatement, declaredPackageName: string): boolean {
  const [vendor, packageName] = declaredPackageName.split("/");
  if (!vendor || !packageName) {
    return false;
  }

  const segments = statement.namespace.split("\\").filter(Boolean);
  if (segments.length === 0) {
    return false;
  }

  const vendorNamespace = toStudlyCase(vendor);
  const packageNamespace = toStudlyCase(packageName);
  if (segments[0] !== vendorNamespace) {
    return false;
  }

  if (packageNamespace === vendorNamespace) {
    return true;
  }

  return segments.slice(1).some((segment) => segment === packageNamespace);
}

function inferPackagistPackageFromPhpNamespace(statement: PhpUseStatement): string | undefined {
  const segments = statement.namespace.split("\\").filter(Boolean);
  if (segments.length < 2) {
    return undefined;
  }

  const vendor = segments[0].toLowerCase();
  const packageName = segments[1]
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/_/g, "-")
    .toLowerCase();

  if (!vendor || !packageName) {
    return undefined;
  }

  return `${vendor}/${packageName}`;
}

function reconcilePhpUseStatements(
  candidates: Map<string, PackageCandidate>,
  statements: PhpUseStatement[]
): void {
  if (statements.length === 0) {
    return;
  }

  const declaredPackagistCandidates = [...candidates.values()].filter(
    (candidate) =>
      candidate.registry === "packagist" &&
      candidate.sources.some((source) => ["manifest", "lockfile"].includes(source.kind))
  );

  for (const statement of statements) {
    const declaredMatch = declaredPackagistCandidates.find((candidate) =>
      matchDeclaredPhpPackage(statement, candidate.name)
    );

    if (declaredMatch) {
      addCandidate(candidates, declaredMatch.name, "packagist", {
        filePath: statement.filePath,
        kind: "use",
        line: statement.line,
        language: "php"
      });
      continue;
    }

    addCandidate(candidates, inferPackagistPackageFromPhpNamespace(statement), "packagist", {
      filePath: statement.filePath,
      kind: "use",
      line: statement.line,
      language: "php"
    });
  }
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

  if (registry === "packagist" && isComposerPlatformPackage(name)) {
    return;
  }

  const canonicalName = canonicalizeRegistryName(name, registry);
  if (!canonicalName) {
    return;
  }

  const key = `${registry}:${canonicalName}`;
  const existing = map.get(key);
  if (existing) {
    if (
      existing.sources.some(
        (entry) =>
          entry.filePath === source.filePath &&
          entry.kind === source.kind &&
          entry.line === source.line &&
          entry.language === source.language
      )
    ) {
      return;
    }
    existing.sources.push(source);
    return;
  }
  map.set(key, { name: canonicalName, registry, sources: [source] });
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
      addCandidate(candidates, dependency, "packagist", {
        filePath,
        kind: "manifest",
        language: "json"
      });
    }
  }
}

function parseComposerLock(filePath: string, content: string, candidates: Map<string, PackageCandidate>): void {
  const data = JSON.parse(content) as {
    packages?: Array<{ name?: string }>;
    "packages-dev"?: Array<{ name?: string }>;
  };

  for (const section of [data.packages ?? [], data["packages-dev"] ?? []]) {
    for (const dependency of section) {
      addCandidate(candidates, dependency.name, "packagist", {
        filePath,
        kind: "lockfile",
        language: "json"
      });
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
  } else if (fileName === "composer.lock") {
    parseComposerLock(filePath, content, candidates);
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
  const phpUseStatements: PhpUseStatement[] = [];
  for (const filePath of files) {
    try {
      const content = fs.readFileSync(filePath, "utf8");
      parseFile(filePath, candidates, content);
      if (path.extname(filePath) === ".php") {
        phpUseStatements.push(...collectPhpUseStatements(filePath, content));
      }
    } catch {
      continue;
    }
  }

  reconcilePhpUseStatements(candidates, phpUseStatements);

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
