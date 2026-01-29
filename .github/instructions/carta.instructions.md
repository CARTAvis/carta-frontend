# CARTA Frontend Development Guide

## Overview
CARTA is a radio-astronomy visualization tool. This React + TypeScript frontend communicates the backend through the WebSocket for image processing, uses WebAssembly modules for computation, and relies on Protocol Buffers for data exchange.

## Architecture

### State Management (MobX)
- **Singleton Stores**: Core state lives in singleton stores (e.g., `AppStore.Instance`, `WidgetsStore.Instance`)
- **MobX Decorators**: Use `@observable`, `@action`, `@computed` for reactive state
- **Components**: Mark observer components with `@observer` decorator from `mobx-react`
- **Example**: See [AppStore.ts](../../src/stores/AppStore/AppStore.ts) (3600+ lines, central orchestrator)

### Key Services
- **BackendService**: WebSocket connection to CARTA backend, Protocol Buffer message handling
- **TileService**: Image tile streaming and caching for efficient rendering
- **TileWebGLService**: WebGL2-based tile rendering with colormap support
- **ApiService**: HTTP API for configuration and runtime settings
- **ScriptingService**: Python scripting interface for automation

### UI Layout (GoldenLayout)
- Uses patched `golden-layout@1.5.9` for widget management (see [patches/golden-layout+1.5.9.patch](../../patches/golden-layout+1.5.9.patch))
- Patch updates GoldenLayout to work with React 18's `createRoot` API
- Widgets (histogram, spectral profiles, etc.) are dynamically created/destroyed
- Each widget type has a corresponding store in `src/stores/Widgets/`

### WebAssembly Integration
Two build stages required:
1. **WASM Libraries** (`wasm_libs/`): AST (astronomical coordinate transforms), GSL (math), ZFP (compression), zstd (compression)
2. **WASM Wrappers** (`wasm_src/`): TypeScript-callable wrappers for the above libraries

Built using Emscripten (4.0.3 recommended), requires Docker/Singularity OR native emcc installation.

### Protocol Buffers
- Submodule at `protobuf/` (carta-protobuf repo)
- Messages imported as `import {CARTA} from "carta-protobuf"`
- Must run `./protobuf/build_proto.sh` after protobuf changes
- Backend/frontend ICD version currently: 30 (see `BackendService.IcdVersion`)

## Development Workflows

### Build Commands
```bash
# Development server (auto-rebuilds)
npm run start

# Production build (full pipeline)
npm run build-docker         # With Docker
npm run build-singularity    # With Singularity  
npm run build                # Native (requires emcc)

# Build components separately
npm run build-libs-docker    # WASM libraries only
npm run build-wrappers       # WASM wrappers only
npm run build-protobuf       # Protocol buffers only
```

### MCP server
- Chrome devtools MCP
- Start CARTA backend with `./build/carta_backend --omp_threads 8 --debug_no_auth --verbosity 5 --no_browser` in a user specific carta-backend path
- Default backend is at `http://localhost:3000`

### Testing
```bash
npm test                     # Run Jest tests
npm run strict-null-checks   # TypeScript strict null checking (subset)
```

Unit tests use Jest with canvas mocking. See [setupTests.js](../../src/setupTests.js) for configuration.

### Unit Test Guidelines
For comprehensive unit test guidelines, see: https://cartavis.org/carta-frontend/docs/contributing/unit-test-guidelines

**Running Unit Tests:**
1. Install dependencies: `npm install`
2. Build protobuf and WASM: `npm run build-protobuf && npm run build-libs && npm run build-wrappers`
3. Run tests: `npm test` (Jest runs tests related to changed files by default)
4. Use `npm test --verbose` for detailed output

**Writing Unit Tests:**
- **Directory Structure**: Colocate test files with `.test.ts/tsx` suffix:
  ```
  src/
    components/
      AComponent/
        AComponent.tsx
        AComponent.scss
        AComponent.test.tsx
    utilities/
      math/
        math.ts
        math.test.ts
  ```
- **Test Structure**: Use `describe` blocks to organize tests:
  ```typescript
  describe("[unit]", () => {
    test("[expected behavior]", () => {
      // test implementation
    });
    
    describe("[sub unit]", () => {
      test("[expected behavior]", () => {
        // test implementation
      });
    });
  });
  ```
