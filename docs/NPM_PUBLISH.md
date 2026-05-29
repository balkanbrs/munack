# NPM Publish Notes

Prepared npm packages:

- `C:\Users\balka\Desktop\Munack\packages\munack-core\balkanbrs-munack-core-0.1.4.tgz`
- `C:\Users\balka\Desktop\Munack\packages\munack-cli\munack-cli-0.1.4.tgz`

Registry availability checked:

- `@balkanbrs/munack-core` was prepared for npm publish under the publisher-owned scope
- `munack-cli` was not found on npm at publish-prep time

## Ready commands

From the package folders:

```powershell
npm publish --access public
```

## Current blocker

This machine is not authenticated to npm:

- `npm whoami` returned `ENEEDAUTH`

So the packages were prepared and packed, but live npm publish was not completed in this run.
