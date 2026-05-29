# @balkanbrs/munack-core

`@balkanbrs/munack-core` is the shared engine behind Munack.

It is built for developers and tool builders who want to detect:

- fake packages
- fake imports
- fake APIs
- fake frameworks
- fake dependencies
- fake SDK references
- hallucinated package names in AI-generated code

The package powers the Munack CLI and the Munack VS Code-compatible extension for VS Code, Cursor, Windsurf, VSCodium, and Theia-style workflows.

## What it does

- discovers dependencies from common manifests and lockfiles
- scans imports in JavaScript, TypeScript, Python, Rust, and related project files
- verifies package existence against public registries such as npm, PyPI, crates.io, and Packagist
- classifies findings as `exists`, `not_found`, `suspicious`, or `unknown`
- supports local-first licensing, cached status, and offline-friendly behavior

## Good fit for

- AI code review tooling
- dependency verification tooling
- CI checks for hallucinated packages
- editor extensions that need package existence checks

Munack is local-first and does not upload source code. Only public package names are checked against public registries.
