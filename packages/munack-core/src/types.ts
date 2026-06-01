export type RegistryName = "npm" | "pypi" | "crates" | "packagist";

export type ResultType = "exists" | "not_found" | "suspicious" | "unknown";

export type SourceKind =
  | "manifest"
  | "lockfile"
  | "import"
  | "require"
  | "use"
  | "pyproject"
  | "pipfile";

export interface CandidateSource {
  filePath: string;
  kind: SourceKind;
  line?: number;
  language?: string;
}

export interface PackageCandidate {
  name: string;
  registry: RegistryName;
  sources: CandidateSource[];
}

export interface CandidateEvidence {
  filePath: string;
  kind: SourceKind;
  line?: number;
  language?: string;
}

export interface ScanFinding {
  name: string;
  registry: RegistryName;
  result: ResultType;
  reason: string;
  evidence: CandidateEvidence[];
  metadata: Record<string, unknown>;
}

export interface ScanSummary {
  projectPath: string;
  scannedAt: string;
  counts: Record<ResultType, number>;
  filesScanned: number;
  candidatesScanned: number;
  plan: LicensePlan;
  offlineLicenseCacheUsed: boolean;
  remainingFreeScans: number | null;
}

export interface ScanReport {
  summary: ScanSummary;
  findings: ScanFinding[];
}

export interface RegistryCheckResult {
  result: ResultType;
  reason: string;
  statusCode?: number;
  url: string;
  metadata?: Record<string, unknown>;
}

export type LicensePlan = "free" | "pro" | "team";

export interface LicenseStatus {
  active: boolean;
  plan: LicensePlan;
  source: "free" | "env" | "cache" | "external";
  checkedAt?: string;
  offline?: boolean;
  licenseKeyLast4?: string;
  productName?: string;
  detail?: string;
}

export interface LicenseCache {
  licenseKey?: string;
  productId?: string;
  licenseStatus?: LicenseStatus;
  scanUsageByMonth: Record<string, number>;
}

export interface ProjectConfig {
  includeCodeImports?: boolean;
  ignoreDirs?: string[];
  registryTimeoutMs?: number;
  registryConcurrency?: number;
}

export interface ScanOptions {
  projectPath: string;
  includeCodeImports?: boolean;
  fetchImpl?: typeof fetch;
  registryTimeoutMs?: number;
  registryConcurrency?: number;
  config?: ProjectConfig;
}

export interface CheckOptions {
  name: string;
  registry: RegistryName;
  fetchImpl?: typeof fetch;
}

export interface DiscoverResult {
  filesScanned: number;
  candidates: PackageCandidate[];
}

export type ReportFormat = "markdown" | "json" | "sarif";
