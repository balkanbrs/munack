# Munack Benchmarks

## Goal

This document exists to make Munack easier to evaluate, use, and maintain.

It shows the kinds of hallucinated or invented dependency references Munack is designed to catch, using reproducible sample projects inside the repository.

## Benchmark samples

### 1. Adversarial polyglot suite

Path:

- `samples/adversarial-polyglot-suite`

What it stresses:

- npm manifest + import mismatches
- PyPI manifest + import mismatches
- Rust crate manifest + `use` mismatches
- PHP composer manifest/lockfile + `use` mismatches
- mixed real and hallucinated packages in the same project

Expected high-signal findings:

- `@vercel/kv-runtime` -> suspicious
- `@workflowkit/agents` -> suspicious
- `acme/llm-orchestrator` -> suspicious
- `agentmesh-runtime` -> suspicious
- `ghostsync-runtime` -> suspicious
- `litellm-proxy-sdk` -> suspicious
- `phantom-executor` -> suspicious
- `vendor/ghost-sync` -> suspicious

Expected real packages detected as existing:

- `@aws-sdk/client-s3`
- `openai`
- `fastapi`
- `PyYAML`
- `Pillow`
- `scikit-learn`
- `reqwest`
- `serde`
- `symfony/http-client`
- `monolog/monolog`
- `phpunit/phpunit`

### 2. Adversarial namespace suite

Path:

- `samples/adversarial-namespace-suite`

What it stresses:

- grouped PHP `use` syntax
- Python import aliases that differ from distribution names
- manifest-backed real packages mixed with undeclared fake runtime imports

Expected high-signal findings:

- `ghostsync-runtime` -> suspicious
- `vendor/ghost-sync` -> suspicious

Expected real packages detected as existing:

- `beautifulsoup4`
- `PyMuPDF`
- `symfony/http-client`
- `monolog/monolog`

## Why these benchmarks matter

- They reduce "demo-only" risk by giving reproducible proof.
- They document what Munack is already good at.
- They make regression testing easier when the scanner evolves.
- They turn market positioning into something measurable.

See [BENCHMARK_RESULTS.md](C:/Users/balka/Desktop/Munack/docs/BENCHMARK_RESULTS.md) for current observed benchmark summaries.

## Suggested benchmark command

```powershell
node .\packages\munack-cli\dist\index.js scan .\samples\adversarial-polyglot-suite --format json
node .\packages\munack-cli\dist\index.js scan .\samples\adversarial-namespace-suite --format json
```
