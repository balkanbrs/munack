import assert from "node:assert/strict";
import path from "node:path";
import * as vscode from "vscode";

suite("Munack Extension", () => {
  suiteSetup(function () {
    this.timeout(20000);
  });

  function getMunackExtension(): vscode.Extension<unknown> {
    const match = vscode.extensions.all.find((extension) => extension.packageJSON.name === "munack");
    assert.ok(match, "Munack extension should be available in the extension host.");
    return match;
  }

  test("registers the expected commands", async () => {
    await getMunackExtension().activate();
    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes("munack.scanProject"));
    assert.ok(commands.includes("munack.checkCurrentFile"));
    assert.ok(commands.includes("munack.activateLicense"));
    assert.ok(commands.includes("munack.licenseStatus"));
  });

  test("activates and checks the current file in a real workspace", async function () {
    this.timeout(30000);
    const extension = getMunackExtension();
    await extension.activate();

    const filePath = path.join(vscode.workspace.workspaceFolders![0].uri.fsPath, "index.ts");
    const document = await vscode.workspace.openTextDocument(filePath);
    await vscode.window.showTextDocument(document);

    await vscode.commands.executeCommand("munack.checkCurrentFile");
    await vscode.commands.executeCommand("munack.licenseStatus");

    assert.equal(vscode.window.activeTextEditor?.document.uri.fsPath, filePath);
  });
});
