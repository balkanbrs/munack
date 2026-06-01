# Why Munack Exists

AI coding tools are useful, but they still make one stubborn class of mistake:

They suggest dependency names, imports, or SDK references that look real and plausible, but do not actually exist in the expected registry.

That creates a workflow problem and a security problem:

- developers waste time checking whether AI-generated imports are real
- fake package names can slip into commits, CI, or release branches
- attackers can register convincing names on public registries in slopsquatting-style supply-chain attacks

Munack exists to give teams a local-first reality check before that happens.

## What Munack does

- scans manifests and lockfiles
- scans imports where the mapping is practical
- checks names against public registries
- classifies what it finds as `exists`, `suspicious`, `not_found`, or `unknown`

## Why local-first matters

Munack does not require uploading source code to a cloud service.

It only verifies public package names against public registries like:

- npm
- PyPI
- crates.io
- Packagist

## What makes Munack useful

- clear problem statement
- easy CLI usage
- VS Code-family extension support
- reproducible benchmark samples
- CI and SARIF support

## Quick proof

Try:

```powershell
npm install -g munack-cli
munack scan .\samples\adversarial-polyglot-suite
munack scan .\samples\adversarial-namespace-suite
```

Then compare the output with:

- [BENCHMARKS.md](C:/Users/balka/Desktop/Munack/docs/BENCHMARKS.md)
- [BENCHMARK_RESULTS.md](C:/Users/balka/Desktop/Munack/docs/BENCHMARK_RESULTS.md)
