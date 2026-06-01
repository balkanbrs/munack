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

  it("normalizes python import aliases and crate import separators", () => {
    const root = createTempProject({
      "pyproject.toml": "[project]\ndependencies = [\"PyYAML>=6.0\", \"scikit-learn>=1.5\", \"beautifulsoup4>=4.13\", \"PyMuPDF>=1.26\"]\n",
      "service.py": "import yaml\nfrom sklearn.model_selection import train_test_split\nfrom bs4 import BeautifulSoup\nimport fitz\n",
      "Cargo.toml": "[dependencies]\nagentmesh-runtime = \"0.4\"\n",
      "src/lib.rs": "use agentmesh_runtime::Supervisor;\n"
    });

    const result = discoverProjectPackages(root);
    const names = result.candidates.map((candidate) => `${candidate.registry}:${candidate.name}`);
    expect(names).toContain("pypi:PyYAML");
    expect(names).toContain("pypi:scikit-learn");
    expect(names).toContain("pypi:beautifulsoup4");
    expect(names).toContain("pypi:PyMuPDF");
    expect(names).not.toContain("pypi:yaml");
    expect(names).not.toContain("pypi:sklearn");
    expect(names).not.toContain("pypi:bs4");
    expect(names).not.toContain("pypi:fitz");
    expect(names).toContain("crates:agentmesh-runtime");
    expect(names).not.toContain("crates:agentmesh_runtime");
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

  it("parses composer lockfiles and skips composer platform packages", () => {
    const root = createTempProject({
      "composer.json": JSON.stringify(
        {
          require: {
            php: "^8.2",
            "ext-json": "*",
            "composer-plugin-api": "^2.6"
          }
        },
        null,
        2
      ),
      "composer.lock": JSON.stringify(
        {
          packages: [{ name: "symfony/http-client" }],
          "packages-dev": [{ name: "phpunit/phpunit" }]
        },
        null,
        2
      )
    });

    const result = discoverProjectPackages(root);
    const names = result.candidates.map((candidate) => `${candidate.registry}:${candidate.name}`);
    expect(names).toContain("packagist:symfony/http-client");
    expect(names).toContain("packagist:phpunit/phpunit");
    expect(names).not.toContain("packagist:php");
    expect(names).not.toContain("packagist:ext-json");
    expect(names).not.toContain("packagist:composer-plugin-api");
  });

  it("maps php use statements to declared packages and infers undeclared vendor packages", () => {
    const root = createTempProject({
      "composer.json": JSON.stringify(
        {
          require: {
            "symfony/http-client": "^7.3",
            "monolog/monolog": "^3.9"
          }
        },
        null,
        2
      ),
      "public/index.php": `<?php
use Symfony\\Component\\HttpClient\\{HttpClient, MockHttpClient};
use Monolog\\{Logger, Handler\\StreamHandler};
use Vendor\\GhostSync\\{Runtime\\Pipeline, Client as GhostSyncClient};
`
    });

    const result = discoverProjectPackages(root);
    const symfony = result.candidates.find((candidate) => candidate.name === "symfony/http-client");
    const monolog = result.candidates.find((candidate) => candidate.name === "monolog/monolog");
    const inferred = result.candidates.find((candidate) => candidate.name === "vendor/ghost-sync");

    expect(symfony?.sources.some((source) => source.kind === "use" && source.language === "php")).toBe(true);
    expect(monolog?.sources.some((source) => source.kind === "use" && source.language === "php")).toBe(true);
    expect(inferred?.sources.some((source) => source.kind === "use" && source.language === "php")).toBe(true);
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
    delete process.env.MUNACK_LICENSE_VERIFY_URL;
    delete process.env.MUNACK_LICENSE_VERIFY_TOKEN;
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

  it("uses the external license verifier with bearer auth when configured", async () => {
    process.env.MUNACK_LICENSE_VERIFY_URL = "https://license.example.com/api/license/verify";
    process.env.MUNACK_LICENSE_VERIFY_TOKEN = "secret-token";

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
      ({
        ok: true,
        json: async () => ({
          ok: true,
          active: true,
          plan: "team",
          productName: "Munack Team",
          detail: "Verified via external license service."
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
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://license.example.com/api/license/verify");
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toEqual({
      "content-type": "application/json",
      authorization: "Bearer secret-token"
    });
    expect(fetchMock.mock.calls[0]?.[1]?.body).toContain("\"product\":\"munack\"");
    expect(fetchMock.mock.calls[0]?.[1]?.body).toContain("\"licenseKey\":\"munack-license-key\"");
  });
});
