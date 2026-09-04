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

Check the carta-python API manifest paths against the frontend AppStore type.

Options:
  --manifest FILE  Manifest to check (required)
  --json           Print machine-readable results
  --help           Show this help`);
}

function resolveFilePath(value, option) {
    if (!value || value.startsWith("--")) {
        throw new Error(`${option} requires a FILE`);
    }
    return path.resolve(process.cwd(), value);
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
            options.manifest = resolveFilePath(args[++i], "--manifest");
        } else if (arg.startsWith("--manifest=")) {
            options.manifest = resolveFilePath(arg.slice("--manifest=".length), "--manifest");
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

function diagnosticText(diagnostic) {
    return ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
}

function createTypeChecker() {
    const configPath = path.join(ROOT, "tsconfig.json");
    const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
    if (configFile.error) {
        throw new Error(diagnosticText(configFile.error));
    }

    const parsedConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, ROOT);
    if (parsedConfig.errors.length) {
        const message = parsedConfig.errors.map(diagnosticText).join("\n");
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
        const key = symbol ?? normalizedType;
        if (seen.has(key)) {
            return;
        }
        seen.add(key);
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
    if (!name.includes("*")) {
        return properties.filter(property => property.name === name);
    }
    const escaped = name.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    const pattern = new RegExp(`^${escaped}$`);
    return properties.filter(property => pattern.test(property.name));
}

function indexedValueTypes(checker, type, derivedTypes) {
    const values = [];

    for (const constituent of runtimeTypes(checker, type, derivedTypes)) {
        const arrayValueType = checker.getIndexTypeOfType(constituent, ts.IndexKind.Number);
        if (arrayValueType) {
            values.push(arrayValueType);
            continue;
        }

        const mapValueType = checker.getIndexTypeOfType(constituent, ts.IndexKind.String);
        if (mapValueType) {
            values.push(mapValueType);
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
    return expandedTypes.filter(type => runtimeTypeNames.includes(typeName(type)));
}

function checkPath(checker, rootType, apiPath, location, derivedTypes, runtimeTypeNames) {
    let currentTypes = [rootType];
    let traversed = [];
    let runtimeTypeMatched = !runtimeTypeNames?.length;

    const rootRuntimeTypes = narrowRuntimeTypes(checker, currentTypes, runtimeTypeNames, derivedTypes);
    if (rootRuntimeTypes.length) {
        currentTypes = rootRuntimeTypes;
        runtimeTypeMatched = true;
    }

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

        if (!runtimeTypeMatched) {
            const matchingRuntimeTypes = narrowRuntimeTypes(checker, nextTypes, runtimeTypeNames, derivedTypes);
            if (matchingRuntimeTypes.length) {
                currentTypes = matchingRuntimeTypes;
                runtimeTypeMatched = true;
            } else {
                currentTypes = nextTypes;
            }
        } else {
            currentTypes = nextTypes;
        }
        traversed.push(component.indexed ? `${component.name}[*]` : component.name);
    }

    if (!runtimeTypeMatched) {
        return {
            found: false,
            missing: apiPath,
            reason: `runtime type not found: ${runtimeTypeNames.join(", ")}`
        };
    }

    return {found: true, terminalTypes: currentTypes};
}

function returnPathEntries(returnPath, label = "return_path") {
    if (returnPath === "") {
        return [];
    }
    if (typeof returnPath === "string") {
        if (!returnPath) {
            throw new Error(`${label} must not contain an empty path`);
        }
        return [{path: returnPath, label}];
    }
    if (Array.isArray(returnPath)) {
        return returnPath.flatMap((path, index) => returnPathEntries(path, `${label}[${index}]`));
    }
    if (returnPath && typeof returnPath === "object") {
        return Object.entries(returnPath).flatMap(([name, path]) => returnPathEntries(path, `${label}.${name}`));
    }
    throw new Error(`${label} must be a string, an array, or an object of paths`);
}

function unwrapResponseTypes(checker, type, derivedTypes) {
    const responseTypes = [];
    const pending = runtimeTypes(checker, type, derivedTypes);
    const seen = new Set();

    while (pending.length) {
        const currentType = pending.shift();
        // Generic wrappers such as Generator<Generator<...>> share a symbol;
        // use the instantiated type identity so nested wrappers are visited.
        const key = currentType.id ?? currentType;
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);

        const typeArguments = checker.getTypeArguments(currentType);
        const name = currentType.aliasSymbol?.name ?? currentType.symbol?.name;
        if (["Promise", "PromiseLike", "Thenable"].includes(name) && typeArguments.length >= 1) {
            pending.push(...runtimeTypes(checker, typeArguments[0], derivedTypes));
        } else if (["Generator", "AsyncGenerator"].includes(name) && typeArguments.length >= 2) {
            const returnType = typeArguments[1];
            const yieldType = typeArguments[0];
            const returnIsUnknown = returnType.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown);
            pending.push(...runtimeTypes(checker, returnIsUnknown ? yieldType : returnType, derivedTypes));
        } else {
            responseTypes.push(currentType);
        }
    }

    return responseTypes;
}

function responseValueTypes(checker, type, derivedTypes) {
    const values = [];

    for (const responseType of unwrapResponseTypes(checker, type, derivedTypes)) {
        const collectionValues = indexedValueTypes(checker, responseType, derivedTypes);
        values.push(...(collectionValues.length ? collectionValues : [responseType]));
    }

    return values;
}

function checkReturnPaths(checker, responseTypes, returnPath, location, derivedTypes) {
    const entries = returnPathEntries(returnPath);
    const valueTypes = responseTypes.flatMap(type => responseValueTypes(checker, type, derivedTypes));
    const checkableValueTypes = valueTypes.filter(type => !(type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)));
    const failures = [];

    for (const entry of entries) {
        if (!valueTypes.length) {
            failures.push({path: entry.path, label: entry.label, reason: "unable to infer response value type"});
            continue;
        }
        if (checkableValueTypes.length !== valueTypes.length) {
            failures.push({path: entry.path, label: entry.label, reason: "response value type is any or unknown"});
            continue;
        }

        for (const valueType of checkableValueTypes) {
            const result = checkPath(checker, valueType, entry.path, location, derivedTypes);
            if (!result.found) {
                failures.push({
                    path: entry.path,
                    label: entry.label,
                    reason: result.reason ?? `missing response path at ${result.missing ?? entry.path}`
                });
            }
        }
    }

    return failures;
}

function actionResponseTypes(checker, types) {
    const responseTypes = [];
    const uncheckableTypes = [];

    for (const type of types) {
        const signatures = type.getCallSignatures();
        if (!signatures.length) {
            responseTypes.push(type);
            continue;
        }

        for (const signature of signatures) {
            const responseType = signature.getReturnType();
            if (responseType.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) {
                uncheckableTypes.push(responseType);
            } else {
                responseTypes.push(responseType);
            }
        }
    }

    return responseTypes.length ? responseTypes : uncheckableTypes;
}

function checkManifest(manifest, typeInfo) {
    return manifest.apis.map(api => {
        if (api.compatibility === "legacy") {
            return {...api, skipped: true, skip_reason: "legacy compatibility entry"};
        }

        const pathResult = checkPath(typeInfo.checker, typeInfo.appStoreType, api.path, typeInfo.appStoreDeclaration, typeInfo.derivedTypes, api.runtime_types);
        if (pathResult.found && api.kind === "action" && !pathResult.terminalTypes.some(type => type.getCallSignatures().length > 0)) {
            return {...api, found: false, missing: api.path, reason: "not callable"};
        }
        if (pathResult.found && api.return_path) {
            const actionTypes = api.kind === "action" ? actionResponseTypes(typeInfo.checker, pathResult.terminalTypes) : pathResult.terminalTypes;
            const returnFailures = checkReturnPaths(typeInfo.checker, actionTypes, api.return_path, typeInfo.appStoreDeclaration, typeInfo.derivedTypes);
            if (returnFailures.length) {
                const failure = returnFailures[0];
                return {
                    ...api,
                    found: false,
                    missing: `${api.path} -> ${failure.path}`,
                    reason: `${failure.label}: ${failure.reason}`
                };
            }
        }
        return {
            ...api,
            found: pathResult.found,
            missing: pathResult.missing,
            ...(pathResult.reason ? {reason: pathResult.reason} : {})
        };
    });
}

function printReport(results, manifestPath, json) {
    const skipped = results.filter(result => result.skipped);
    const checked = results.filter(result => !result.skipped);
    const missing = checked.filter(result => !result.found);
    const present = checked.length - missing.length;

    if (json) {
        console.log(JSON.stringify({manifest: manifestPath, checked: checked.length, skipped: skipped.length, present, missing: missing.length, results}, null, 2));
        return missing.length;
    }

    for (const result of missing) {
        const location = result.missing && result.missing !== result.path ? ` (at ${result.missing})` : "";
        const detail = result.reason ? `: ${result.reason}` : location;
        const wrappers = result.wrappers?.length ? ` [wrappers: ${result.wrappers.join(", ")}]` : "";
        console.log(`MISSING ${result.kind} ${result.path}${wrappers}${detail}`);
    }

    const skippedMessage = skipped.length ? `, ${skipped.length} legacy skipped` : "";
    console.log(`Checked ${checked.length} frontend APIs from ${manifestPath}: ${present} present, ${missing.length} missing${skippedMessage}.`);
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

module.exports = {
    actionResponseTypes,
    checkManifest,
    checkPath,
    checkReturnPaths,
    createTypeChecker,
    indexedValueTypes,
    loadManifest,
    parseArguments,
    responseValueTypes,
    returnPathEntries,
    splitPath,
    unwrapResponseTypes
};

if (require.main === module) {
    try {
        process.exitCode = main();
    } catch (error) {
        console.error(`ERROR ${error.message}`);
        process.exitCode = 1;
    }
}
