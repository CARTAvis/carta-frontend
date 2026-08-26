#!/usr/bin/env node

/* Check carta-python's enum contract against frontend TypeScript/protobuf enums. */

"use strict";

const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const ROOT = path.resolve(__dirname, "..");
const FRONTEND_ENUMS = path.join(ROOT, "src/enums/index.ts");
const PROTOBUF_DECLARATIONS = path.join(ROOT, "protobuf/build/index.d.ts");
const MANIFEST_SOURCES = ["carta-python", "frontend", "protobuf"];

function usage() {
    console.log(`Usage: npm run check-python-enum -- --manifest FILE [--json]

Check carta-python enum values against frontend TypeScript and protobuf enums.

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

function validateEnumMember(member, index, source, enumName, manifestPath) {
    if (!member || typeof member !== "object" || Array.isArray(member)) {
        throw new Error(`Invalid manifest ${manifestPath}: ${source} enum ${enumName} member ${index} must be an object`);
    }
    if (typeof member.name !== "string" || !member.name) {
        throw new Error(`Invalid manifest ${manifestPath}: ${source} enum ${enumName} member ${index} has an invalid name`);
    }
    if (typeof member.value !== "string" && (typeof member.value !== "number" || !Number.isFinite(member.value))) {
        throw new Error(`Invalid manifest ${manifestPath}: ${source} enum ${enumName}.${member.name} has an invalid value`);
    }
}

function validateEnumGroup(group, source, manifestPath) {
    for (const [enumName, members] of Object.entries(group)) {
        if (!Array.isArray(members)) {
            throw new Error(`Invalid manifest ${manifestPath}: ${source} enum ${enumName} must contain a member array`);
        }
        for (const [index, member] of members.entries()) {
            validateEnumMember(member, index, source, enumName, manifestPath);
        }
        memberMap(members, source, enumName, "manifest");
    }
}

function loadManifest(manifestPath) {
    let data;
    try {
        data = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    } catch (error) {
        throw new Error(`Unable to read manifest ${manifestPath}: ${error.message}`);
    }
    if (!data.enums || typeof data.enums !== "object" || Array.isArray(data.enums)) {
        throw new Error(`Invalid manifest ${manifestPath}: expected grouped enums`);
    }
    if (MANIFEST_SOURCES.some(source => !data.enums[source] || typeof data.enums[source] !== "object" || Array.isArray(data.enums[source]))) {
        throw new Error(`Invalid manifest ${manifestPath}: expected carta-python, frontend, and protobuf enum groups`);
    }
    for (const source of MANIFEST_SOURCES) {
        validateEnumGroup(data.enums[source], source, manifestPath);
    }
    return data;
}

function createProgram(fileNames, compilerOptions = {}) {
    return ts.createProgram(fileNames, {
        target: ts.ScriptTarget.ESNext,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        skipLibCheck: true,
        noEmit: true,
        ...compilerOptions
    });
}

function diagnosticText(diagnostic) {
    return ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
}

function enumMembers(checker, declaration) {
    return declaration.members.map(member => {
        const value = checker.getConstantValue(member);
        if (typeof value !== "string" && typeof value !== "number") {
            throw new Error(`Unable to resolve enum value: ${member.getText()}`);
        }
        return {
            name: member.name.getText().replace(/^("|')(.*)\1$/, "$2"),
            value
        };
    });
}

function extractFrontendEnums() {
    const configPath = path.join(ROOT, "tsconfig.json");
    const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
    if (configFile.error) {
        throw new Error(diagnosticText(configFile.error));
    }
    const parsedConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, ROOT);
    if (parsedConfig.errors.length) {
        throw new Error(parsedConfig.errors.map(diagnosticText).join("\n"));
    }

    const program = createProgram(parsedConfig.fileNames, parsedConfig.options);
    const sourceFile = program.getSourceFile(FRONTEND_ENUMS);
    if (!sourceFile) {
        throw new Error(`Unable to find ${FRONTEND_ENUMS}`);
    }
    const checker = program.getTypeChecker();
    const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
    if (!moduleSymbol) {
        throw new Error(`Unable to inspect ${FRONTEND_ENUMS}`);
    }

    const enums = {};
    for (const exportedSymbol of checker.getExportsOfModule(moduleSymbol)) {
        const symbol = exportedSymbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exportedSymbol) : exportedSymbol;
        const declaration = symbol.declarations?.find(ts.isEnumDeclaration);
        if (declaration) {
            enums[exportedSymbol.name] = {members: enumMembers(checker, declaration)};
        }
    }
    return enums;
}

function extractProtobufEnums() {
    if (!fs.existsSync(PROTOBUF_DECLARATIONS)) {
        throw new Error(`Unable to find ${PROTOBUF_DECLARATIONS}; run npm run build-protobuf first`);
    }
    const program = createProgram([PROTOBUF_DECLARATIONS]);
    const sourceFile = program.getSourceFile(PROTOBUF_DECLARATIONS);
    if (!sourceFile) {
        throw new Error(`Unable to inspect ${PROTOBUF_DECLARATIONS}`);
    }
    const checker = program.getTypeChecker();
    const cartaNamespace = sourceFile.statements.find(statement => ts.isModuleDeclaration(statement) && statement.name.getText() === "CARTA");
    const namespaceBlock = cartaNamespace?.body;
    if (!namespaceBlock || !ts.isModuleBlock(namespaceBlock)) {
        throw new Error(`Unable to find CARTA namespace in ${PROTOBUF_DECLARATIONS}`);
    }

    const enums = {};
    for (const statement of namespaceBlock.statements) {
        if (ts.isEnumDeclaration(statement)) {
            enums[statement.name.text] = {members: enumMembers(checker, statement)};
        }
    }
    return enums;
}

function frontendEnums() {
    return {
        frontend: extractFrontendEnums(),
        protobuf: extractProtobufEnums()
    };
}

function canonicalName(name) {
    return name.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function memberMap(members, source, enumName, origin) {
    const membersByName = new Map();
    for (const member of members) {
        const name = canonicalName(member.name);
        if (!name) {
            throw new Error(`Invalid ${origin} ${source} enum ${enumName}: member ${member.name} has no canonical name`);
        }
        if (membersByName.has(name)) {
            throw new Error(`Duplicate canonical member name ${name} in ${origin} ${source} enum ${enumName}`);
        }
        membersByName.set(name, member);
    }
    return membersByName;
}

function checkEnumMembers(source, enumName, expectedMembers, definition) {
    const expectedByName = memberMap(expectedMembers, source, enumName, "manifest");
    const actualByName = memberMap(definition.members, source, enumName, "frontend");
    const results = [];

    for (const expected of expectedMembers) {
        const actual = actualByName.get(canonicalName(expected.name));
        if (!actual) {
            results.push({source, enum: enumName, member: expected.name, value: expected.value, found: false, reason: "member is missing"});
        } else if (actual.value !== expected.value) {
            results.push({source, enum: enumName, member: expected.name, value: expected.value, frontend_value: actual.value, found: false, reason: "value differs"});
        } else {
            results.push({source, enum: enumName, member: expected.name, value: expected.value, found: true});
        }
    }

    for (const actual of definition.members) {
        if (!expectedByName.has(canonicalName(actual.name))) {
            results.push({source, enum: enumName, member: actual.name, frontend_value: actual.value, found: false, reason: "member is missing in carta-python"});
        }
    }

    return results;
}

function checkManifest(manifest, definitions) {
    const results = [];
    for (const source of ["frontend", "protobuf"]) {
        const sourceDefinitions = definitions[source];
        for (const [enumName, expectedMembers] of Object.entries(manifest.enums[source])) {
            const definition = sourceDefinitions[enumName];
            if (!definition) {
                results.push({source, enum: enumName, found: false, reason: "enum is missing"});
                continue;
            }
            results.push(...checkEnumMembers(source, enumName, expectedMembers, definition));
        }
    }
    return results;
}

function main() {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) {
        usage();
        return 0;
    }

    const manifest = loadManifest(options.manifest);
    const results = checkManifest(manifest, frontendEnums());

    const missing = results.filter(result => !result.found);
    const present = results.length - missing.length;
    if (options.json) {
        console.log(JSON.stringify({manifest: options.manifest, checked: results.length, missing: missing.length, results}, null, 2));
    } else {
        for (const result of missing) {
            console.log(`MISSING ${result.source} enum ${result.enum}${result.member ? `.${result.member}` : ""}: ${result.reason}`);
        }
        console.log(`Checked ${results.length} carta-python enum values: ${present} present, ${missing.length} missing.`);
    }
    return missing.length ? 1 : 0;
}

module.exports = {
    canonicalName,
    checkEnumMembers,
    checkManifest,
    enumMembers,
    extractFrontendEnums,
    extractProtobufEnums,
    frontendEnums,
    loadManifest,
    memberMap,
    validateEnumGroup,
    validateEnumMember
};

if (require.main === module) {
    try {
        process.exitCode = main();
    } catch (error) {
        console.error(`ERROR ${error.message}`);
        process.exitCode = 1;
    }
}
