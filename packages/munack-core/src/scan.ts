import path from "node:path";
import { loadProjectConfig } from "./config";
import { discoverProjectPackages } from "./discovery";
import { canRunScan, incrementScanUsage, verifyLicense } from "./license";
import { checkRegistry } from "./registry";
import { CheckOptions, PackageCandidate, ScanFinding, ScanOptions, ScanReport } from "./types";

function summarizeReason(candidate: PackageCandidate, result: "exists" | "not_found" | "suspicious" | "unknown"): string {
  if (result === "exists") {
    return `Found in ${candidate.registry}.`;
  }
  if (result === "unknown") {
    return `Registry lookup could not be completed for ${candidate.registry}.`;
  }
  if (candidate.sources.some((source) => ["import", "require", "use"].includes(source.kind))) {
    if (candidate.registry === "pypi") {
      return "Import looks suspicious because the referenced Python module does not resolve on PyPI; some Python imports map to differently named distributions.";
    }
    return "Import looks suspicious because the referenced package does not resolve in the expected registry.";
  }
  return `Declared dependency was not found in ${candidate.registry}.`;
}

function classifyResult(candidate: PackageCandidate, registryResult: Awaited<ReturnType<typeof checkRegistry>>): ScanFinding {
  let result = registryResult.result;

  if (
    registryResult.result === "not_found" &&
    candidate.sources.some((source) => ["import", "require", "use"].includes(source.kind))
  ) {
    result = "suspicious";
  }

  return {
    name: candidate.name,
    registry: candidate.registry,
    result,
    reason: summarizeReason(candidate, result),
    evidence: candidate.sources.map((source) => ({
      filePath: source.filePath,
      kind: source.kind,
      line: source.line,
      language: source.language
    })),
    metadata: {
      registryUrl: registryResult.url,
      statusCode: registryResult.statusCode,
      declaredInManifest: candidate.sources.some((source) => ["manifest", "lockfile", "pyproject", "pipfile"].includes(source.kind)),
      seenInCode: candidate.sources.some((source) => ["import", "require", "use"].includes(source.kind))
    }
  };
}

async function mapWithConcurrency<TInput, TOutput>(
  items: TInput[],
  concurrency: number,
  worker: (item: TInput) => Promise<TOutput>
): Promise<TOutput[]> {
  const results: TOutput[] = new Array(items.length);
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex++;
      results[currentIndex] = await worker(items[currentIndex]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker())
  );

  return results;
}

export async function runScan(options: ScanOptions): Promise<ScanReport> {
  const licenseStatus = await verifyLicense({ fetchImpl: options.fetchImpl });
  const gate = canRunScan(licenseStatus);
  if (!gate.allowed) {
    throw new Error("Free monthly scan limit reached. Activate a paid Munack license to unlock unlimited scans.");
  }

  const projectPath = path.resolve(options.projectPath);
  const projectConfig = loadProjectConfig(projectPath);
  const config = {
    ...projectConfig,
    ...options.config,
    includeCodeImports: options.includeCodeImports ?? options.config?.includeCodeImports ?? projectConfig.includeCodeImports,
    registryTimeoutMs: options.registryTimeoutMs ?? options.config?.registryTimeoutMs ?? projectConfig.registryTimeoutMs,
    registryConcurrency: options.registryConcurrency ?? options.config?.registryConcurrency ?? projectConfig.registryConcurrency
  };
  const discovery = discoverProjectPackages(projectPath, config);
  const findings = await mapWithConcurrency(discovery.candidates, config.registryConcurrency ?? 8, async (candidate) => {
    const registryResult = await checkRegistry(
      candidate.name,
      candidate.registry,
      options.fetchImpl,
      config.registryTimeoutMs
    );
    return classifyResult(candidate, registryResult);
  });

  const remainingFreeScans =
    licenseStatus.active && licenseStatus.plan !== "free"
      ? null
      : Math.max((gate.remainingScans ?? 0) - 1, 0);

  if (!(licenseStatus.active && licenseStatus.plan !== "free")) {
    incrementScanUsage();
  }

  const counts = findings.reduce(
    (accumulator, finding) => {
      accumulator[finding.result] += 1;
      return accumulator;
    },
    {
      exists: 0,
      not_found: 0,
      suspicious: 0,
      unknown: 0
    }
  );

  return {
    summary: {
      projectPath,
      scannedAt: new Date().toISOString(),
      counts,
      filesScanned: discovery.filesScanned,
      candidatesScanned: discovery.candidates.length,
      plan: licenseStatus.plan,
      offlineLicenseCacheUsed: Boolean(licenseStatus.offline),
      remainingFreeScans
    },
    findings: findings.sort((a, b) => {
      const resultOrder = ["not_found", "suspicious", "unknown", "exists"];
      return resultOrder.indexOf(a.result) - resultOrder.indexOf(b.result) || a.name.localeCompare(b.name);
    })
  };
}

export async function checkSinglePackage(options: CheckOptions): Promise<ScanFinding> {
  const registryResult = await checkRegistry(options.name, options.registry, options.fetchImpl);
  return {
    name: options.name,
    registry: options.registry,
    result: registryResult.result,
    reason: registryResult.reason,
    evidence: [],
    metadata: {
      registryUrl: registryResult.url,
      statusCode: registryResult.statusCode
    }
  };
}
