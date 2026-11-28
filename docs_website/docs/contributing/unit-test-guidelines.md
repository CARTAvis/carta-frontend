---
sidebar_position: 3
---

# Unit test guidelines

Guidelines for running and writing unit tests.

## Running unit tests

1. Install package dependencies:

    ```
    npm install
    ```

2. Build carta-protobuf and WebAssembly libraries:

    ```
    npm run build-protobuf

    npm run build-libs
    npm run build-wrappers
    ```

3. Run unit tests:

    ```
    npm test
    ```

    Rstest runs the full suite by default. To run tests from a specific file or directory, pass its path:

    ```
    npm test -- src/utilities/math/math.test.ts
    ```

    Use `npm test -- --help` to see the options supported by the installed Rstest version.

## Writing unit tests

### Structures

- Directory structure: colocate the test file in the same directory and name with `.test.ts/tsx` suffix. For example,
    ```
    .
    └── src
        └── components
            └── AComponent
                ├── AComponent.tsx
                ├── AComponent.scss
                └── AComponent.test.tsx
        └── utilities
            └── math
                ├── math.ts
                └── math.test.ts
    ```
- Test code structure: use `describe` to structure the tests. For example,

    ```javascript
    describe("[unit]", () => {
        test("[expected behavior]", () => {});

        describe("[sub unit]", () => {
            test("[expected behavior]", () => {});
        });
    });
    ```

- Make sure to implement low-level tests that focus on a certain class or function. Mock imported classes and functions with `rs.mock` from `@rstest/core` when necessary.
- TypeScript enum: import TypeScript enum without index files to avoid compile failure.

### Testing periodic work

The backend, telemetry, and application singletons suppress their automatic intervals in the unit-test environment. Call the periodic operation directly when testing its effects.

### Testing React components

- Avoid mocking blueprint.js objects to prevent having complex setups.
- Avoid testing snapshots to prevent having large files in the codebase.
- Follow [the order of priority](https://testing-library.com/docs/queries/about/#priority) suggested by React Testing Library when querying elements.
