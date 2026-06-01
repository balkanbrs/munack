# munack-cli

`munack-cli` is the command-line interface for Munack.

Use this package if you want the end-user `munack` command in a terminal, CI job, or editor-integrated terminal workflow.

If you want the reusable scanning engine for your own product or extension, use `@balkanbrs/munack-core` instead.

## What it detects

- fake packages
- fake imports
- hallucinated dependencies
- invented SDK references
- slopsquatting risk in AI-generated code workflows

## Good fit for

- CI checks
- terminal-first developer workflows
- editor tasks in JetBrains, Visual Studio, Zed, Neovim, Emacs, and Sublime
- local validation before dependency installation or merge
