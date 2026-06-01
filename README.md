# Munack

Reality check for AI-generated code.

Munack is a deterministic, local-first scanner that looks for potentially hallucinated packages, SDKs, imports, frameworks, and dependencies by comparing what it finds in a project against public package registries.

![Munack Works Everywhere](packages/munack-vscode/media/screenshots/works-everywhere.png)

## Positioning

Munack catches hallucinated packages, fake imports, invented SDK references, and suspicious AI-generated dependencies before they hit production.

Best short positioning:

- `Reality check for AI-generated dependencies`
- `Catch hallucinated packages before they hit production`

## Why this is sellable

- The problem is clear in one sentence.
- The buyer can understand the product in under five minutes.
- The scanner is local-first, privacy-friendly, and easy to justify to engineering teams.
- The product already ships in three useful forms: shared core, CLI, and VS Code-family extension.
- Due diligence is lightweight because the codebase, packaging, licensing flow, and publish channels are visible.

## What a buyer gets

- A standalone GitHub repository: [balkanbrs/munack](https://github.com/balkanbrs/munack)
- A packaged VS Code-compatible extension (`.vsix`)
- Published npm packages for the core engine and CLI
- VS Marketplace and Open VSX distribution setup
- Gumroad activation flow with local license cache behavior
- Buyer docs, benchmark docs, and handoff notes under `docs/`

## Proof

### Before/after positioning

Without Munack, generated code can reference package names that look plausible but do not exist in the expected registry.

With Munack, those references are surfaced as `suspicious` or `not_found` before they silently reach CI, PR review, or production release workflows.

### Registry-backed scope

Munack verifies package existence against:

- `npm`
- `PyPI`
- `crates.io`
- `Packagist`

### Concrete examples in the repo

- [samples/adversarial-polyglot-suite](C:/Users/balka/Desktop/Munack/samples/adversarial-polyglot-suite)
- [samples/adversarial-namespace-suite](C:/Users/balka/Desktop/Munack/samples/adversarial-namespace-suite)

These samples intentionally mix real and hallucinated package references across JavaScript, Python, Rust, and PHP.

### Benchmark and buyer documents

- [docs/BENCHMARKS.md](C:/Users/balka/Desktop/Munack/docs/BENCHMARKS.md)
- [docs/CASE_STUDIES.md](C:/Users/balka/Desktop/Munack/docs/CASE_STUDIES.md)
- [docs/PROOF_GALLERY.md](C:/Users/balka/Desktop/Munack/docs/PROOF_GALLERY.md)
- [docs/ACQUISITION_BRIEF.md](C:/Users/balka/Desktop/Munack/docs/ACQUISITION_BRIEF.md)
- [docs/BUYER_HANDOFF.md](C:/Users/balka/Desktop/Munack/docs/BUYER_HANDOFF.md)
- [docs/REAL_SALE_SCENARIOS.md](C:/Users/balka/Desktop/Munack/docs/REAL_SALE_SCENARIOS.md)
- [docs/OUTBOUND_PLAYBOOK.md](C:/Users/balka/Desktop/Munack/docs/OUTBOUND_PLAYBOOK.md)
- [docs/SALES_ROOM.md](C:/Users/balka/Desktop/Munack/docs/SALES_ROOM.md)
- [docs/COMPETITOR_MATRIX.md](C:/Users/balka/Desktop/Munack/docs/COMPETITOR_MATRIX.md)
- [docs/WHY_NOW.md](C:/Users/balka/Desktop/Munack/docs/WHY_NOW.md)
- [docs/OUTREACH_TEMPLATES.md](C:/Users/balka/Desktop/Munack/docs/OUTREACH_TEMPLATES.md)
- [docs/DILIGENCE_FAQ.md](C:/Users/balka/Desktop/Munack/docs/DILIGENCE_FAQ.md)
- [docs/BUYER_PIPELINE_TEMPLATE.csv](C:/Users/balka/Desktop/Munack/docs/BUYER_PIPELINE_TEMPLATE.csv)
- [docs/TARGET_BUYERS.md](C:/Users/balka/Desktop/Munack/docs/TARGET_BUYERS.md)
- [docs/WAVE1_OUTREACH.md](C:/Users/balka/Desktop/Munack/docs/WAVE1_OUTREACH.md)
- [docs/BUYER_SHORTLIST.csv](C:/Users/balka/Desktop/Munack/docs/BUYER_SHORTLIST.csv)

## What v1 does

- Scans dependency manifests and lockfiles for JavaScript, Python, Rust, and PHP ecosystems
- Scans import statements in JS, TS, Python, Rust, and PHP where the mapping is practical
- Checks existence against `npm`, `PyPI`, `crates.io`, and `Packagist`
- Classifies findings as `exists`, `not_found`, `suspicious`, or `unknown`
- Supports project config via `.munackrc.json` or `package.json#munack`
- Supports `markdown`, `json`, and `sarif` output formats for CLI and CI usage
- Works fully locally except for public registry existence checks
- Never uploads source code or requires any AI/cloud model

## Monorepo layout

- `packages/munack-core` - shared discovery, registry, licensing, caching, and report engine
- `packages/munack-cli` - CLI for terminals and editor-integrated terminals
- `packages/munack-vscode` - VS Code-compatible extension for VS Code family editors
- `docs/` - release and upload documentation
- `services/munack-license-api` - optional standalone PHP backend for Gumroad verify/ping on shared hosting
- `samples/` - sample projects used for smoke testing

## Supported inputs

- `package.json`
- `package-lock.json`
- `pnpm-lock.yaml`
- `yarn.lock`
- `requirements.txt`
- `pyproject.toml`
- `Pipfile`
- `Cargo.toml`
- `composer.json`
- `import` / `require` / `from` / `use` statements in JS, TS, Python, and Rust

## CLI

Build the workspace:

```powershell
npm install
npm run build
```

Run the CLI directly from the repo:

```powershell
node .\packages\munack-cli\dist\index.js scan .
node .\packages\munack-cli\dist\index.js scan .\samples\hallucinated-mixed
node .\packages\munack-cli\dist\index.js scan .\samples\adversarial-polyglot-suite
node .\packages\munack-cli\dist\index.js scan . --format sarif --fail-on not_found,suspicious
node .\packages\munack-cli\dist\index.js check react --registry npm
node .\packages\munack-cli\dist\index.js doctor
node .\packages\munack-cli\dist\index.js activate YOUR-GUMROAD-LICENSE-KEY
node .\packages\munack-cli\dist\index.js license status
node .\packages\munack-cli\dist\index.js license deactivate
```

Optional project config:

```json
{
  "includeCodeImports": true,
  "ignoreDirs": [".cache", "generated"],
  "registryTimeoutMs": 8000,
  "registryConcurrency": 8
}
```

## CI and SARIF

Munack is already set up to fit CI and marketplace-grade release workflows.

- SARIF output is supported from the CLI
- GitHub Actions workflow files already exist in `.github/workflows`
- `--fail-on` can make CI fail on `not_found` and `suspicious`

Example:

```powershell
node .\packages\munack-cli\dist\index.js scan . --format sarif --output .\reports\munack.sarif
node .\packages\munack-cli\dist\index.js scan . --fail-on not_found,suspicious
```

## Licensing

- Free: `5` scans per month
- Pro: `$9/month`, unlimited scans, export report
- Team: `$19/month`, same behavior as Pro in v1 with plan metadata prepared

Munack reads:

- `MUNACK_GUMROAD_PRODUCT_ID`
- `MUNACK_LICENSE_KEY`
- `MUNACK_LICENSE_API_URL`
- `MUNACK_LICENSE_API_TOKEN`
- `MUNACK_HOME`
- `MUNACK_LICENSE_CACHE_TTL_HOURS`
- `MUNACK_REGISTRY_TIMEOUT_MS`

License status and usage are cached locally under the user config directory at `~/.munack/state.json`.
If `MUNACK_LICENSE_API_URL` is set, Munack can verify against a dedicated Munack license backend instead of calling Gumroad directly.
The repo also includes a deployable PHP backend in `services/munack-license-api`.

Current default Gumroad product ID embedded in Munack:

- `qHus0ABlM9o8mhVLxqjVoA==`

## VS Code extension

The extension contributes these commands:

- `Munack: Scan Project`
- `Munack: Check Current File`
- `Munack: Activate License`
- `Munack: License Status`

Build the extension and package a VSIX:

```powershell
npm run test:extension
npm run package:vsix
```

Generated file:

- `packages/munack-vscode/dist/munack-0.1.5.vsix`

Marketplace assets and screenshots live under:

- `packages/munack-vscode/media`
- `packages/munack-vscode/media/screenshots`

Theia helper launcher:

```powershell
.\scripts\launch-theia-with-munack.ps1
```

## Compatibility targets

CLI target users:

- JetBrains
- Visual Studio
- Sublime Text
- Zed
- Neovim
- Emacs
- Terminal users

VS Code-compatible target editors:

- VS Code
- Cursor
- Windsurf
- VSCodium
- Theia

See [docs/VSCODE_MARKETPLACE_UPLOAD.md](C:/Users/balka/Desktop/Munack/docs/VSCODE_MARKETPLACE_UPLOAD.md) and [REPORT.md](C:/Users/balka/Desktop/Munack/REPORT.md) for packaging and local test status.
For Gumroad webhook and activation architecture, see [docs/GUMROAD_ARCHITECTURE.md](C:/Users/balka/Desktop/Munack/docs/GUMROAD_ARCHITECTURE.md).
For shared-hosting deployment notes, see [docs/HOSTINGER_DEPLOY.md](C:/Users/balka/Desktop/Munack/docs/HOSTINGER_DEPLOY.md).
