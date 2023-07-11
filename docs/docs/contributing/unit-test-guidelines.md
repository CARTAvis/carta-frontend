---
sidebar_position: 2
---

# Unit Test Guidelines

Guidelines for running and writing unit tests.

## Running unit tests

1. Installing package dependencies:

    ```
    npm install
    ```

2. Building carta-protobuf and WebAssembly libraries:

    ```
    npm run build-protobuf
    npm run build-wrappers
    ```

3. Running unit tests:

    ```
    npm test
    ```

    By default, Jest runs tests related to changed files.

    To display individual test results, use the `--verbose` flag:

    ```
    npm test --verbose
    ```

    For more options available in Jest, please refer to the [Jest documentation](https://jestjs.io/docs/cli).

## Writing unit tests

### Structures

-   Directory structure: colocate the test file in the same directory and name with `.test.ts/tsx` suffix. For example,
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
-   Test code structure: use `describe` to structure the tests. For example,

    ```
    describe("[unit]", () => {
        test("[expected behavior]", () => {});

        describe("[sub unit]", () => {
            test("[expected behavior]", () => {});
        }
    }
    ```

-   Make sure to implement low-level tests that focus on a certain class or function. Mock imported classes and functions with Jest when necessary.
-   TypeScript enum: import TypeScript enum without index files to avoid compile failure.

### Testing React components

-   Avoid mocking blueprint.js objects to prevent having complex setups.
-   Avoid testing snapshots to prevent having large files in the codebase.
-   Follow [the order of priority](https://testing-library.com/docs/queries/about/#priority) suggested by React Testing Library when querying elements.
