import fs from "node:fs";
import path from "node:path";
import { ReportFormat, ScanReport } from "./types";

export function formatScanReport(report: ScanReport): string {
  const lines: string[] = [];
  lines.push(`# Munack Scan Report`);
  lines.push("");
  lines.push(`Project: ${report.summary.projectPath}`);
  lines.push(`Scanned At: ${report.summary.scannedAt}`);
  lines.push(`Plan: ${report.summary.plan}`);
  lines.push(`Files Scanned: ${report.summary.filesScanned}`);
  lines.push(`Candidates Scanned: ${report.summary.candidatesScanned}`);
  lines.push(`Offline License Cache Used: ${report.summary.offlineLicenseCacheUsed ? "yes" : "no"}`);
  if (report.summary.remainingFreeScans !== null) {
    lines.push(`Remaining Free Scans This Month: ${report.summary.remainingFreeScans}`);
  }
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- exists: ${report.summary.counts.exists}`);
  lines.push(`- not_found: ${report.summary.counts.not_found}`);
  lines.push(`- suspicious: ${report.summary.counts.suspicious}`);
  lines.push(`- unknown: ${report.summary.counts.unknown}`);
  lines.push("");
  lines.push("## Findings");
  lines.push("");

  if (report.findings.length === 0) {
    lines.push("No registry-backed dependency concerns found.");
  } else {
    for (const finding of report.findings) {
      lines.push(`### ${finding.name} [${finding.registry}]`);
      lines.push(`- Result: ${finding.result}`);
      lines.push(`- Reason: ${finding.reason}`);
      for (const evidence of finding.evidence) {
        const location = evidence.line ? `${evidence.filePath}:${evidence.line}` : evidence.filePath;
        lines.push(`- Evidence: ${location} (${evidence.kind})`);
      }
      lines.push("");
    }
  }

  return `${lines.join("\n").trim()}\n`;
}

export function writeReportToFile(report: ScanReport, outputPath: string): void {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, formatScanReport(report), "utf8");
}

export function formatSarifReport(report: ScanReport): string {
  const sarif = {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "Munack",
            version: "0.1.8",
            rules: [
              {
                id: "munack/not_found",
                shortDescription: { text: "Dependency was not found in the expected registry." }
              },
              {
                id: "munack/suspicious",
                shortDescription: { text: "Import or dependency looks suspicious or hallucinated." }
              },
              {
                id: "munack/unknown",
                shortDescription: { text: "Registry status could not be determined." }
              }
            ]
          }
        },
        results: report.findings
          .filter((finding) => finding.result !== "exists")
          .flatMap((finding) =>
            finding.evidence.map((evidence) => ({
              ruleId: `munack/${finding.result}`,
              level: finding.result === "not_found" ? "error" : finding.result === "suspicious" ? "warning" : "note",
              message: {
                text: `${finding.name} (${finding.registry}): ${finding.reason}`
              },
              locations: [
                {
                  physicalLocation: {
                    artifactLocation: {
                      uri: evidence.filePath
                    },
                    region: evidence.line
                      ? {
                          startLine: evidence.line
                        }
                      : undefined
                  }
                }
              ]
            }))
          )
      }
    ]
  };

  return `${JSON.stringify(sarif, null, 2)}\n`;
}

export function formatReport(report: ScanReport, format: ReportFormat): string {
  if (format === "json") {
    return `${JSON.stringify(report, null, 2)}\n`;
  }
  if (format === "sarif") {
    return formatSarifReport(report);
  }
  return formatScanReport(report);
}

export function writeFormattedReportToFile(report: ScanReport, outputPath: string, format: ReportFormat): void {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, formatReport(report, format), "utf8");
}
