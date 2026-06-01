#!/usr/bin/env node
import path from "node:path";
import { Command } from "commander";
import {
  checkSinglePackage,
  clearStoredLicense,
  formatReport,
  getCachedLicenseState,
  getConfigDir,
  getConfiguredLicenseKey,
  getConfiguredLicenseVerifierToken,
  getConfiguredLicenseVerifierUrl,
  getCurrentMonthKey,
  getFreeMonthlyLimit,
  runScan,
  saveLicenseKey,
  type ReportFormat,
  type RegistryName,
  verifyLicense,
  writeFormattedReportToFile
} from "@balkanbrs/munack-core";

const program = new Command();
const RESULT_TYPES = ["exists", "not_found", "suspicious", "unknown"] as const;

function normalizeFormat(value?: string): ReportFormat {
  if (value === "json" || value === "sarif") {
    return value;
  }
  return "markdown";
}

function shouldFailForResults(
  findings: Array<{ result: string }>,
  failOn?: string
): boolean {
  if (!failOn) {
    return false;
  }

  const targets = new Set(
    failOn
      .split(",")
      .map((part) => part.trim())
      .filter((part): part is (typeof RESULT_TYPES)[number] => RESULT_TYPES.includes(part as (typeof RESULT_TYPES)[number]))
  );

  return findings.some((finding) => targets.has(finding.result as (typeof RESULT_TYPES)[number]));
}

function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function printTable(rows: Array<Record<string, string | number | boolean | null>>): void {
  if (rows.length === 0) {
    process.stdout.write("No rows.\n");
    return;
  }
  const headers = Object.keys(rows[0]);
  const widths = headers.map((header) =>
    Math.max(header.length, ...rows.map((row) => String(row[header] ?? "").length))
  );
  const formatRow = (row: Record<string, string | number | boolean | null>): string =>
    headers.map((header, index) => String(row[header] ?? "").padEnd(widths[index])).join("  ");
  process.stdout.write(`${formatRow(Object.fromEntries(headers.map((header) => [header, header])))}\n`);
  process.stdout.write(`${widths.map((width) => "-".repeat(width)).join("  ")}\n`);
  for (const row of rows) {
    process.stdout.write(`${formatRow(row)}\n`);
  }
}

program.name("munack").description("Reality check for AI-generated code.");

program
  .command("scan")
  .argument("[target]", "Path to scan", ".")
  .option("--format <format>", "Output format: markdown, json, sarif", "markdown")
  .option("--output <file>", "Write report to a file")
  .option("--fail-on <results>", "Exit non-zero if any findings match, e.g. not_found,suspicious")
  .option("--no-imports", "Disable code import scanning and only use manifests/lockfiles")
  .option("--timeout-ms <ms>", "Registry request timeout in milliseconds")
  .option("--concurrency <n>", "Registry lookup concurrency")
  .action(
    async (
      target: string,
      options: {
        format?: string;
        output?: string;
        failOn?: string;
        imports?: boolean;
        timeoutMs?: string;
        concurrency?: string;
      }
    ) => {
    try {
      const report = await runScan({
        projectPath: target,
        includeCodeImports: options.imports,
        registryTimeoutMs: options.timeoutMs ? Number(options.timeoutMs) : undefined,
        registryConcurrency: options.concurrency ? Number(options.concurrency) : undefined
      });
      const licenseStatus = await verifyLicense({});
      const format = normalizeFormat(options.format);

      if (options.output) {
        if (!(licenseStatus.active && licenseStatus.plan !== "free")) {
          throw new Error("Exporting reports requires Pro or Team.");
        }
        const outputPath = path.resolve(options.output);
        writeFormattedReportToFile(report, outputPath, format);
      }

      process.stdout.write(formatReport(report, format));
      if (options.output) {
        process.stdout.write(`Report written to ${path.resolve(options.output)}\n`);
      }
      if (shouldFailForResults(report.findings, options.failOn)) {
        process.exitCode = 2;
      }
    } catch (error) {
      process.stderr.write(`${String(error)}\n`);
      process.exitCode = 1;
    }
  });

program
  .command("check")
  .argument("<packageName>", "Package or dependency name to verify")
  .requiredOption("--registry <registry>", "Registry to query: npm, pypi, crates, packagist")
  .option("--format <format>", "Output format: markdown or json", "markdown")
  .action(async (packageName: string, options: { registry: RegistryName; format?: string }) => {
    try {
      const result = await checkSinglePackage({
        name: packageName,
        registry: options.registry
      });

      if (normalizeFormat(options.format) === "json") {
        printJson(result);
        return;
      }

      printTable([
        {
          package: result.name,
          registry: result.registry,
          result: result.result,
          reason: result.reason
        }
      ]);
    } catch (error) {
      process.stderr.write(`${String(error)}\n`);
      process.exitCode = 1;
    }
  });

program.command("doctor").action(async () => {
  const status = await verifyLicense({});
  const cache = getCachedLicenseState();
  const monthKey = getCurrentMonthKey();
  const used = cache.scanUsageByMonth[monthKey] ?? 0;
  printTable([
    {
      item: "Config directory",
      value: getConfigDir()
    },
    {
      item: "License key configured",
      value: Boolean(getConfiguredLicenseKey() ?? cache.licenseKey)
    },
    {
      item: "External license verifier configured",
      value: Boolean(getConfiguredLicenseVerifierUrl())
    },
    {
      item: "License verifier token configured",
      value: Boolean(getConfiguredLicenseVerifierToken())
    },
    {
      item: "License active",
      value: status.active
    },
    {
      item: "License plan",
      value: status.plan
    },
    {
      item: "License source",
      value: status.source
    },
    {
      item: "Offline cache used",
      value: Boolean(status.offline)
    },
    {
      item: "Free scans used this month",
      value: `${used}/${getFreeMonthlyLimit()}`
    }
  ]);
});

program
  .command("activate")
  .argument("[licenseKey]", "License key")
  .action(async (licenseKey?: string) => {
    const effectiveKey = licenseKey?.trim() || getConfiguredLicenseKey() || getCachedLicenseState().licenseKey;
    if (!effectiveKey) {
      process.stderr.write("Provide a license key argument or set MUNACK_LICENSE_KEY.\n");
      process.exitCode = 1;
      return;
    }

    saveLicenseKey(effectiveKey);
    const status = await verifyLicense({ licenseKey: effectiveKey, forceRefresh: true });
    printJson(status);
    if (!status.active) {
      process.exitCode = 1;
    }
  });

const license = program.command("license").description("License management commands.");

license.command("status").action(async () => {
  const status = await verifyLicense({});
  printJson(status);
});

license.command("deactivate").action(() => {
  clearStoredLicense();
  printJson({
    active: false,
    cleared: true
  });
});

program.parseAsync(process.argv);
