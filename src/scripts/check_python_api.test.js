const FS = require("fs");
const OS = require("os");
const PATH = require("path");
const {spawnSync: SPAWN_SYNC} = require("child_process");

const CHECKER = require("../../scripts/check_python_api");

const SCRIPT = PATH.resolve(__dirname, "../../scripts/check_python_api.js");

function manifest(apis) {
    return {apis};
}

function runChecker(value) {
    const directory = FS.mkdtempSync(PATH.join(OS.tmpdir(), "carta-python-api-check-"));
    const manifestPath = PATH.join(directory, "manifest.json");
    FS.writeFileSync(manifestPath, JSON.stringify(value));
    try {
        return SPAWN_SYNC(process.execPath, [SCRIPT, "--manifest", manifestPath], {encoding: "utf8"});
    } finally {
        FS.rmSync(directory, {recursive: true, force: true});
    }
}

describe("check_python_api", () => {
    let typeInfo;

    beforeAll(() => {
        typeInfo = CHECKER.createTypeChecker();
    });

    test("expands scalar, list, and map return paths", () => {
        const results = CHECKER.checkManifest(
            manifest([
                {
                    kind: "action",
                    path: "appendFile",
                    return_path: "frameInfo.fileId",
                    runtime_types: ["AppStore"]
                },
                {
                    kind: "action",
                    path: "backendService.getFileList",
                    return_path: ["files[*].name", "directory"],
                    runtime_types: ["BackendService"]
                },
                {
                    kind: "action",
                    path: "apiService.getSnippets",
                    return_path: {snippetCode: "code"},
                    runtime_types: ["ApiService"]
                }
            ]),
            typeInfo
        );

        expect(results).toHaveLength(3);
        expect(results.every(result => result.found)).toBe(true);
    });

    test("rejects a missing response path", () => {
        const [result] = CHECKER.checkManifest(
            manifest([
                {
                    kind: "action",
                    path: "appendFile",
                    return_path: "frameInfo.missing",
                    runtime_types: ["AppStore"]
                }
            ]),
            typeInfo
        );

        expect(result).toMatchObject({found: false, missing: "appendFile -> frameInfo.missing"});
        expect(result.reason).toContain("missing response path");
    });

    test("rejects an unknown runtime type instead of accepting the unfiltered path", () => {
        const [result] = CHECKER.checkManifest(
            manifest([
                {
                    kind: "action",
                    path: "backendService.getFileList",
                    runtime_types: ["TypoRuntimeType"]
                }
            ]),
            typeInfo
        );

        expect(result).toMatchObject({found: false, reason: "runtime type not found: TypoRuntimeType"});
    });

    test("skips legacy compatibility entries", () => {
        const [result] = CHECKER.checkManifest(manifest([{compatibility: "legacy", kind: "action", path: "removedApi"}]), typeInfo);

        expect(result).toMatchObject({skipped: true, skip_reason: "legacy compatibility entry"});
    });

    test("normalizes nested return path collections with stable labels", () => {
        expect(CHECKER.returnPathEntries(["value", {first: ["nested.value"]}])).toEqual([
            {path: "value", label: "return_path[0]"},
            {path: "nested.value", label: "return_path[1].first[0]"}
        ]);
    });

    test("runs successfully as a CLI", () => {
        const result = runChecker(
            manifest([
                {
                    kind: "action",
                    path: "appendFile",
                    return_path: "frameInfo.fileId",
                    runtime_types: ["AppStore"]
                }
            ])
        );

        expect(result.status).toBe(0);
        expect(result.stdout).toContain("1 present, 0 missing");
    });
});
