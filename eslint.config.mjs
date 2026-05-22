import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import importPlugin from "eslint-plugin-import";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import tsdocPlugin from "eslint-plugin-tsdoc";
import bpEslintPlugin from "@blueprintjs/eslint-plugin";

export default [
    {
        ignores: ["node_modules/**", "wasm_src/**", "docs_website/**", "protobuf/**", "src/components/**", "src/icons/**", "src/scripting/**", "src/utilities/**", "src/services/**", "src/models/**", "src/enums/**", "src/stores/Frame/AnnotationStore.ts", "src/stores/Frame/FrameStore.ts", "src/stores/Frame/FrameStore.ts", "src/stores/Frame/FrameStore.ts", "src/stores/Frame/ColorbarStore/**", "src/stores/Frame/ContourStore/**", "src/stores/Frame/Region/**"]
    },
    {
        files: ["**/*.js", "**/*.jsx", "**/*.ts", "**/*.tsx"],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                ecmaVersion: "latest",
                sourceType: "module",
                project: ["./tsconfig.eslint.json"]
            }
        },
        plugins: {
            "@typescript-eslint": tsPlugin,
            import: importPlugin,
            "simple-import-sort": simpleImportSort,
            tsdoc: tsdocPlugin,
            "@blueprintjs": bpEslintPlugin
        },
        rules: {
            "@typescript-eslint/naming-convention": [
                "warn",
                {
                    selector: "default",
                    format: ["camelCase", "PascalCase", "UPPER_CASE"],
                    leadingUnderscore: "allow",
                    trailingUnderscore: "forbid"
                },
                {
                    selector: [
                        "enumMember",
                        "objectLiteralProperty",
                        "typeProperty",
                        "objectLiteralMethod",
                        "typeMethod"
                    ],
                    format: null
                },
                {
                    selector: ["class", "enum", "interface", "typeAlias", "typeParameter"],
                    format: ["PascalCase"]
                },
                {
                    selector: "classProperty",
                    modifiers: ["public", "static", "readonly"],
                    format: ["UPPER_CASE"],
                },
                {
                    selector: "classProperty",
                    modifiers: ["private", "static", "readonly"],
                    format: ["PascalCase"],
                },
                {
                    selector: "classProperty",
                    modifiers: ["protected"],
                    format: ["camelCase"],
                },
                {
                    selector: "variable",
                    modifiers: ["const", "global"],
                    format: ["UPPER_CASE"],
                },
                {
                    selector: "variable",
                    types: ["function"],
                    modifiers: ["const", "global"],
                    format: ["PascalCase"],
                },
                {
                    selector: ["function", "variable", "parameter", "classProperty", "classMethod", "classicAccessor", "autoAccessor"],
                    format: ["camelCase"],
                    leadingUnderscore: "allow",
                },
                {
                    selector: ["classicAccessor"],
                    modifiers: ["public", "static"],
                    format: ["PascalCase"],
                },
                {
                    selector: ["variable", "parameter", "classProperty", "classicAccessor", "autoAccessor"],
                    types: ["boolean"],
                    format: ["PascalCase"],
                    prefix: ["is", "should", "has", "can", "did", "will"]
                },
                // exceptions for certain patterns and don't follow the above conventions
                // list of exception for legacy code (try not to add another exception):
                // const N = maxIndex - minIndex;
                // const M = controlPoints.length + (closed ? 1 : 0);
                // const Jys = Object.values(Jansky);
                // const SN = 2;
                // const Iz = requiredCoordinate.indexOf(StokesCoordinate.TotalIntensity);
                // const UIn8 = getBufferElementType(data) === "UIn8";
                // return this.fixedParams.filter(p => p === true).length;
                {
                    selector: ["classProperty", "classicAccessor", "variable", "parameter"],
                    filter: {
                        regex: "^(N|M|p|UIn8|Iz|Jys|SN)$|^(CARTA|HDU|WCS)",
                        match: true
                    },
                    format: null,
                },
            ],
            "@typescript-eslint/no-unused-expressions": "error",
            "@typescript-eslint/consistent-type-imports": [
                "error",
                {
                    fixStyle: "inline-type-imports"
                }
            ],
            "import/no-webpack-loader-syntax": "off",
            "no-unused-expressions": "off",
            "no-unused-vars": "off",
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    args: "none"
                }
            ],
            "object-curly-spacing": "off",
            "jsx-a11y/alt-text": "off",
            "simple-import-sort/imports": [
                "error",
                {
                    groups: [
                        [
                            "^react",
                            "^@?\\w"
                        ],
                        [
                            "^(components|enums|icons|models|scripting|services|stores|utilities)(/.*|$)"
                        ],
                        [
                            "^\\u0000"
                        ],
                        [
                            "^\\.\\.(?!/?$)",
                            "^\\.\\./?$"
                        ],
                        [
                            "^\\./(?=.*/)(?!/?$)",
                            "^\\.(?!/?$)",
                            "^\\./?$"
                        ],
                        [
                            "^.+\\.?(css)$"
                        ]
                    ]
                }
            ],
            "simple-import-sort/exports": "error",
            "import/newline-after-import": "error",
            "import/no-duplicates": "error",
            "tsdoc/syntax": "error",
            "prefer-const": "error",
            "@blueprintjs/classes-constants": "error",
            "@blueprintjs/html-components": "error"
        }
    }
];
