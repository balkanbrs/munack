# Munack

Munack is a local-first extension for detecting fake packages, fake imports, fake APIs, fake frameworks, fake dependencies, fake SDK references, and hallucinated package names in AI-generated code.

It helps you verify whether a package, import, or dependency actually exists before bad generated code spreads through your project, your pull request, or your release pipeline.

![Munack Scan Project](media/screenshots/scan-project.png)

## Why developers install Munack

- catch fake packages suggested by AI tools
- catch fake imports before they break builds
- verify dependencies against public registries
- review suspicious package names quickly
- keep source code local while still checking public registries
- work across VS Code, Cursor, Windsurf, VSCodium, Theia, and terminal-heavy workflows

## What Munack detects

- fake package
- fake import
- fake API
- fake framework
- fake dependency
- fake SDK
- hallucinated package

Munack classifies findings as:

- `exists`
- `not_found`
- `suspicious`
- `unknown`

## Overview

### Scan a whole project

Munack scans dependency manifests, lockfiles, and code imports to give AI-generated code a reality check before it wastes your time.

![Munack Project Scan](media/screenshots/scan-project.png)

### Check the current file

Review a single file when you want quick feedback on imports, package names, and suspicious dependencies without leaving the editor.

![Munack Check Current File](media/screenshots/check-current-file.png)

### Activate Free, Pro, or Team

Munack supports a free plan, a Pro plan, and a Team-ready plan model for developers who want unlimited scans and richer export workflows.

![Munack License And Plans](media/screenshots/license-plans.png)

### Works with your editor and your terminal

Use Munack as a VS Code-compatible extension or as a CLI-driven workflow in the editor and terminal setup you already use.

![Munack Works Everywhere](media/screenshots/works-everywhere.png)

## Works With

VS Code-compatible editors:

- VS Code
- Cursor
- Windsurf
- VSCodium
- Theia

CLI-oriented editor workflows:

- JetBrains terminal and external tools
- Visual Studio terminal and external tools
- Sublime Text build systems
- Zed tasks
- Neovim commands
- Emacs shell and compilation flows
- plain terminal workflows

## Target Platforms

Munack is built as a JavaScript extension package and is intended for:

- Windows x64
- Windows arm64
- macOS Intel
- macOS Apple Silicon
- Linux x64
- Linux arm64
- Linux armhf
- Alpine x64
- Alpine arm64

## Commands

- `Munack: Scan Project`
- `Munack: Check Current File`
- `Munack: Activate License`
- `Munack: License Status`

## Public registry coverage

Munack checks package existence against:

- npm
- PyPI
- crates.io
- Packagist

## Privacy and local-first behavior

- your source code is not uploaded
- no AI model is required
- no cloud code analysis is required
- only public package names are checked against public registries
- license state and usage can be cached locally for graceful offline behavior

## Who Munack is for

- developers reviewing AI-generated code
- teams using Copilot, Cursor, Claude Code, ChatGPT, and similar tools
- maintainers who want a quick dependency reality check
- CI and local workflows that need a package existence scanner

## Search-friendly summary

If you are looking for a VS Code extension, Cursor extension, Windsurf extension, VSCodium extension, or Theia-compatible tool to detect fake packages, hallucinated imports, invented dependencies, and suspicious AI-generated code suggestions, Munack is built for that workflow.
