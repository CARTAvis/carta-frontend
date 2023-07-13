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

ESLint is applied to identify program errors and to check the format of imported packages and `tsdoc` documentation.
To run the lint checks:

```
npm run check-eslint
```

To automatically fix the identified errors, particularly those related to import package formats:

```
npm run fix-eslint
```
