const FS = require("fs");
const OS = require("os");
const PATH = require("path");
const {spawnSync: SPAWN_SYNC} = require("child_process");

// @ts-expect-error The CLI checker is intentionally outside the frontend rootDir.
const CHECKER = require("../../scripts/check_python_enum");

const SCRIPT = PATH.resolve(__dirname, "../../scripts/check_python_enum.js");

function manifest(frontendEnums) {
    const normalizedFrontendEnums = Object.fromEntries(Object.entries(frontendEnums).map(([name, value]) => [name, value.members ?? value]));
    return {
        enums: {
            "carta-python": {},
            frontend: normalizedFrontendEnums,
            protobuf: {}
        }
    };
}

function runChecker(value) {
    const directory = FS.mkdtempSync(PATH.join(OS.tmpdir(), "carta-python-enum-check-"));
    const manifestPath = PATH.join(directory, "manifest.json");
    FS.writeFileSync(manifestPath, JSON.stringify(value));
    try {
        return SPAWN_SYNC(process.execPath, [SCRIPT, "--manifest", manifestPath], {encoding: "utf8"});
    } finally {
        FS.rmSync(directory, {recursive: true, force: true});
    }
}

describe("check_python_enum", () => {
    let definitions;

    beforeAll(() => {
        definitions = CHECKER.frontendEnums();
    });

    test("accepts matching frontend enum members", () => {
        const results = CHECKER.checkManifest(manifest({FrameScaling: definitions.frontend.FrameScaling}), definitions);

        expect(results).toHaveLength(definitions.frontend.FrameScaling.members.length);
        expect(results.every(result => result.found)).toBe(true);
    });

    test("detects a partially removed Python enum member", () => {
        const expected = definitions.frontend.FrameScaling.members.filter(member => member.name !== "SINH");
        const results = CHECKER.checkManifest(manifest({FrameScaling: expected}), definitions);
        const missing = results.find(result => result.member === "SINH");

        expect(missing).toMatchObject({
            found: false,
            reason: "member is present in frontend but missing in carta-python",
            frontend_value: 8
        });
    });

    test("does not require an enum that was completely removed from Python", () => {
        const results = CHECKER.checkManifest(manifest({}), definitions);

        expect(results).toEqual([]);
    });

    test("detects a changed enum value", () => {
        const expected = definitions.frontend.FrameScaling.members.map(member => (member.name === "SINH" ? {...member, value: 999} : member));
        const results = CHECKER.checkManifest(manifest({FrameScaling: expected}), definitions);

        expect(results.find(result => result.member === "SINH")).toMatchObject({
            found: false,
            reason: "value differs (frontend: 8, carta-python: 999)",
            frontend_value: 8,
            value: 999
        });
    });

    test("compares enum names canonically", () => {
        const results = CHECKER.checkEnumMembers("frontend", "Example", [{name: "no_smoothing", value: "NoSmoothing"}], {members: [{name: "NoSmoothing", value: "NoSmoothing"}]});

        expect(results).toEqual([{source: "frontend", enum: "Example", member: "no_smoothing", value: "NoSmoothing", found: true}]);
    });

    test("fails through the CLI when a Python enum member is missing", () => {
        const expected = definitions.frontend.FrameScaling.members.filter(member => member.name !== "ASINH");
        const result = runChecker(manifest({FrameScaling: expected}));

        expect(result.status).toBe(1);
        expect(result.stdout).toContain("MISSING frontend enum FrameScaling.ASINH");
    });
});
