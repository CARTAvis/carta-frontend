#!/usr/bin/env node

/*
 * Check the carta-python scripting API manifest against the AppStore type.
 *
 * The manifest paths are relative to AppStore, which is exposed as both
 * `window.app` and `window.carta` by the frontend.  `[*]` denotes a Map/Array
 * lookup and `*` denotes a wildcard member name.
 */

"use strict";

const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const ROOT = path.resolve(__dirname, "..");
const APP_STORE_SOURCE = path.resolve(ROOT, "src/stores/AppStore/AppStore.ts");

function usage() {
    console.log(`Usage: npm run check-python-api -- --manifest FILE [--json]

Check the carta-python frontend_api.json paths against the frontend AppStore type.

Options:
  --manifest FILE  Manifest to check (required)
  --json           Print machine-readable results
  --help           Show this help`);
}

function resolveManifestPath(manifest) {
    if (!manifest || manifest.startsWith("--")) {
        throw new Error("--manifest requires a FILE");
    }
    return path.resolve(process.cwd(), manifest);
}

function parseArguments(args) {
    const options = {manifest: null, json: false, help: false};

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === "--help" || arg === "-h") {
            options.help = true;
        } else if (arg === "--json") {
            options.json = true;
        } else if (arg === "--manifest") {
            options.manifest = resolveManifestPath(args[++i]);
        } else if (arg.startsWith("--manifest=")) {
            options.manifest = resolveManifestPath(arg.slice("--manifest=".length));
        } else {
            throw new Error(`Unknown option: ${arg}`);
        }
    }

    if (!options.help && !options.manifest) {
        throw new Error("Missing required option: --manifest FILE");
    }

    return options;
}

function loadManifest(manifestPath) {
    let data;
    try {
        data = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    } catch (error) {
        throw new Error(`Unable to read manifest ${manifestPath}: ${error.message}`);
    }

    if (!Array.isArray(data.apis)) {
        throw new Error(`Invalid manifest ${manifestPath}: expected an apis array`);
    }

    return data;
}

function createTypeChecker() {
    const configPath = path.join(ROOT, "tsconfig.json");
    const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
    if (configFile.error) {
        throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n"));
    }

    const parsedConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, ROOT);
    if (parsedConfig.errors.length) {
        const message = parsedConfig.errors.map(error => ts.flattenDiagnosticMessageText(error.messageText, "\n")).join("\n");
        throw new Error(`Unable to parse ${configPath}: ${message}`);
    }

    const program = ts.createProgram(parsedConfig.fileNames, parsedConfig.options);
    const checker = program.getTypeChecker();
    const derivedTypes = collectDerivedTypes(program, checker);
    const sourceFile = program.getSourceFiles().find(file => path.resolve(file.fileName) === APP_STORE_SOURCE);
    if (!sourceFile) {
        throw new Error(`Unable to find ${APP_STORE_SOURCE} in the TypeScript program`);
    }

    const appStoreDeclaration = sourceFile.statements.find(statement => ts.isClassDeclaration(statement) && statement.name?.text === "AppStore");
    const appStoreSymbol = appStoreDeclaration && checker.getSymbolAtLocation(appStoreDeclaration.name);
    if (!appStoreDeclaration || !appStoreSymbol) {
        throw new Error(`Unable to find the AppStore class in ${APP_STORE_SOURCE}`);
    }

    return {
        checker,
        derivedTypes,
        appStoreDeclaration,
        appStoreType: checker.getDeclaredTypeOfSymbol(appStoreSymbol)
    };
}

function collectDerivedTypes(program, checker) {
    const derivedTypes = new Map();

    for (const sourceFile of program.getSourceFiles()) {
        if (sourceFile.isDeclarationFile) {
            continue;
        }

        for (const statement of sourceFile.statements) {
            if (!ts.isClassDeclaration(statement) || !statement.name) {
                continue;
            }

            const symbol = checker.getSymbolAtLocation(statement.name);
            if (!symbol) {
                continue;
            }

            const type = checker.getDeclaredTypeOfSymbol(symbol);
            let baseTypes;
            try {
                baseTypes = checker.getBaseTypes(type) ?? [];
            } catch {
                baseTypes = [];
            }

            for (const baseType of baseTypes) {
                const baseSymbol = baseType.aliasSymbol ?? baseType.symbol;
                if (!baseSymbol) {
                    continue;
                }
                const types = derivedTypes.get(baseSymbol) ?? [];
                types.push(type);
                derivedTypes.set(baseSymbol, types);
            }
        }
    }

    return derivedTypes;
}

function splitPath(pathString) {
    return pathString.split(".").map(component => {
        const indexed = /^(.*)\[\*\]$/.exec(component);
        return indexed ? {name: indexed[1], indexed: true} : {name: component, indexed: false};
    });
}

function runtimeTypes(checker, type, derivedTypes) {
    const nonNullableType = checker.getNonNullableType(type);
    const types = nonNullableType.isUnionOrIntersection() ? nonNullableType.types : [nonNullableType];
    const expandedTypes = [];
    const seen = new Set();

    const addType = currentType => {
        const normalizedType = checker.getNonNullableType(currentType);
        const symbol = normalizedType.aliasSymbol ?? normalizedType.symbol;
        if (seen.has(symbol ?? normalizedType)) {
            return;
        }
        seen.add(symbol ?? normalizedType);
        expandedTypes.push(normalizedType);
        for (const derivedType of derivedTypes.get(symbol) ?? []) {
            addType(derivedType);
        }
    };

    for (const currentType of types) {
        addType(currentType);
    }

    return expandedTypes;
}

