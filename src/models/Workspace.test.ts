import Ajv from "ajv";

import {describeImageSource, type Workspace, WORKSPACE_VERSION, WorkspaceConfig} from "./Workspace";

const WORKSPACE_SCHEMA = require("carta-schemas/workspace_schema_2.json");

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

describe("WorkspaceConfig.upgradeForRuntime image sources", () => {
    test("describes a legacy file as a file source", () => {
        const storedWorkspace = {
            workspaceVersion: 1,
            frontendVersion: "5.0.0",
            files: [{id: 0, directory: "images", filename: "image.fits", hdu: "1"}]
        } as unknown as Workspace;
        const originalJson = JSON.stringify(storedWorkspace);

        const runtimeWorkspace = WorkspaceConfig.upgradeForRuntime(storedWorkspace);

        expect(runtimeWorkspace.files?.[0].source).toEqual({type: "file", directory: "images", filename: "image.fits", hdu: "1"});
        expect(JSON.stringify(storedWorkspace)).toBe(originalJson);
    });

    test("leaves a source that is already there alone", () => {
        const storedWorkspace = {
            workspaceVersion: WORKSPACE_VERSION,
            frontendVersion: "5.0.0",
            files: [{id: 0, source: {type: "lel", directory: "images", expression: "image.fits*2"}}]
        } as unknown as Workspace;

        const runtimeWorkspace = WorkspaceConfig.upgradeForRuntime(storedWorkspace);

        expect(runtimeWorkspace.files?.[0].source).toEqual({type: "lel", directory: "images", expression: "image.fits*2"});
    });
});

describe("WorkspaceConfig.upgradeForRuntime catalog table config", () => {
    test("gives the table state back to the catalog it belongs to", () => {
        const storedWorkspace = {
            workspaceVersion: WORKSPACE_VERSION,
            frontendVersion: "5.0.0",
            catalogs: [
                {
                    id: 1,
                    source: {type: "file", filename: "sources.vot"},
                    displayConfig: {color: "#112233", maxRows: 25, sorting: {columnName: "Fmag", sortingType: 2}}
                }
            ]
        } as unknown as Workspace;
        const originalJson = JSON.stringify(storedWorkspace);

        const catalog = WorkspaceConfig.upgradeForRuntime(storedWorkspace).catalogs?.[0];

        expect(catalog?.tableConfig).toEqual({displayedColumns: undefined, maxRows: 25, columnSettings: undefined, sorting: {columnName: "Fmag", sortingType: 2}});
        expect(catalog?.displayConfig).toEqual({color: "#112233"});
        expect(JSON.stringify(storedWorkspace)).toBe(originalJson);
    });

    test("leaves a catalog whose table state is already its own alone", () => {
        const storedWorkspace = {
            workspaceVersion: WORKSPACE_VERSION,
            frontendVersion: "5.0.0",
            catalogs: [{id: 1, source: {type: "file", filename: "sources.vot"}, tableConfig: {maxRows: 25}, displayConfig: {color: "#112233"}}]
        } as unknown as Workspace;

        const catalog = WorkspaceConfig.upgradeForRuntime(storedWorkspace).catalogs?.[0];

        expect(catalog?.tableConfig).toEqual({maxRows: 25});
        expect(catalog?.displayConfig).toEqual({color: "#112233"});
    });
});

