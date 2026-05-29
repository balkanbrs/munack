# Munack Build Report

## What was built

Munack was created as a brand-new standalone project at:

- `C:\Users\balka\Desktop\Munack`

It does not modify or import from `C:\Users\balka\Desktop\Munatrust`.

Implemented deliverables:

- `packages/munack-core`
  - dependency and import discovery
  - public registry existence checks
  - result classification
  - Gumroad license verification
  - optional dedicated license API support via `MUNACK_LICENSE_API_URL`
  - local cached license status
  - free monthly scan counter
  - markdown report generation
  - JSON and SARIF output formatting
  - project config support via `.munackrc.json` or `package.json#munack`
  - registry timeout and concurrency controls
  - Python stdlib filtering to reduce false positives
- `packages/munack-cli`
  - `munack scan`
  - `munack check`
  - `munack doctor`
  - `munack activate`
  - `munack license status`
  - `munack license deactivate`
  - `--format`
  - `--output`
  - `--fail-on`
  - npm-ready package metadata and tarball packaging support
- `packages/munack-vscode`
  - `Munack: Scan Project`
  - `Munack: Check Current File`
  - `Munack: Activate License`
  - `Munack: License Status`
  - output panel integration
  - diagnostics for `not_found` and `suspicious` current-file imports
  - status bar license indicator
  - extension host integration tests
  - packaged VSIX
  - marketplace-ready screenshots and expanded overview copy
  - Open VSX-compatible package identity
- `services/munack-license-api`
  - standalone PHP backend for Gumroad verify
  - optional Gumroad ping intake for shared-hosting deployments
  - Hostinger-friendly file layout
  - health endpoint

## Where the files are

- Workspace root:
  - `C:\Users\balka\Desktop\Munack`
- Core engine:
  - `C:\Users\balka\Desktop\Munack\packages\munack-core`
- CLI:
  - `C:\Users\balka\Desktop\Munack\packages\munack-cli`
- VS Code extension:
  - `C:\Users\balka\Desktop\Munack\packages\munack-vscode`
- VSIX artifact:
  - `C:\Users\balka\Desktop\Munack\packages\munack-vscode\dist\munack-0.1.4.vsix`
- Marketplace upload notes:
  - `C:\Users\balka\Desktop\Munack\docs\VSCODE_MARKETPLACE_UPLOAD.md`
- npm publish notes:
  - `C:\Users\balka\Desktop\Munack\docs\NPM_PUBLISH.md`
- Gumroad architecture notes:
  - `C:\Users\balka\Desktop\Munack\docs\GUMROAD_ARCHITECTURE.md`
- Hostinger deploy notes:
  - `C:\Users\balka\Desktop\Munack\docs\HOSTINGER_DEPLOY.md`
- Optional license backend:
  - `C:\Users\balka\Desktop\Munack\services\munack-license-api`
- Local admin panel:
  - `C:\Users\balka\Desktop\Munack\admin`
- Marketplace screenshots:
  - `C:\Users\balka\Desktop\Munack\packages\munack-vscode\media\screenshots`

## How to run the CLI

From `C:\Users\balka\Desktop\Munack`:

```powershell
npm install
npm run build
node .\packages\munack-cli\dist\index.js scan .
node .\packages\munack-cli\dist\index.js scan .\samples\hallucinated-mixed
node .\packages\munack-cli\dist\index.js scan . --format sarif --fail-on not_found,suspicious
node .\packages\munack-cli\dist\index.js check react --registry npm
node .\packages\munack-cli\dist\index.js doctor
node .\packages\munack-cli\dist\index.js activate YOUR-GUMROAD-LICENSE-KEY
node .\packages\munack-cli\dist\index.js license status
node .\packages\munack-cli\dist\index.js license deactivate
npm run admin
```

## How to install the VSIX

```powershell
code --install-extension "C:\Users\balka\Desktop\Munack\packages\munack-vscode\dist\munack-0.1.4.vsix" --force
```

## What was actually tested

Build and tests:

- `npm install` completed successfully
- `npm run build` completed successfully
- `npm test` completed successfully
- `npm run package:vsix` completed successfully
- `npm pack` completed successfully for `@balkanbrs/munack-core` and `munack-cli`

CLI smoke tests:

- `scan` tested on:
  - `C:\Users\balka\Desktop\Munack\samples\valid-node`
  - `C:\Users\balka\Desktop\Munack\samples\hallucinated-mixed`
