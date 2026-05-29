# Release Checklist

## Product

1. Run `npm install`
2. Run `npm run build`
3. Run `npm test`
4. Run `npm run package:vsix`
5. Smoke test CLI on a clean sample project

## Metadata

1. Confirm extension `publisher` remains `balkanbrs`
2. Confirm repository URL remains `https://github.com/balkanbrs/munack.git`
3. Review icon and README screenshots if added
4. Update root and extension changelogs

## Licensing

1. Confirm `MUNACK_GUMROAD_PRODUCT_ID`
2. Test `activate`
3. Test `license status`
4. Confirm direct Gumroad verification works without extra env configuration
5. Confirm offline cached paid status still behaves gracefully

## Publish

1. Push to GitHub
2. Confirm CI passes
3. Upload or publish the VSIX
4. Update release notes with actual tested editors