describe("workspace schema 2", () => {
    const validate = new Ajv({strictTypes: false, allErrors: true}).compile<Workspace>(WORKSPACE_SCHEMA);

    const catalog = {
        id: 1,
        source: {type: "file", directory: "catalogs", filename: "sources.vot"},
        coordinateSystem: "PIX1",
        associatedImageId: 0,
        rowCount: 42,
        tableConfig: {
            displayedColumns: ["RA", "DEC", "Fmag"],
            maxRows: 25,
            columnSettings: {Fmag: {filter: "> 2", width: 180}},
            sorting: {columnName: "Fmag", sortingType: 2}
        },
        selection: {columns: ["RA", "DEC", "Fmag"], rowHashes: ["1234567890abcdef"], searchRows: 25, isShowingSelectedData: true},
        displayConfig: {
            color: "#112233",
            size: 10,
            displayMode: "Custom",
            sizeAxis: {mapColumn: "Fmag", columnMinClip: 1, columnMaxClip: 10, scalingType: 1, scalingParameters: {log: 500}},
            colorAxis: {mapColumn: "Vmag", colorMap: "viridis", inverted: true},
            orientationAxis: {mapColumn: "PA", angleMin: 0, angleMax: 360},
            imageOverlay: {xAxis: "RA", yAxis: "DEC", system: "ICRS", maxRows: 20}
        }
    };

    function createWorkspace(overrides: Record<string, unknown> = {}) {
        return {
            workspaceVersion: WORKSPACE_VERSION,
            frontendVersion: "5.0.0",
            files: [{id: 0, source: {type: "file", filename: "image.fits"}}],
            ...overrides
        };
    }

    test("accepts every kind of image source", () => {
        const workspace = createWorkspace({
            files: [
                {id: 0, source: {type: "file", directory: "images", filename: "image.fits", hdu: "1"}},
                {id: 1, source: {type: "lel", directory: "images", expression: "image.fits*2"}},
                {
                    id: 2,
                    source: {
                        type: "hypercube",
                        directory: "images",
                        stokesFiles: [
                            {filename: "i.fits", polarizationType: 1},
                            {filename: "q.fits", polarizationType: 2}
                        ]
                    }
                }
            ]
        });

        expect(validate(workspace)).toBe(true);
    });

    test("accepts catalogs from a file and from an online query", () => {
        const workspace = createWorkspace({
            catalogs: [
                catalog,
                {id: 2, source: {type: "simbad", center: {x: 12.3, y: -45.6}, system: "ICRS", radius: 1, radiusUnits: "deg", maxObjects: 1000}, contentHash: "3f2a1b0c9d8e7f60"},
                {id: 3, source: {type: "vizier", center: {x: 12.3, y: -45.6}, system: "FK5", radius: 1, radiusUnits: "deg", maxObjects: 1000, table: "I/345/gaia2", keywords: "gaia"}}
            ],
            selectedCatalogId: 2,
            catalogWidgets: {
                "catalog-overlay-0": {type: "catalog-overlay", catalogId: 2, settingsTabs: {"2": 1}},
                "catalog-plot-0": {type: "catalog-plot", catalogId: 3, xColumnName: "RA", yColumnName: "DEC", nBinX: 10, fittingRange: {minVal: 0, maxVal: 1}}
            }
        });

        expect(validate(workspace)).toBe(true);
    });

    test("rejects a catalog widget entry that does not say what kind of widget it is", () => {
        const workspace = createWorkspace({catalogs: [catalog], catalogWidgets: {"catalog-overlay-0": {catalogId: 1}}});

        expect(validate(workspace)).toBe(false);
    });

    test("accepts the catalog display mode values written by the frontend", () => {
        for (const displayMode of ["Custom", "Angular size"]) {
            const workspace = createWorkspace({
                catalogs: [{...catalog, displayConfig: {...catalog.displayConfig, displayMode, orientationAxis: {angleMin: 0, angleMax: 720}}}]
            });
            expect(validate(workspace)).toBe(true);
        }
    });

    test("accepts the layout a workspace was arranged in", () => {
        const workspace = createWorkspace({
            layout: {layoutVersion: 2, docked: {type: "row", content: [{type: "component", id: "image-view"}]}, floating: []}
        });

        expect(validate(workspace)).toBe(true);
    });

    test("rejects an image with no source", () => {
        expect(validate(createWorkspace({files: [{id: 0, filename: "image.fits"}]}))).toBe(false);
    });

    test("rejects a catalog source that names neither a file nor a query", () => {
        expect(validate(createWorkspace({catalogs: [{id: 1, source: {type: "file"}}]}))).toBe(false);
    });

    test("accepts a legacy workspace once it has been upgraded", () => {
        const storedWorkspace = {
            workspaceVersion: 0,
            frontendVersion: "4.0.0",
            files: [{id: 0, directory: "images", filename: "image.fits"}]
        } as unknown as Workspace;

        expect(validate(storedWorkspace)).toBe(false);
        expect(validate(WorkspaceConfig.upgradeForRuntime(storedWorkspace))).toBe(true);
    });
});

describe("describeImageSource", () => {
    test("names a file, an expression and the images of a hypercube", () => {
        expect(describeImageSource({type: "file", filename: "image.fits"})).toBe("image.fits");
        expect(describeImageSource({type: "lel", expression: "image.fits*2"})).toBe("image.fits*2");
        expect(describeImageSource({type: "hypercube", stokesFiles: [{filename: "i.fits"}, {filename: "q.fits"}]})).toBe("i.fits, q.fits");
    });

    test("says so when there is nothing to name", () => {
        expect(describeImageSource(undefined)).toBe("an image of an unknown kind");
    });
});
