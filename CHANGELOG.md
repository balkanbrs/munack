# Changelog

## 0.1.4

- Added marketplace-ready screenshots, richer overview copy, stronger search metadata, and broader editor compatibility messaging.
- Refreshed npm, Open VSX, and VSIX release assets for the latest Munack brand presentation.

## 0.1.3

- Updated the default Gumroad product ID to the current live Munack product.
- Rebuilt release artifacts for npm, Open VSX, and VS Marketplace readiness.

## 0.1.2

- Re-published the shared core package under `@balkanbrs/munack-core` so npm installation works end-to-end
- Updated `munack-cli` and the extension workspace dependency metadata to use the publishable core package name
- Prepared a corrected npm release after the `@munack/core` scope limitation

## 0.1.1

- Switched paid activation to use the live Munack Gumroad product ID by default
- Renamed the extension activation command to `Munack: Activate License`
- Published the VS Code-compatible extension as `balkanbrs.munack`
- Refreshed release metadata, package identity, and publish documentation
- Kept the optional shared-hosting license backend in the repo without making it a hard runtime dependency

## 0.1.0

- Initial standalone Munack release
- Added core scan engine for npm, PyPI, crates.io, and Packagist
- Added CLI workflows for scan, check, doctor, activation, and license status
- Added VS Code-compatible extension and packaged VSIX
- Added extension integration tests, CI workflows, and Gumroad license caching
