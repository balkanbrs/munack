import * as vscode from "vscode";
import {
  checkSinglePackage,
  discoverFilePackages,
  formatScanReport,
  runScan,
  saveLicenseKey,
  type ScanReport,
  verifyLicense
} from "@balkanbrs/munack-core";

let outputChannel: vscode.OutputChannel;
let diagnostics: vscode.DiagnosticCollection;
let statusBarItem: vscode.StatusBarItem;
let lastReport: ScanReport | undefined;

function getDiagnosticSeverity(result: "not_found" | "suspicious" | "unknown"): vscode.DiagnosticSeverity {
  if (result === "not_found") {
    return vscode.DiagnosticSeverity.Error;
  }
  if (result === "suspicious") {
    return vscode.DiagnosticSeverity.Warning;
  }
  return vscode.DiagnosticSeverity.Information;
}

function createRangeFromEvidence(
  evidence: { line?: number },
  lineText?: string,
  candidateName?: string
): vscode.Range {
  const lineIndex = Math.max((evidence.line ?? 1) - 1, 0);
  if (!lineText) {
    return new vscode.Range(lineIndex, 0, lineIndex, 200);
  }

  const start = candidateName ? Math.max(lineText.indexOf(candidateName), 0) : 0;
  const end = candidateName && lineText.includes(candidateName) ? start + candidateName.length : lineText.length;
  return new vscode.Range(lineIndex, start, lineIndex, Math.max(start + 1, end));
}

function applyReportDiagnostics(report: ScanReport): void {
  const nextDiagnostics = new Map<string, vscode.Diagnostic[]>();

  for (const finding of report.findings) {
    if (finding.result === "exists") {
      continue;
    }

    for (const evidence of finding.evidence) {
      const uri = vscode.Uri.file(evidence.filePath);
      const key = uri.toString();
      const entries = nextDiagnostics.get(key) ?? [];
      entries.push(
        new vscode.Diagnostic(
          createRangeFromEvidence(evidence),
          `${finding.name}: ${finding.reason}`,
          getDiagnosticSeverity(finding.result)
        )
      );
      nextDiagnostics.set(key, entries);
    }
  }

  diagnostics.clear();
  for (const [uriString, entries] of nextDiagnostics.entries()) {
    diagnostics.set(vscode.Uri.parse(uriString), entries);
  }
}

function getOutput(): vscode.OutputChannel {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel("Munack");
  }
  return outputChannel;
}

function appendHeading(title: string): void {
  const output = getOutput();
  output.appendLine("");
  output.appendLine(`=== ${title} ===`);
}

function showOutputText(title: string, text: string, clear = true): void {
  const output = getOutput();
  if (clear) {
    output.clear();
  }
  appendHeading(title);
  output.append(text);
  output.show(true);
}

async function refreshStatusBar(): Promise<void> {
  if (!statusBarItem) {
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = "munack.licenseStatus";
  }

  const status = await verifyLicense({});
  statusBarItem.text = status.active ? `Munack ${status.plan.toUpperCase()}` : "Munack Free";
  statusBarItem.tooltip = status.detail ?? "View Munack license status";
  statusBarItem.show();
}

async function withCommandHandling(action: () => Promise<void>): Promise<void> {
  try {
    await action();
    await refreshStatusBar();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(message);
    getOutput().appendLine(`[error] ${message}`);
    getOutput().show(true);
  }
}

async function runProjectScan(): Promise<void> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    vscode.window.showWarningMessage("Munack needs an open workspace folder to scan.");
    return;
  }

  const projectPath = folders[0].uri.fsPath;
  const report = await runScan({ projectPath });
  lastReport = report;
  applyReportDiagnostics(report);
  showOutputText("Project Scan", formatScanReport(report));
  vscode.window.showInformationMessage("Munack project scan complete.");
}

async function updateDiagnostics(document: vscode.TextDocument): Promise<void> {
  const findings = discoverFilePackages(document.uri.fsPath, document.getText()).candidates;
  const nextDiagnostics: vscode.Diagnostic[] = [];
  const lines = document.getText().split(/\r?\n/);

  const results = await Promise.all(
    findings.map(async (candidate) => ({
      candidate,
      result: await checkSinglePackage({ name: candidate.name, registry: candidate.registry })
    }))
  );

  for (const { candidate, result } of results) {
    if (result.result !== "not_found" && result.result !== "suspicious") {
      continue;
    }

    const primarySource = candidate.sources[0];
    const lineText = lines[Math.max((primarySource?.line ?? 1) - 1, 0)] ?? "";
    nextDiagnostics.push(
      new vscode.Diagnostic(
        createRangeFromEvidence(primarySource ?? {}, lineText, candidate.name),
        `${candidate.name}: ${result.reason}`,
        getDiagnosticSeverity(result.result)
      )
    );
  }

  diagnostics.set(document.uri, nextDiagnostics);
}

async function checkCurrentFile(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage("Open a file first.");
    return;
  }

  diagnostics.delete(editor.document.uri);
  await updateDiagnostics(editor.document);

  const discovered = discoverFilePackages(editor.document.uri.fsPath, editor.document.getText()).candidates;
  const output = getOutput();
  output.clear();
  appendHeading("Current File Check");
  if (discovered.length === 0) {
    output.appendLine("No registry-backed imports found in the current file.");
  } else {
    for (const candidate of discovered) {
      const result = await checkSinglePackage({ name: candidate.name, registry: candidate.registry });
      output.appendLine(`[${result.result}] ${result.name} (${result.registry}) - ${result.reason}`);
    }
  }
  output.show(true);
}

async function activateLicense(): Promise<void> {
  const key = await vscode.window.showInputBox({
    title: "Activate Munack License",
    prompt: "Enter your license key",
    ignoreFocusOut: true,
    password: true
  });

  if (!key) {
    return;
  }

  saveLicenseKey(key.trim());
  const status = await verifyLicense({ licenseKey: key.trim(), forceRefresh: true });
  showOutputText("License Activation", `${JSON.stringify(status, null, 2)}\n`, false);

  if (status.active) {
    vscode.window.showInformationMessage(`Munack ${status.plan} activated.`);
  } else {
    vscode.window.showErrorMessage(status.detail ?? "License activation failed.");
  }
}

async function showLicenseStatus(): Promise<void> {
  const status = await verifyLicense({});
  showOutputText("License Status", `${JSON.stringify(status, null, 2)}\n`);
}

export function activate(context: vscode.ExtensionContext): void {
  diagnostics = vscode.languages.createDiagnosticCollection("munack");
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = "munack.licenseStatus";
  context.subscriptions.push(diagnostics);
  context.subscriptions.push(getOutput());
  context.subscriptions.push(statusBarItem);
  void refreshStatusBar();
  context.subscriptions.push(
    vscode.commands.registerCommand("munack.scanProject", () => withCommandHandling(runProjectScan)),
    vscode.commands.registerCommand("munack.checkCurrentFile", () => withCommandHandling(checkCurrentFile)),
    vscode.commands.registerCommand("munack.activateLicense", () => withCommandHandling(activateLicense)),
    vscode.commands.registerCommand("munack.licenseStatus", () => withCommandHandling(showLicenseStatus)),
    vscode.workspace.onDidSaveTextDocument((document) => {
      void updateDiagnostics(document);
    }),
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        void updateDiagnostics(editor.document);
      }
    })
  );
}

export function deactivate(): void {
  diagnostics?.dispose();
  outputChannel?.dispose();
}
