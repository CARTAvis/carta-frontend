import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import importPlugin from "eslint-plugin-import";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import tsdocPlugin from "eslint-plugin-tsdoc";
import bpEslintPlugin from "@blueprintjs/eslint-plugin";

export default [
    {
        ignores: ["node_modules/**", "wasm_src/**", "docs_website/**", "protobuf/**"]
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
                "off",
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
                    selector: ["property"],
                    modifiers: ["public", "static", "readonly"],
                    format: ["UPPER_CASE"],
                },
                {
                    selector: ["property"],
                    modifiers: ["private", "static", "readonly"],
                    format: ["PascalCase"],
                },
                {
                    selector: ["variable", "parameter", "property", "accessor"],
                    types: ["boolean"],
                    format: ["PascalCase"],
                    prefix: ["is", "should", "has", "can", "did", "will"]
                },
                {
                    selector: ["typeLike", "enum", "interface", "class", "typeAlias"],
                    format: ["PascalCase"]
                },
                {
                    selector: ["variable", "function", "parameter", "property", "accessor", "method", "classMethod"],
                    format: ["camelCase"],
                    leadingUnderscore: "allow"
                },
                {
                    selector: ["variable"],
                    modifiers: ["global"],
                    format: ["UPPER_CASE"]
                },
                {
                    selector: ["variable"],
                    modifiers: ["global"],
                    types: ["function"],
                    format: ["camelCase"]
                }
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
                            "^(components|enums|icons|models|services|stores|utilities)(/.*|$)"
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