- **Best Practices**:
  - Focus on low-level tests for specific classes or functions
  - Mock imported classes/functions with Jest when necessary
  - Import TypeScript enums without index files to avoid compile failures
  - When testing React components:
    - Avoid mocking Blueprint.js objects to prevent complex setups
    - Avoid snapshot testing to keep codebase lean
    - Follow [React Testing Library query priority](https://testing-library.com/docs/queries/about/#priority) when querying elements

### Code Quality
```bash
npm run reformat             # Auto-format with Prettier
npm run checkformat          # Check formatting
npm run check-eslint         # Lint check
npm run fix-eslint           # Auto-fix linting issues
```

**Import Ordering**: ESLint enforces specific import order (see package.json rules):
1. React imports first
2. External dependencies
3. Internal modules (components, models, services, stores, utilities)
4. Relative imports
5. CSS imports last

## Code Conventions

### Naming Conventions
- Use PascalCase for component names, interfaces, and type aliases
- Use camelCase for variables, functions, and methods
- Use ALL_CAPS for constants and `public static readonly`

### File Organization
- **Components**: `src/components/` - React UI components
- **Stores**: `src/stores/` - MobX state management (one folder per store)
- **Services**: `src/services/` - Backend communication, WebGL rendering
- **Models**: `src/models/` - Type definitions and data structures
- **Utilities**: `src/utilities/` - Helper functions (AST wrappers, parsing, sorting, etc.)

### TypeScript Configuration
- `baseUrl: "./src"` allows absolute imports from src root
- Strict null checks enabled but not fully enforced (use `npm run strict-null-checks`)
- Experimental decorators enabled for MobX

### Component Patterns
```typescript
// Observer component pattern
@observer
export class MyComponent extends React.Component<MyProps> {
    render() {
        const appStore = AppStore.Instance; // Access singleton stores
        // Component renders automatically on observable changes
    }
}
```

### Store Patterns
```typescript
export class MyStore {
    private static staticInstance: MyStore;
    static get Instance() { /* singleton */ }
    
    @observable myState: string;
    @computed get derivedValue() { /* ... */ }
    @action updateState(newValue: string) { /* ... */ }
    
    constructor() {
        makeObservable(this); // Required for decorators
    }
}
```

## Key Integration Points

### WebAssembly Modules
- **ast_wrapper**: Coordinate system transforms (accessed via `import * as AST from "ast_wrapper"`)
- **carta_computation**: Image statistics and computations (accessed via `import * as CARTACompute from "carta_computation"`)
- **zfp_wrapper**: ZFP decompression for tiled image data
- **gsl_wrapper**: Statistical functions

Check readiness: `AppStore.Instance.astReady`, `AppStore.Instance.cartaComputeReady`

### Backend Communication
- WebSocket connection status: `BackendService.Instance.connectionStatus`
- Observable streams for tile data: `rasterTileStream`, `rasterSyncStream`
- All backend messages use Protocol Buffer format from `carta-protobuf`

### Image Rendering Pipeline
1. Backend sends compressed tiles via WebSocket
2. `TileService` decompresses and caches tiles
3. `TileWebGLService` renders tiles to canvas using WebGL2 shaders (see [src/services/GLSL/](../../src/services/GLSL/))
4. Colormap textures loaded from [static/allmaps.png](../../src/static/allmaps.png)

## Common Tasks

### Working with Regions
- Region stores in `src/stores/Frame/` (RegionStore, PointAnnotationStore, etc.)
- Cursor region has special ID: `CURSOR_REGION_ID = -1`
- Region rendering via Konva (react-konva) in ImageView

### Modifying Protocol Buffers
1. Create independent branch in `carta-protobuf` repo
2. Edit `.proto` files in `protobuf/` submodule
3. Commit changes to `carta-protobuf` repo
4. Update submodule reference in frontend

## Debugging Tips
- Use `LogStore` for application logs (avoid console.log in production)
- Enable MobX strict mode for state mutation debugging
- WebGL errors: Check `TileWebGLService.gl` context validity
- Backend connection issues: Check `BackendService.connectionDropped`

## Dependencies to Note
- **Blueprint.js**: UI component library (buttons, dialogs, etc.)
- **Konva/react-konva**: Canvas-based region rendering
- **Chart.js/react-chartjs-2**: Profile plot widgets
- **golden-layout**: Multi-panel layout (PATCHED for React 18)
- **plotly.js**: Advanced plotting features

## CI/CD
GitHub Actions workflows in [.github/workflows/](../../.github/workflows/):
- `continuous_integration.yml`: Tests Node 18 & 20, format checks
- Uses self-hosted runners with Docker container `carta/frontend-builder`
- Emscripten environment pre-configured in container

## Change log update
- Follow the format in `CHANGELOG.md`
- Add entry under `Unreleased` section
- Describe the bug fix and new feature as simple as possible for users
- Bug fix issue, add the change under `### Fixed` section
- New feature issue, add the change under `### Added` section

## Documentation

For comprehensive documentation guidelines, see: https://cartavis.org/carta-frontend/docs/contributing/documentation-guidelines

### General Guidelines
- Write clear and concise documentation
- Use consistent terminology and style
- Code comments use TSDoc format
- Write TSDoc comments for methods and classes in `src/stores/`

### Grammar
- Use present tense verbs (is, open) instead of past tense (was, opened)
- Write factual statements and direct commands. Avoid hypotheticals like "could" or "would"
- Use active voice where the subject performs the action

### Building Documentation
The documentation website is hosted on GitHub Pages and automatically updates when the `dev` branch changes.

**Local Development:**
```bash
cd docs_website/
npm install
npm start                    # Development server with auto-reload
npm run build                # Create production build
npm run serve                # Test production build
```

Note: Search feature only available in production builds.

**Formatting:**
```bash
npm run checkformat          # Check markdown format
npm run reformat             # Auto-fix format
```

Uses Prettier to maintain consistent markdown styling (indentation, line length, list numbering).

### Writing Documentation Pages
- Docs pages are in `docs/` directory
- API overview page is in `api/` directory
- Edit markdown files directly to modify content or add pages
- Use `.mdx` extension when using MDX components
- For version-specific links:
  - Use `DocsIndexLink` component for Docs index pages
  - Use `ApiLink` component for API subpages

### Writing API Documentation
API subpages are auto-generated from TSDoc comments in the codebase:
- Catalogs based on `index.ts` files
- Elements must be exported in respective `index.ts` to appear in catalogs
- Private and protected elements are not displayed
- Development server does not auto-rebuild TSDoc (manual rebuild required after changes)

**TSDoc Format:**
- Follow [TSDoc documentation](https://tsdoc.org/)
- ESLint enforces format requirements
- Run `npm run check-eslint` from repository root to check

### Versioning
To tag a new documentation version:
```bash
cd docs_website/
npm run docusaurus docs:version 1.2.3
npm run docusaurus api:version 1.2.3
```

This updates `versions.json` and creates files in `versioned_docs/` and `versioned_sidebars/` folders.