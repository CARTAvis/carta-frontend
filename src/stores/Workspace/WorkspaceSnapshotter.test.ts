import {afterEach, describe, expect, jest, test} from "@jest/globals";
import Ajv from "ajv";

import {CatalogSystemType, WorkspaceItemKind} from "enums";
import {AppStore, WorkspaceIdRegistry, WorkspaceSnapshotter} from "stores";

const WORKSPACE_SCHEMA = require("carta-schemas/workspace_schema_2.json");

/** What the snapshotter reads off an image it is capturing. */
function createFrame(fileId: number, overrides: Record<string, any> = {}) {
    return {
        id: fileId,
        frameInfo: {fileId, directory: "/data", hdu: "", fileInfo: {name: `image${fileId}.fits`}, lelExpr: undefined, generated: false},
        stokesFiles: undefined,
        center: {x: 10, y: 20},
        zoomLevel: 2,
        isAxisZoomable: false,
        effectiveZoomLevel: {x: 2, y: 2},
        zoomAxis: "both",
        channel: 3,
        stokes: 0,
        spatialReference: undefined,
        spectralReference: undefined,
        rasterScalingReference: undefined,
        regionSet: {regions: [], focusedRegion: undefined},
        renderConfig: {toConfig: jest.fn(() => ({colorMap: "inferno", bias: 0, contrast: 1}))},
        contourConfig: {toConfig: jest.fn(() => undefined)},
        vectorOverlayConfig: {toConfig: jest.fn(() => undefined)},
        ...overrides
    };
}

/** What the snapshotter reads off a loaded catalog. */
function createCatalog() {
    const catalogHeader = [{columnIndex: 0, name: "Name"}];
    const catalogData = new Map([[0, {dataType: 0, data: ["a", "b", "c"]}]]);
    return {
        catalogInfo: {fileId: 10, dataSize: 3, directory: "/data", fileInfo: {name: "sources.vot"}, query: undefined},
        isFileBasedCatalog: true,
        catalogCoordinateSystem: {system: CatalogSystemType.FK5},
        catalogHeader,
        catalogData,
        catalogOriginalData: catalogData,
        selectedPointIndices: [] as number[],
        getSortedIndices: jest.fn((indices: number[]) => indices),
        toTableConfig: jest.fn(() => ({displayedColumns: ["Name"], maxRows: 3}))
    };
}

/** A session for the snapshotter to capture, holding one image and one catalog overlaid on it. */
function createSession(overrides: Record<string, any> = {}) {
    // A session hands out file IDs from 0 while workspace IDs start at 1, so the fixture keeps the
    // two apart rather than letting an image's file ID pass for the ID the workspace knows it by.
    const frame = createFrame(0);
    const profileStore = createCatalog();
    const displayStore = {isShowingSelectedData: false, toConfig: jest.fn(() => ({color: "#ff0000", shape: 0}))};

    // The session gives an item its workspace ID when it opens it; saving only reads it back.
    WorkspaceIdRegistry.Instance.clear(WorkspaceItemKind.Image);
    WorkspaceIdRegistry.Instance.clear(WorkspaceItemKind.Catalog);
    WorkspaceIdRegistry.Instance.register(WorkspaceItemKind.Image, 0);
    WorkspaceIdRegistry.Instance.register(WorkspaceItemKind.Catalog, 10);

    const appStore = {
        frames: [frame],
        activeFrame: frame,
        activeFrameFileId: 0,
        spatialReference: undefined,
        spectralReference: undefined,
        rasterScalingReference: undefined,
        timeSeriesStore: {isMember: jest.fn(() => false)},
        imageViewConfigStore: {colorBlendingImageMap: new Map(), getImageListIndex: jest.fn(() => 0)},
        catalogStore: {
            imageIdOf: (catalogFileId: number): number | undefined => (catalogFileId === 10 ? 0 : undefined),
            catalogProfileStores: new Map<number, unknown>([[10, profileStore]]),
            getCatalogDisplayStore: jest.fn(() => displayStore),
            widgetBindings: {savedCatalogWidgets: jest.fn((): Record<string, unknown> => ({}))}
        },
        widgetsStore: {catalogWidgets: new Map()},
        layoutStore: {currentLayoutConfig: jest.fn(() => ({layoutVersion: 2, docked: {type: "row", content: [{type: "component", id: "image-view"}]}, floating: []}))},
        ...overrides
    };

    jest.spyOn(AppStore, "Instance", "get").mockReturnValue(appStore as any);
    return {appStore, frame, profileStore, displayStore};
}