function typeProperties(checker, type, derivedTypes) {
    const symbols = new Map();

    for (const constituent of runtimeTypes(checker, type, derivedTypes)) {
        for (const symbol of checker.getPropertiesOfType(constituent)) {
            symbols.set(symbol.name, symbol);
        }
    }

    return [...symbols.values()];
}

function matchingProperties(checker, type, name, derivedTypes) {
    const properties = typeProperties(checker, type, derivedTypes);
    if (name.includes("*")) {
        const pattern = new RegExp(
            `^${name
                .split("*")
                .map(part => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
                .join(".*")}$`
        );
        return properties.filter(property => pattern.test(property.name));
    }
    return properties.filter(property => property.name === name);
}

function indexedValueTypes(checker, type, derivedTypes) {
    const values = [];

    for (const constituent of runtimeTypes(checker, type, derivedTypes)) {
        const arrayValueType = checker.getIndexTypeOfType(constituent, ts.IndexKind.Number);
        if (arrayValueType) {
            values.push(arrayValueType);
            continue;
        }

        const typeArguments = checker.getTypeArguments(constituent);
        const typeName = constituent.symbol?.name ?? constituent.aliasSymbol?.name;
        if (typeArguments.length >= 2 && ["Map", "ReadonlyMap", "ObservableMap"].includes(typeName)) {
            values.push(typeArguments[1]);
        }
    }

    return values;
}

function typeName(type) {
    return type.aliasSymbol?.name ?? type.symbol?.name;
}

function narrowRuntimeTypes(checker, types, runtimeTypeNames, derivedTypes) {
    if (!runtimeTypeNames?.length) {
        return types;
    }

    const expandedTypes = types.flatMap(type => runtimeTypes(checker, type, derivedTypes));
    const matchingTypes = expandedTypes.filter(type => runtimeTypeNames.includes(typeName(type)));
    return matchingTypes.length ? matchingTypes : types;
}

function checkPath(checker, rootType, apiPath, location, derivedTypes, runtimeTypeNames) {
    let currentTypes = [rootType];
    let traversed = [];

    for (const component of splitPath(apiPath)) {
        const nextTypes = [];
        const matchingSymbols = currentTypes.flatMap(type => matchingProperties(checker, type, component.name, derivedTypes));
        if (!matchingSymbols.length) {
            return {found: false, missing: [...traversed, component.name].join(".")};
        }

        for (const symbol of matchingSymbols) {
            const propertyType = checker.getTypeOfSymbolAtLocation(symbol, location);
            if (component.indexed) {
                nextTypes.push(...indexedValueTypes(checker, propertyType, derivedTypes));
            } else {
                nextTypes.push(propertyType);
            }
        }

        if (!nextTypes.length) {
            return {found: false, missing: `${[...traversed, component.name].join(".")}[*]`};
        }

        currentTypes = narrowRuntimeTypes(checker, nextTypes, runtimeTypeNames, derivedTypes);
        traversed.push(component.indexed ? `${component.name}[*]` : component.name);
    }

    return {found: true, terminalTypes: currentTypes};
}

function checkManifest(manifest, typeInfo) {
    return manifest.apis.map(api => {
        const {terminalTypes, ...result} = checkPath(typeInfo.checker, typeInfo.appStoreType, api.path, typeInfo.appStoreDeclaration, typeInfo.derivedTypes, api.runtime_types);
        if (result.found && api.kind === "action" && !terminalTypes.some(type => type.getCallSignatures().length > 0)) {
            return {...api, ...result, found: false, missing: api.path, reason: "not callable"};
        }
        return {...api, ...result};
    });
}

function printReport(results, manifestPath, json) {
    const missing = results.filter(result => !result.found);
    if (json) {
        console.log(JSON.stringify({manifest: manifestPath, checked: results.length, present: results.length - missing.length, missing: missing.length, results}, null, 2));
        return missing.length;
    }

    for (const result of missing) {
        const location = result.missing && result.missing !== result.path ? ` (at ${result.missing})` : "";
        const detail = result.reason ? `: ${result.reason}` : location;
        const wrappers = result.wrappers?.length ? ` [wrappers: ${result.wrappers.join(", ")}]` : "";
        console.log(`MISSING ${result.kind} ${result.path}${wrappers}${detail}`);
    }

    const present = results.length - missing.length;
    console.log(`Checked ${results.length} frontend APIs from ${manifestPath}: ${present} present, ${missing.length} missing.`);
    return missing.length;
}

function main() {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) {
        usage();
        return 0;
    }

    const manifest = loadManifest(options.manifest);
    const typeInfo = createTypeChecker();
    const results = checkManifest(manifest, typeInfo);
    return printReport(results, options.manifest, options.json) ? 1 : 0;
}

try {
    process.exitCode = main();
} catch (error) {
    console.error(`ERROR ${error.message}`);
    process.exitCode = 1;
}
