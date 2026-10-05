module.exports = {
    // Test environment
    testEnvironment: 'jsdom',
    
    // Setup files
    setupFilesAfterEnv: ['<rootDir>/src/setupTests.js'],
    
    // Module file extensions
    moduleFileExtensions: [
        'js',
        'jsx',
        'ts',
        'tsx',
        'json',
        'node'
    ],
    
    // Transform files
    transform: {
        '^.+\\.(ts|tsx)$': ['ts-jest', {
            useESM: true,
            tsconfig: {
                module: 'esnext',
                verbatimModuleSyntax: false,
                typeRoots: ['node_modules/@types', 'src/types'],
                types: ['node'],
                strictNullChecks: false,
                strict: false
            }
        }],
        '^.+\\.(js|jsx)$': 'babel-jest',
    },
    
    // Transform ignore patterns
    transformIgnorePatterns: [
        'node_modules/(?!(konva|@blueprintjs|axios|usehooks-ts|uuid))'
    ],
    
    // Module name mapping
    moduleNameMapper: {
        // Handle CSS imports (with CSS modules)
        '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
        
        // Handle image imports
        '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$': 'jest-transform-stub',
        
        // Handle GLSL files
        '\\.(glsl|frag|vert)$': 'jest-transform-stub',
        
        // Handle absolute imports based on your tsconfig
        '^components/(.*)$': '<rootDir>/src/components/$1',
        '^enums/(.*)$': '<rootDir>/src/enums/$1',
        '^icons/(.*)$': '<rootDir>/src/icons/$1',
        '^models/(.*)$': '<rootDir>/src/models/$1',
        '^services/(.*)$': '<rootDir>/src/services/$1',
        '^stores/(.*)$': '<rootDir>/src/stores/$1',
        '^utilities/(.*)$': '<rootDir>/src/utilities/$1',
        
        // Handle WASM modules
        'canvas': 'jest-canvas-mock',
        'zfp_wrapper': '<rootDir>/src/__mocks__/ZFPWorkerMock.js',
        'ast_wrapper': '<rootDir>/src/__mocks__/ast_wrapper.js',
        'gsl_wrapper': '<rootDir>/src/__mocks__/gsl_wrapper.js',
        'carta_computation': '<rootDir>/src/__mocks__/carta_computation.js',

        // Handle WASM files
        '\\.(wasm)$': 'jest-transform-stub',
        
        // Handle carta-schemas
        '^carta-schemas/(.*)$': '<rootDir>/schemas/$1'
    },
    
    // Test match patterns
    testMatch: [
        '<rootDir>/src/**/__tests__/**/*.(js|jsx|ts|tsx)',
        '<rootDir>/src/**/?(*.)(spec|test).(js|jsx|ts|tsx)',
        '<rootDir>/wasm_src/**/?(*.)(spec|test).(js|jsx|ts|tsx)'
    ],
    
    // Collect coverage from
    collectCoverageFrom: [
        'src/**/*.(js|jsx|ts|tsx)',
        '!src/**/*.d.ts',
        '!src/index.tsx',
        '!src/registerServiceWorker.ts',
        '!src/setupTests.js'
    ],
    
    // Module directories
    moduleDirectories: [
        'node_modules',
        'src'
    ],
    
    // Clear mocks between tests
    clearMocks: true,
    
    // Verbose output
    verbose: true,
    
    // Extension to treat as ESM
    extensionsToTreatAsEsm: ['.ts', '.tsx']
};
