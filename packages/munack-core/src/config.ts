import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { LicenseCache, ProjectConfig } from "./types";

const CONFIG_DIR_NAME = ".munack";
const CACHE_FILE_NAME = "state.json";

const DEFAULT_CACHE: LicenseCache = {
  scanUsageByMonth: {}
};

export function getConfigDir(): string {
  const override = process.env.MUNACK_HOME?.trim();
  if (override) {
    return path.resolve(override);
  }
  return path.join(os.homedir(), CONFIG_DIR_NAME);
}

export function getCacheFilePath(): string {
  return path.join(getConfigDir(), CACHE_FILE_NAME);
}

export function ensureConfigDir(): void {
  fs.mkdirSync(getConfigDir(), { recursive: true });
}

export function loadCache(): LicenseCache {
  ensureConfigDir();
  const cacheFile = getCacheFilePath();
  if (!fs.existsSync(cacheFile)) {
    return { ...DEFAULT_CACHE };
  }

  try {
    const raw = fs.readFileSync(cacheFile, "utf8");
    const parsed = JSON.parse(raw) as LicenseCache;
    return {
      ...DEFAULT_CACHE,
      ...parsed,
      scanUsageByMonth: parsed.scanUsageByMonth ?? {}
    };
  } catch {
    return { ...DEFAULT_CACHE };
  }
}

export function saveCache(cache: LicenseCache): void {
  ensureConfigDir();
  fs.writeFileSync(getCacheFilePath(), `${JSON.stringify(cache, null, 2)}\n`, "utf8");
}

export function getCurrentMonthKey(now = new Date()): string {
  return now.toISOString().slice(0, 7);
}

function readJsonFile<T>(filePath: string): T | undefined {
  if (!fs.existsSync(filePath)) {
    return undefined;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return undefined;
  }
}

export function loadProjectConfig(projectPath: string): ProjectConfig {
  const rcConfig = readJsonFile<ProjectConfig>(path.join(projectPath, ".munackrc.json"));
  if (rcConfig) {
    return rcConfig;
  }

  const packageJson = readJsonFile<{ munack?: ProjectConfig }>(path.join(projectPath, "package.json"));
  return packageJson?.munack ?? {};
}