- `check react --registry npm` tested successfully
- `doctor` tested successfully
- free scan counter tested with isolated local config
- Gumroad paid activation tested successfully with a valid Munack license key
- JSON and SARIF output tested successfully
- `--fail-on not_found,suspicious` tested successfully and returned exit code `2`

VS Code-compatible extension:

- VSIX packaging tested successfully
- VS Code install tested successfully with:
  - `code --install-extension "C:\Users\balka\Desktop\Munack\packages\munack-vscode\dist\munack-0.1.4.vsix" --force`
- VS Code extension listing confirmed:
  - `balkanbrs.munack@0.1.4`
- VS Code extension host integration tests passed against a real launched VS Code test instance
- Cursor VSIX install tested successfully
- Windsurf VSIX install tested successfully
- VSCodium VSIX install tested successfully
- Theia helper launcher tested successfully
- Theia preload plugin folder generated successfully
- screenshot assets were packaged into the final VSIX

NPM packaging:

- live npm publish completed successfully for:
  - `@balkanbrs/munack-core@0.1.4`
  - `munack-cli@0.1.4`
- npm registry visibility verified for:
  - `npm view @balkanbrs/munack-core version`
  - `npm view munack-cli version`

Open VSX:

- publish update to `balkanbrs.munack@0.1.4` was attempted
- Open VSX returned `503 Service Unavailable` during this run

VS Code Marketplace:

- the new Marketplace-ready VSIX is prepared
- direct publish from this machine was attempted with `vsce`
- publish did not complete because a valid Marketplace PAT is not available in this environment

Admin panel:

- local admin panel server tested successfully on `http://127.0.0.1:8791`
- `/api/health` returned `ok: true`
- `/api/metrics` returned live data for:
  - npm
  - Open VSX
  - Gumroad public product metadata

## Which IDEs were actually tested

- VS Code:
  - installed locally
  - VSIX install tested successfully
- Cursor:
  - installed locally
  - VSIX install tested successfully
- Windsurf:
  - installed locally
  - VSIX install tested successfully
- VSCodium:
  - installed locally
  - VSIX install tested successfully
- Theia:
  - installed locally
  - application launch tested locally
  - CLI-based VSIX install is not exposed by this desktop build
  - helper launcher added for preload-based testing

CLI-oriented editors:

- JetBrains:
  - CLI-targeted support prepared
- Visual Studio:
  - CLI-targeted support prepared
- Sublime Text:
  - CLI-targeted support prepared
- Zed:
  - CLI-targeted support prepared
- Neovim:
  - CLI-targeted support prepared
- Emacs:
  - CLI-targeted support prepared
- Terminal users:
  - CLI tested directly in terminal

## Which IDEs are expected compatible

- VS Code family:
  - VS Code
  - Cursor
  - Windsurf
  - VSCodium
  - Theia
- CLI workflows:
  - JetBrains terminal or external tools
  - Visual Studio terminal or external tools
  - Sublime build systems
  - Zed tasks
  - Neovim commands
  - Emacs shell or compilation workflows
  - plain terminal use

## Gumroad activation flow

Munack reads:

- `MUNACK_GUMROAD_PRODUCT_ID`
- `MUNACK_LICENSE_KEY`
- `MUNACK_LICENSE_API_URL`
- `MUNACK_LICENSE_API_TOKEN`

Default Gumroad product identifier currently embedded from the live product page:

- `qHus0ABlM9o8mhVLxqjVoA==`

Activation behavior:

1. `munack activate YOUR-GUMROAD-LICENSE-KEY` saves the key locally in the Munack config directory.
2. If `MUNACK_LICENSE_API_URL` is configured, Munack sends activation requests to the dedicated Munack backend.
3. Otherwise, Munack sends a verification request directly to Gumroad's license verify API using the built-in Munack product ID.
4. If verification succeeds, Munack caches the active license state locally.
5. If Gumroad is unavailable but a valid paid license was cached earlier, Munack falls back to cached status gracefully.
6. No private Gumroad seller secret is stored or shipped in the codebase.

## Next steps

- publish the ready `0.1.4` VSIX to VS Code Marketplace once a valid Marketplace PAT is available
- retry the Open VSX `0.1.4` update after the upstream `503 Service Unavailable` clears
- optionally replace the current PNG screenshots with final hand-crafted product shots later
- deploy `services/munack-license-api` to a Munack-specific subdomain if a custom license backend is still desired
