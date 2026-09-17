# Unit test review: `frontend-rstest_migration`

Reviewed the complete Rstest suite (88 files, 885 tests) and the migration diff from `dev` through `50478008f4`.

## Summary

The normal test suite passes: 88 files and 885 tests in 9.54 seconds during the traced run. ESLint also passes, the migrated test callbacks contain assertions, and no focused, skipped, todo, or snapshot tests remain. The Jest-to-Rstest API conversions are generally mechanical and preserve the existing assertions.

The suite is now isolated for the reviewed failure modes. The refactoring below keeps application singletons from opening network connections during tests, cleans up timer-backed tests and spies, and removes the instrumentation-sensitive benchmark gate. Coverage remains a low, unenforced baseline and is called out as follow-up work.

## Findings

### High: unit tests initialize the real application singleton — resolved

`ExportImageMenuComponent.test.tsx` accessed `AppStore.Instance` while arranging its spies. That constructed `BackendService`, `TelemetryService`, and `AppStore`, started three persistent intervals, and initiated live HTTP/TLS work.

The full leak run identifies the same class of problem in these 10 files:

- `src/components/Shared/ColorPicker/ColorPickerComponent.test.tsx`
- `src/stores/Catalog/CatalogDisplayStore.test.ts`
- `src/components/CatalogOverlay/CatalogOverlayComponent.test.ts`
- `src/components/Shared/ExportImageMenu/ExportImageMenuComponent.test.tsx`
- `src/components/CatalogOverlay/CatalogOverlayPlotSettingsPanelComponent/CatalogOverlayPlotSettingsPanelComponent.ui.test.tsx`
- `src/components/Shared/ColormapComponent/ColormapComponent.test.tsx`
- `src/stores/Widgets/CatalogWidget/CatalogDisplayStoreConfig.test.ts`
- `src/stores/Frame/FrameStore.test.ts`
- `src/components/Dialogs/FileBrowser/FileListTable/FileListTableComponent.test.ts`
- `src/components/FloatingWidgetManager/FloatingWidgetManagerComponent.test.tsx`

These tests were nondeterministic, could contact external services, and left work active beyond the assertion that supposedly completed the test. The shared setup now provides a minimal Axios double, application polling is disabled under `NODE_ENV=test`, and the export menu test mocks its store boundary before importing the component. The full leak run now passes all 88 files and 885 tests.

### High: `npm run test:coverage` fails — resolved

`TileCoordinate.test.ts:51-63` asserts that one million encodes complete in less than 20 ms. V8 coverage instrumentation changes that operation to 41-47 ms on the same Node 24 host, so the repository's coverage script ends with one failing test despite the functional assertion passing.

Wall-clock microbenchmarks should not be unit-test pass/fail gates. The test now retains the one-million-coordinate correctness checks and no longer makes timing a pass/fail condition. Coverage completes successfully.

### Medium: `FrameStore` zoom tests leave real timers active — resolved

The calls to `setAxisZoom` schedule the inertia timeout in `FrameStore.ts`. `FrameStore.test.ts` now uses fake timers for the file and clears/restores them in teardown; the full leak run reports no remaining handles.

### Medium: coverage can regress without failing CI

The V8 report is currently 23.24% statements, 17.90% branches, 28.75% functions, and 23.15% lines. `rstest.config.mts` defines coverage collection but no thresholds, and CI runs only `npm test`, not `test:coverage`. After fixing the timing test, establish a baseline threshold or use changed-file coverage so new work cannot reduce coverage silently.

### Low: a few spies are not restored — resolved

The export menu test now uses a hoisted module mock rather than spying on the live singleton, and `AngularSize.test.ts` restores its targeted spy in `afterAll`.

## Refactoring and performance suggestions

- Keep jsdom for UI tests, but do not make it the default for the entire suite. Only 7 test files directly use Testing Library or browser globals. Some transitive imports still require browser APIs today, so first isolate those imports, split the DOM-only setup, then use Rstest projects or per-file `@rstest-environment jsdom` comments. The trace attributes 16.41 seconds of aggregate worker time to environment setup.
- Replace broad imports such as `from "stores"`, `from "services"`, and `from "utilities"` with leaf-module imports in low-level tests. The trace attributes 50.77 seconds of aggregate worker time to collection, and the barrel imports are also what pull application singletons into otherwise small tests.
- Keep the new `npm run test:leaks` check in CI; it runs on the Node 24 job after the normal unit suite.
- The two Python CLI tests each spend about 1.9 seconds spawning a process. Keep one end-to-end CLI smoke test per script, but exercise most input/output cases through the exported function in-process.
- Replace the 10,000 random round trips in `TileCoordinate.test.ts` with deterministic boundary/table cases plus a seeded property test. That test is currently the slowest ordinary test body (235-301 ms) and an unseeded failure would be difficult to reproduce.
- Keep `rstest.config.mts` formatted; it was the only checked migration file that failed Prettier.

## Validation performed

- `npm test -- --reporter=default --silent=passed-only`: 88 files, 885 tests passed, 9.43 s.
- `npm test -- --detectAsyncLeaks --reporter=default --silent=passed-only`: 88 files, 885 tests passed, 9.57 s; no async leaks reported.
- `npm run test:coverage -- --coverage.reportOnFailure --coverage.reporters=text-summary --reporter=dot --silent=passed-only`: 88 files, 885 tests passed; 23.27% statements, 17.92% branches, 28.75% functions, 23.17% lines.
- `npm run check-eslint`: passed.
- `git diff --check`: passed.
- Static checks: no `.only`, `.skip`, `.todo`, snapshots, empty assertion bodies, or async test callbacks missing `await`/a returned promise.
