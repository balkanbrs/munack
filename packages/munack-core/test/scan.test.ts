import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { discoverProjectPackages, loadProjectConfig, runScan, verifyLicense } from "../src";

function createTempProject(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "munack-test-"));
  for (const [relativePath, content] of Object.entries(files)) {
    const targetPath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, content, "utf8");
  }
  return root;
}

describe("discoverProjectPackages", () => {
  it("finds manifest dependencies and code imports", () => {
    const root = createTempProject({
      "package.json": JSON.stringify({ dependencies: { react: "^19.0.0" } }, null, 2),
      "src/index.ts": "import express from 'express';\nimport localThing from './local';\n"
    });

    const result = discoverProjectPackages(root);
    const names = result.candidates.map((candidate) => `${candidate.registry}:${candidate.name}`);
    expect(names).toContain("npm:react");
    expect(names).toContain("npm:express");
    expect(names).not.toContain("npm:localThing");
  });

  it("finds python and rust dependencies", () => {
    const root = createTempProject({
      "requirements.txt": "requests==2.32.0\n",
      "main.py": "import requests\nfrom fakercloud import sync\n",
      "Cargo.toml": "[dependencies]\nserde = \"1.0\"\n",
      "src/lib.rs": "use serde::Serialize;\nuse inventedcrate::Thing;\n"
    });

    const result = discoverProjectPackages(root);
    const names = result.candidates.map((candidate) => `${candidate.registry}:${candidate.name}`);
    expect(names).toContain("pypi:requests");
    expect(names).toContain("pypi:fakercloud");
    expect(names).toContain("crates:serde");
    expect(names).toContain("crates:inventedcrate");
  });

  it("skips Python standard library imports", () => {
    const root = createTempProject({
      "main.py": "import os\nfrom json import loads\nimport requests\n"
    });

    const result = discoverProjectPackages(root);
    const names = result.candidates.map((candidate) => `${candidate.registry}:${candidate.name}`);
    expect(names).toContain("pypi:requests");
    expect(names).not.toContain("pypi:os");
    expect(names).not.toContain("pypi:json");
  });
});

describe("project config", () => {
  it("loads .munackrc.json and can disable code imports", async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "munack-home-"));
    process.env.HOME = home;
    process.env.USERPROFILE = home;

    const root = createTempProject({
      ".munackrc.json": JSON.stringify({ includeCodeImports: false }, null, 2),
      "package.json": JSON.stringify({ dependencies: { react: "^19.0.0" } }, null, 2),
      "src/index.ts": "import madeup from 'made-up-sdk';\n"
    });

    expect(loadProjectConfig(root).includeCodeImports).toBe(false);

    const fetchMock: typeof fetch = (async () =>
      ({
        ok: true,
        status: 200
      }) as Response) as typeof fetch;

    const report = await runScan({
      projectPath: root,
      fetchImpl: fetchMock
    });

    expect(report.summary.candidatesScanned).toBe(1);
    expect(report.findings.map((finding) => finding.name)).toEqual(["react"]);
  });
});

describe("runScan", () => {
  beforeEach(() => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "munack-home-"));
    process.env.HOME = home;
    process.env.USERPROFILE = home;
  });

  afterEach(() => {
    delete process.env.MUNACK_GUMROAD_PRODUCT_ID;
    delete process.env.MUNACK_LICENSE_API_URL;
    delete process.env.MUNACK_LICENSE_API_TOKEN;
    delete process.env.MUNACK_LICENSE_KEY;
  });

  it("classifies missing import packages as suspicious", async () => {
    const root = createTempProject({
      "src/app.ts": "import phantomSdk from 'phantom-sdk-real';\n"
    });

    const fetchMock: typeof fetch = (async () =>
      ({
        ok: false,
        status: 404
      }) as Response) as typeof fetch;

    const report = await runScan({
      projectPath: root,
      fetchImpl: fetchMock
    });

    expect(report.findings[0]?.result).toBe("suspicious");
    expect(report.findings[0]?.evidence[0]?.filePath).toContain("app.ts");
  });

  it("uses the custom license API with bearer auth when configured", async () => {
    process.env.MUNACK_GUMROAD_PRODUCT_ID = "gumroad-product-id";
    process.env.MUNACK_LICENSE_API_URL = "https://license.example.com/api/gumroad/verify";
    process.env.MUNACK_LICENSE_API_TOKEN = "secret-token";

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
      ({
        ok: true,
        json: async () => ({
          ok: true,
          active: true,
          plan: "team",
          productName: "Munack Team",
          detail: "Verified via custom license API."
        })
      }) as Response);

    const status = await verifyLicense({
      licenseKey: "munack-license-key",
      forceRefresh: true,
      fetchImpl: fetchMock as typeof fetch
    });

    expect(status.active).toBe(true);
    expect(status.plan).toBe("team");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://license.example.com/api/gumroad/verify");
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toEqual({
      "content-type": "application/json",
      authorization: "Bearer secret-token"
    });
    expect(fetchMock.mock.calls[0]?.[1]?.body).toContain("\"product\":\"munack\"");
    expect(fetchMock.mock.calls[0]?.[1]?.body).toContain("\"productId\":\"gumroad-product-id\"");
  });
});
