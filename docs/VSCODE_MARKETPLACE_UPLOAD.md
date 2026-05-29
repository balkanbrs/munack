# VS Code Marketplace Upload

## Before upload

1. Update `packages/munack-vscode/package.json`:
   - Replace `publisher` only if you want a Marketplace publisher other than `balkanbrs`.
   - Replace `repository.url` only if the final public GitHub repo differs from `https://github.com/balkanbrs/munack.git`.
   - Update version, display metadata, and keywords as needed.
2. Review `packages/munack-vscode/media/icon.png` and replace the temporary icon if desired.
3. Confirm the bundled extension still builds:

```powershell
npm install
npm run build
npm run package:vsix
```

## Output artifact

- VSIX path: `C:\Users\balka\Desktop\Munack\packages\munack-vscode\dist\munack-0.1.5.vsix`

## Local install test

Install the packaged artifact into VS Code:

```powershell
code --install-extension "C:\Users\balka\Desktop\Munack\packages\munack-vscode\dist\munack-0.1.5.vsix" --force
```

## Marketplace publish flow

1. Sign in with a publisher that owns the chosen `publisher` ID.
2. Run packaging again if you changed metadata:

```powershell
npm run package:vsix
```

3. Publish with VSCE from `packages/munack-vscode`:

```powershell
npx vsce publish
```

4. If you only want to upload an existing artifact:

```powershell
npx vsce publish --packagePath dist/munack-0.1.5.vsix
```

## Notes

- The extension is bundled into `dist/extension.js`, so the VSIX does not rely on the workspace version of `@balkanbrs/munack-core`.
- The package is intended to be compatible with VS Code-compatible editors that support VSIX-based extensions, but only environments actually tested locally should be marked as tested in release notes.
- Open VSX is published separately under `balkanbrs.munack`.
- If `npx vsce publish` fails with PAT authorization, publish the ready `.vsix` from the Marketplace portal instead.
