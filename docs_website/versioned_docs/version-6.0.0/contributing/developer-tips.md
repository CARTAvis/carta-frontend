---
sidebar_position: 1
---

# Developer tips

Useful commands for development.

## Checking and fixing code format

To check the code format:

```
npm run checkformat
```

To automatically fix the code format:

```
npm run reformat
```

## Code linting

ESLint is applied to identify program errors and to check for the format of imported packages and TSDoc documentation.
To run the lint checks:

```
npm run check-eslint
```

To automatically fix the identified errors, particularly those related to import package formats:

```
npm run fix-eslint
```

## Git hooks

This repository uses Husky and lint-staged to run checks automatically during commit and push.

- `pre-commit`: runs Prettier on staged files in `src/` (repo root Prettier) and on staged files in `docs_website/` using `docs_website/node_modules/.bin/prettier`, and runs ESLint auto-fix on staged JS/TS files in `src/`.
- `pre-push`: runs `npm run check-eslint` and `npm run checkformat`, and additionally runs `npm --prefix docs_website run checkformat` when pushed commits include `docs_website/` changes.

Hooks are installed automatically when running:

```
npm install
```

If install scripts are skipped (for example, `npm ci --ignore-scripts`), run:

```
npm run prepare
```

If you modify files under `docs_website/`, make sure docs dependencies are installed first:

```
npm --prefix docs_website install
```
