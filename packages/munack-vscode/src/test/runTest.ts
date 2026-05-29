import path from "node:path";
import { runTests } from "@vscode/test-electron";

async function main(): Promise<void> {
  const extensionDevelopmentPath = path.resolve(__dirname, "..", "..");
  const extensionTestsPath = path.resolve(__dirname, "suite", "index.js");
  const workspacePath = path.resolve(extensionDevelopmentPath, "..", "..", "samples", "valid-node");

  try {
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [workspacePath, "--disable-extensions"]
    });
  } catch (error) {
    console.error("Failed to run VS Code extension tests.");
    console.error(error);
    process.exit(1);
  }
}

void main();

