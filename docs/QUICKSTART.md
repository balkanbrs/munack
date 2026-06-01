# Munack Quickstart

## 3-minute evaluation path

### 1. Install the CLI

```powershell
npm install -g munack-cli
```

### 2. Scan a real project

```powershell
munack scan .
```

### 3. Try the adversarial benchmark sample

```powershell
munack scan .\samples\adversarial-polyglot-suite --format markdown
munack scan .\samples\adversarial-namespace-suite --format markdown
```

## What you should see

In the benchmark samples, Munack should:

- surface fake or hallucinated package references as `suspicious`
- confirm real dependencies as `exists`
- avoid uploading source code anywhere

## VS Code-family extension

Install the extension from:

- VS Marketplace
- Open VSX
- local VSIX package

Then run:

- `Munack: Scan Project`
- `Munack: Check Current File`

## CI check

```powershell
munack scan . --fail-on not_found,suspicious
```

## SARIF export

```powershell
munack scan . --format sarif --output .\reports\munack.sarif
```