describe("WorkspaceSnapshotter", () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test("captures a workspace that validates against the schema", () => {
        createSession();

        const {workspace, issues} = new WorkspaceSnapshotter().capture();

        expect(issues).toEqual([]);
        expect(new Ajv().compile(WORKSPACE_SCHEMA)(workspace)).toBe(true);
    });

    test("captures how each image was opened and how it is displayed", () => {
        createSession();

        const {workspace} = new WorkspaceSnapshotter().capture();

        expect(workspace.files).toHaveLength(1);
        expect(workspace.files?.[0]).toMatchObject({
            id: 1,
            source: {type: "file", directory: "/data", filename: "image0.fits"},
            center: {x: 10, y: 20},
            zoomLevel: 2,
            channel: 3,
            renderConfig: {colorMap: "inferno"}
        });
        expect(workspace.selectedFile).toBe(1);
    });

    test("captures a catalog against the image it is overlaid on", () => {
        createSession();

        const {workspace} = new WorkspaceSnapshotter().capture();

        expect(workspace.catalogs).toHaveLength(1);
        expect(workspace.catalogs?.[0]).toMatchObject({
            id: 1,
            source: {type: "file", filename: "sources.vot"},
            associatedImageId: 1,
            rowCount: 3,
            coordinateSystem: CatalogSystemType.FK5,
            tableConfig: {displayedColumns: ["Name"]},
            displayConfig: {color: "#ff0000"}
        });
        // Only an online catalog is fingerprinted, since it is queried again rather than stored.
        expect(workspace.catalogs?.[0].contentHash).toBeUndefined();
    });

    test("saves what each catalog widget shows", () => {
        const {appStore} = createSession();
        appStore.catalogStore.widgetBindings.savedCatalogWidgets.mockReturnValue({"widget-a": {type: "catalog-overlay", catalogId: 1}});

        const {workspace} = new WorkspaceSnapshotter().capture();

        expect(workspace.catalogWidgets).toEqual({"widget-a": {type: "catalog-overlay", catalogId: 1}});
    });

    test("saves no catalog widgets when no widget shows a loaded catalog", () => {
        const {workspace} = new WorkspaceSnapshotter().capture();

        expect(workspace.catalogWidgets).toBeUndefined();
    });

    test("reports a generated image instead of capturing it", () => {
        const generatedFrame = createFrame(2, {frameInfo: {fileId: 2, directory: "", hdu: "", fileInfo: {name: "moment.fits"}, generated: true}});
        const {appStore} = createSession();
        appStore.frames.push(generatedFrame as never);

        const {workspace, issues} = new WorkspaceSnapshotter().capture();

        expect(workspace.files?.map(file => file.id)).toEqual([1]);
        expect(issues).toEqual([{kind: WorkspaceItemKind.Image, subject: "", message: "The workspace contains generated files. These will not be preserved when reloading."}]);
    });

    test("reports a catalog overlaid on a generated image instead of saving it against an image the workspace does not carry", () => {
        const generatedFrame = createFrame(2, {frameInfo: {fileId: 2, directory: "", hdu: "", fileInfo: {name: "moment.fits"}, generated: true}});
        const {appStore} = createSession();
        appStore.frames.push(generatedFrame as never);
        // The session registers a generated image like any other, so its workspace ID resolves.
        WorkspaceIdRegistry.Instance.register(WorkspaceItemKind.Image, 2);
        jest.spyOn(appStore.catalogStore, "imageIdOf").mockReturnValue(2);

        const {workspace, issues} = new WorkspaceSnapshotter().capture();

        expect(workspace.catalogs).toEqual([]);
        expect(issues).toContainEqual({kind: WorkspaceItemKind.Catalog, subject: "sources.vot", message: "Could not save the catalog sources.vot: the image it is overlaid on was not saved"});
    });

    test("reports a catalog that no longer names an image instead of saving it without one", () => {
        const {appStore} = createSession();
        jest.spyOn(appStore.catalogStore, "imageIdOf").mockReturnValue(undefined);

        const {workspace, issues} = new WorkspaceSnapshotter().capture();

        expect(workspace.catalogs).toEqual([]);
        expect(issues).toContainEqual({kind: WorkspaceItemKind.Catalog, subject: "sources.vot", message: "Could not save the catalog sources.vot: the image it is overlaid on was not saved"});
    });

    test("reports a colour blend made from a generated image instead of saving it without that layer", () => {
        const generatedFrame = createFrame(2, {frameInfo: {fileId: 2, directory: "", hdu: "", fileInfo: {name: "moment.fits"}, generated: true}});
        const {appStore, frame} = createSession();
        appStore.frames.push(generatedFrame as never);
        // The session registers a generated image like any other, so its workspace ID resolves.
        WorkspaceIdRegistry.Instance.register(WorkspaceItemKind.Image, 2);
        appStore.imageViewConfigStore.colorBlendingImageMap = new Map([[0, {selectedFrames: [frame, generatedFrame], alpha: [1, 0.5, 0.5]}]]) as never;

        const {workspace, issues} = new WorkspaceSnapshotter().capture();

        expect(workspace.colorBlendingImages).toEqual([]);
        expect(issues).toContainEqual({
            kind: WorkspaceItemKind.ColorBlending,
            subject: "",
            message: "Could not save a colour-blended image: one of the images it is made of was not saved"
        });
    });

    test("carries the arrangement the session was saved in", () => {
        const {appStore} = createSession();

        const {workspace} = new WorkspaceSnapshotter().capture();

        expect(appStore.layoutStore.currentLayoutConfig).toHaveBeenCalled();
        expect(workspace.layout).toMatchObject({layoutVersion: 2});
    });

    test("reports an item the session never opened instead of giving it an ID", () => {
        createSession();
        WorkspaceIdRegistry.Instance.release(WorkspaceItemKind.Catalog, 10);

        const {workspace, issues} = new WorkspaceSnapshotter().capture();

        expect(workspace.catalogs).toEqual([]);
        expect(issues).toEqual([{kind: WorkspaceItemKind.Catalog, subject: "sources.vot", message: "Could not save the catalog sources.vot: it is not one this session opened"}]);
        // Capturing reads IDs; it does not allocate them.
        expect(WorkspaceIdRegistry.Instance.workspaceIdOf(WorkspaceItemKind.Catalog, 10)).toBeUndefined();
    });

    test("reports an online catalog there is no record of how to open again", () => {
        const {profileStore} = createSession();
        // Not a file, and the query it came from was never captured: nothing names it well enough
        // to run again, so the workspace cannot carry it.
        profileStore.isFileBasedCatalog = false;
        profileStore.catalogInfo.query = undefined;

        const {workspace, issues} = new WorkspaceSnapshotter().capture();

        expect(workspace.catalogs).toEqual([]);
        expect(issues).toEqual([{kind: WorkspaceItemKind.Catalog, subject: "sources.vot", message: "Could not save the catalog sources.vot: there is no record of how it was opened"}]);
    });

    test("returns a workspace detached from the session's own state", () => {
        const {frame} = createSession();

        const {workspace} = new WorkspaceSnapshotter().capture();
        frame.center.x = 999;

        expect(workspace.files?.[0].center).toEqual({x: 10, y: 20});
    });
});
