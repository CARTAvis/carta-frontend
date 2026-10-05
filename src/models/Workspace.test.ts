import Ajv from "ajv";
import {CARTA} from "carta-protobuf";

import {type Workspace, WorkspaceConfig} from "./Workspace";

describe("WorkspaceConfig.upgradeForRuntime", () => {
    test("upgrades legacy alpha without modifying the stored workspace", () => {
        const storedWorkspace = {
            workspaceVersion: 1,
            frontendVersion: "5.0.0",
            files: [
                {
                    id: 0,
                    filename: "image.fits",
                    renderConfig: {
                        alpha: 1_000_000,
                        alphaLog: 2,
                        gamma: 1
                    }
                }
            ]
        } as unknown as Workspace;
        const originalJson = JSON.stringify(storedWorkspace);

        const runtimeWorkspace = WorkspaceConfig.upgradeForRuntime(storedWorkspace);
        const runtimeRenderConfig = runtimeWorkspace.files?.[0].renderConfig;

        expect(runtimeWorkspace).not.toBe(storedWorkspace);
        expect(runtimeWorkspace.files?.[0]).not.toBe(storedWorkspace.files?.[0]);
        expect(runtimeRenderConfig).not.toBe(storedWorkspace.files?.[0].renderConfig);
        expect(runtimeRenderConfig).toEqual({alphaLog: 2, alphaPower: 1_000_000, gamma: 1});
        expect(runtimeRenderConfig).not.toHaveProperty("alpha");
        expect(JSON.stringify(storedWorkspace)).toBe(originalJson);
    });

    test("removes an invalid legacy alpha without creating current alpha fields", () => {
        const storedWorkspace = {
            workspaceVersion: 1,
            frontendVersion: "5.0.0",
            files: [
                {
                    id: 0,
                    filename: "image.fits",
                    renderConfig: {alpha: "invalid"}
                }
            ]
        } as unknown as Workspace;

        const runtimeRenderConfig = WorkspaceConfig.upgradeForRuntime(storedWorkspace).files?.[0].renderConfig;

        expect(runtimeRenderConfig).toEqual({});
        expect(storedWorkspace.files?.[0].renderConfig).toHaveProperty("alpha", "invalid");
    });
});

describe("workspace annulus statistics compatibility", () => {
    const schema = require("carta-schemas/workspace_schema_1.json");
    const validate = new Ajv({strictTypes: false}).compile({definitions: schema.definitions, $ref: "#/definitions/region"});
    const region = {id: 1, points: [], rotation: 0, type: CARTA.RegionType.ANNULUS};

    test("accepts legacy regions and statistics settings without schema extensions", () => {
        expect(validate(region)).toBe(true);
        expect(validate({...region, statsArea: "annulus", statsBackground: "inner"})).toBe(true);
        expect(validate({...region, statsArea: "inner", statsBackground: "none"})).toBe(true);
    });
});
