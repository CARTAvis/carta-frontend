import {afterEach, describe, expect, jest, test} from "@jest/globals";
import Ajv from "ajv";
import {CARTA} from "carta-protobuf";

import {CatalogDatabase, CatalogSystemType, ImageType, RegionId, WorkspaceItemKind} from "enums";
import {AppStore, MirrorSiteStore, WorkspaceIdRegistry, WorkspaceSnapshotter} from "stores";
import {ACTIVE_FILE_ID} from "stores/Widgets";

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
        // An image that is not shown keeps the channel and Stokes of its last tiles until it is shown.
        channel: 0,
        stokes: 0,
        requiredChannel: 3,
        requiredStokes: 1,
        spectralCoordsSupported: new Map([["Radio velocity (km/s)", {}]]),
        spectralCoordinate: "Radio velocity (km/s)",
        spectralCoordinateSecondary: "Channel",
        spectralSystem: "LSRK",
        intensityUnit: "Jy/beam",
        restFreqStore: {headerRestFreq: {value: 1.42, unit: "GHz"}, customRestFreq: {value: 1.42, unit: "GHz"}, isInvalidInput: false},
        isRestFrameSupported: false,
        beamProperties: undefined,
        isOffsetCoord: false,
        offsetCenter: undefined,
        spatialReference: undefined,
        spectralReference: undefined,
        rasterScalingReference: undefined,
        regionSet: {regions: [], focusedRegion: undefined},
        renderConfig: {toConfig: jest.fn(() => ({colorMap: "inferno", bias: 0, contrast: 1}))},
        contourConfig: {toConfig: jest.fn(() => undefined), toUnappliedConfig: jest.fn(() => undefined)},
        vectorOverlayConfig: {toConfig: jest.fn(() => undefined), toUnappliedConfig: jest.fn(() => undefined)},
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
        rows: {data: catalogData, originalData: catalogData, getSortedIndices: jest.fn((indices: number[]) => indices)},
        selectedPointIndices: [] as number[],
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
        animatorStore: {frameRate: 5, step: 1, playMode: 0, animationMode: 0},
        logStore: {logLevel: 1, hiddenTags: [] as string[]},
        isToolbarExpanded: true,
        activeLayer: "regionMoving",
        imageViewConfigStore: {colorBlendingImageMap: new Map(), getImageListIndex: jest.fn((_type: ImageType, _id: number) => 0)},
        catalogStore: {
            imageIdOf: (catalogFileId: number): number | undefined => (catalogFileId === 10 ? 0 : undefined),
            catalogProfileStores: new Map<number, unknown>([[10, profileStore]]),
            getCatalogDisplayStore: jest.fn(() => displayStore),
            widgetBindings: {savedCatalogWidgets: jest.fn((_savedCatalogIds: ReadonlySet<number>): Record<string, unknown> => ({}))}
        },
        widgetsStore: {
            catalogWidgets: new Map(),
            savedPlotWidgets: jest.fn((ids: {imageIdOf: (fileId: number) => number | undefined}): Record<string, unknown> => ({
                "stats-0": {type: "stats", imageId: ids.imageIdOf(0), coordinate: "z"},
                "stats-1": {type: "stats", imageId: ids.imageIdOf(5)}
            }))
        },
        getFrame: (fileId: number) => (fileId === 0 ? frame : undefined),
        // The Image Fitting dialog fits the active image over the field of view, as it does by default.
        imageFittingStore: {
            selectedFileId: ACTIVE_FILE_ID,
            selectedRegionId: 0,
            toWorkspaceConfig: jest.fn((imageId: number | undefined, regionId: number) => ({
                imageId,
                regionId,
                components: [],
                autoInitialValues: true,
                backgroundOffset: 0,
                backgroundOffsetFixed: true,
                solver: 0,
                createModelImage: false,
                createResidualImage: false
            }))
        },
        layoutStore: {
            isComponentHidden: jest.fn((_component: string) => false),
            currentLayoutConfig: jest.fn((_persistence?: string) => ({layoutVersion: 2, docked: {type: "row", content: [{type: "component", id: "image-view"}]}, floating: []}))
        },
        overlaySettings: {
            toTextConfig: jest.fn(() => ({labels: {hasCustomText: true, customLabelX: "Right ascension", customLabelY: ""}, title: {hasCustomText: true}, colorbar: {hasLabelCustomText: false}}))
        },
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

    test("captures how each image was opened and how it is displayed, with the channel and Stokes that it is set to", () => {
        createSession();

        const {workspace} = new WorkspaceSnapshotter().capture();

        expect(workspace.files).toHaveLength(1);
        expect(workspace.files?.[0]).toMatchObject({
            id: 1,
            source: {type: "file", directory: "/data", filename: "image0.fits"},
            center: {x: 10, y: 20},
            zoomLevel: 2,
            channel: 3,
            stokes: 1,
            renderConfig: {colorMap: "inferno"}
        });
        expect(workspace.selectedFile).toBe(1);
    });

    test("captures the spectral settings an image is shown in, leaving out a coordinate it does not support", () => {
        createSession();

        const {workspace} = new WorkspaceSnapshotter().capture();

        expect(workspace.files?.[0]).toMatchObject({spectralCoordinate: "Radio velocity (km/s)", spectralSystem: "LSRK", intensityUnit: "Jy/beam"});
        expect(workspace.files?.[0]).not.toHaveProperty("spectralCoordinateSecondary");
    });

    test("captures the rest frequency, rest frame, beam and offset coordinates an image is shown with", () => {
        const frame = createFrame(0, {
            restFreqStore: {headerRestFreq: {value: 1.42, unit: "GHz"}, customRestFreq: {value: 230.5, unit: "GHz"}, isInvalidInput: false},
            isRestFrameSupported: true,
            isRestFrameEnabled: true,
            isRestFrameShiftInputValid: true,
            restFrameRedshift: 0.01,
            restFrameShiftMode: "redshift",
            restFrameVelocityConvention: "optical",
            beamProperties: {},
            overlayBeamSettings: {isVisible: false, color: "#00ff00", type: "solid", width: 2, shiftX: 3, shiftY: -4},
            isOffsetCoord: true,
            offsetCenter: {x: 5, y: 6},
            skyRefIs: 1
        });
        createSession({frames: [frame], activeFrame: frame});

        const {workspace} = new WorkspaceSnapshotter().capture();

        expect(workspace.files?.[0]).toMatchObject({
            restFrequency: {value: 230.5, unit: "GHz"},
            restFrame: {enabled: true, redshift: 0.01, shiftMode: "redshift", velocityConvention: "optical"},
            beam: {visible: false, color: "#00ff00", type: "solid", width: 2, shiftX: 3, shiftY: -4},
            offsetCoordinates: {center: {x: 5, y: 6}, skyRefIs: 1, shown: true}
        });
        expect(new Ajv().compile(WORKSPACE_SCHEMA)(JSON.parse(JSON.stringify(workspace)))).toBe(true);
    });

    test("saves the rest frame as not applied while the shift entered for it is one the controls rejected", () => {
        const frame = createFrame(0, {isRestFrameSupported: true, isRestFrameEnabled: true, isRestFrameShiftInputValid: false, restFrameRedshift: 0.01, restFrameShiftMode: "redshift", restFrameVelocityConvention: "optical"});
        createSession({frames: [frame], activeFrame: frame});

        const {workspace} = new WorkspaceSnapshotter().capture();

        expect(workspace.files?.[0].restFrame).toEqual({enabled: false, redshift: 0.01, shiftMode: "redshift", velocityConvention: "optical"});
    });

    test("leaves out the header's rest frequency, an unsupported rest frame, a beam the image lacks and offset coordinates never turned on", () => {
        createSession();

        const {workspace} = new WorkspaceSnapshotter().capture();

        for (const field of ["restFrequency", "restFrame", "beam", "offsetCoordinates"]) {
            expect(workspace.files?.[0]).not.toHaveProperty(field);
        }
    });

    test("captures the center of offset coordinates that are turned off", () => {
        const frame = createFrame(0, {isOffsetCoord: false, offsetCenter: {x: 5, y: 6}, skyRefIs: 0});
        createSession({frames: [frame], activeFrame: frame});

        const {workspace} = new WorkspaceSnapshotter().capture();

        expect(workspace.files?.[0].offsetCoordinates).toEqual({center: {x: 5, y: 6}, skyRefIs: 0, shown: false});
        expect(new Ajv().compile(WORKSPACE_SCHEMA)(JSON.parse(JSON.stringify(workspace)))).toBe(true);
    });

    test("leaves the offset coordinates of an image matched to another to that image", () => {
        const reference = createFrame(0);
        const matched = createFrame(1, {spatialReference: reference, isOffsetCoord: true, offsetCenter: {x: 5, y: 6}, skyRefIs: 0});
        WorkspaceIdRegistry.Instance.clear(WorkspaceItemKind.Image);
        createSession({frames: [reference, matched], activeFrame: reference, getFrame: (fileId: number) => [reference, matched][fileId]});
        WorkspaceIdRegistry.Instance.register(WorkspaceItemKind.Image, 1);

        const {workspace} = new WorkspaceSnapshotter().capture();

        expect(workspace.files?.[1]).not.toHaveProperty("offsetCoordinates");
    });

    test("captures the sample width of a line region, and of no other kind", () => {
        const region = (regionId: number, regionType: CARTA.RegionType) => ({
            regionId,
            regionType,
            rotation: 0,
            controlPoints: [{x: 0, y: 0}],
            name: "",
            color: "#ffffff",
            lineWidth: 2,
            isLocked: false,
            dashLength: 0,
            lineRegionSampleWidth: 5,
            coordinate: "World"
        });
        const frame = createFrame(0, {regionSet: {regions: [region(1, CARTA.RegionType.LINE), region(2, CARTA.RegionType.RECTANGLE)], focusedRegion: undefined}});
        createSession({frames: [frame], activeFrame: frame});

        const {workspace} = new WorkspaceSnapshotter().capture();

        expect(workspace.files?.[0].regionsSet?.regions?.map(saved => saved.lineRegionSampleWidth)).toEqual([5, undefined]);
        // The Region dialog shows each region in the coordinates that the user chose.
        expect(workspace.files?.[0].regionsSet?.regions?.map(saved => saved.coordinate)).toEqual(["World", "World"]);
        expect(new Ajv().compile(WORKSPACE_SCHEMA)(JSON.parse(JSON.stringify(workspace)))).toBe(true);
    });

    test("saves a rotation that is not a number as 0, so that the workspace is valid", () => {
        const ruler = {
            regionId: 1,
            regionType: CARTA.RegionType.ANNRULER,
            rotation: NaN,
            controlPoints: [
                {x: 5, y: 5},
                {x: 5, y: 5}
            ],
            name: "",
            color: "#ffffff",
            lineWidth: 2,
            isLocked: false,
            dashLength: 0
        };
        const frame = createFrame(0, {regionSet: {regions: [ruler], focusedRegion: undefined}});
        createSession({frames: [frame], activeFrame: frame});

        const {workspace} = new WorkspaceSnapshotter().capture();

        expect(workspace.files?.[0].regionsSet?.regions?.[0].rotation).toBe(0);
        expect(new Ajv().compile(WORKSPACE_SCHEMA)(JSON.parse(JSON.stringify(workspace)))).toBe(true);
    });

    test("captures how opaque a region is drawn, leaving it out for a region that is shown", () => {
        const region = (regionId: number, opacity: number) => ({
            regionId,
            regionType: CARTA.RegionType.RECTANGLE,
            rotation: 0,
            controlPoints: [{x: 0, y: 0}],
            name: "",
            color: "#ffffff",
            lineWidth: 2,
            isLocked: false,
            dashLength: 0,
            opacity
        });
        const frame = createFrame(0, {regionSet: {regions: [region(1, 1), region(2, 0.5), region(3, 0)], focusedRegion: undefined}});
        createSession({frames: [frame], activeFrame: frame});

        const {workspace} = new WorkspaceSnapshotter().capture();

        expect(workspace.files?.[0].regionsSet?.regions?.map(saved => saved.opacity)).toEqual([undefined, 0.5, 0]);
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
        // A catalog file is not queried, so no mirror is saved.
        expect(workspace.catalogMirrors).toBeUndefined();
    });

    test("saves the mirror that an online catalog was queried from", () => {
        const {profileStore} = createSession();
        profileStore.isFileBasedCatalog = false;
        (profileStore.catalogInfo as {query: unknown}).query = {type: "simbad", center: {x: 1, y: 2}, system: CatalogSystemType.ICRS, radius: 2, radiusUnits: "arcmin", maxObjects: 10};
        const mirror = MirrorSiteStore.Instance.getActiveMirror(CatalogDatabase.SIMBAD);

        const {workspace} = new WorkspaceSnapshotter().capture();

        expect(mirror).toBeDefined();
        expect(workspace.catalogMirrors).toEqual({[CatalogDatabase.SIMBAD]: mirror});
    });

    test("saves the rows selected in a catalog, and whether only they are shown", () => {
        const {profileStore, displayStore} = createSession();
        profileStore.selectedPointIndices = [1];
        displayStore.isShowingSelectedData = true;

        const {workspace, issues} = new WorkspaceSnapshotter().capture();

        expect(issues).toEqual([]);
        expect(workspace.catalogs?.[0].selection).toMatchObject({columns: ["Name"], isShowingSelectedData: true});
        expect(workspace.catalogs?.[0].selection?.rowHashes).toHaveLength(1);
    });

    test("captures the same workspace twice in a row, so that the check of the Workspace dialog leaves the session as it was", () => {
        createSession();

        const first = new WorkspaceSnapshotter().capture();
        new WorkspaceSnapshotter().findIssues();
        const second = new WorkspaceSnapshotter().capture();

        expect({...second.workspace, date: 0}).toEqual({...first.workspace, date: 0});
        expect(second.issues).toEqual(first.issues);
    });

    test("leaves out a selection of more rows than a workspace keeps, and says so", () => {
        const {profileStore, displayStore} = createSession();
        profileStore.selectedPointIndices = Array.from({length: WorkspaceSnapshotter.MAX_SAVED_SELECTED_ROWS + 1}, (_, index) => index);
        displayStore.isShowingSelectedData = true;

        const {workspace, issues} = new WorkspaceSnapshotter().capture();

        expect(workspace.catalogs?.[0].selection).toBeUndefined();
        expect(issues).toEqual([expect.objectContaining({kind: WorkspaceItemKind.CatalogSelection, message: expect.stringContaining(`${WorkspaceSnapshotter.MAX_SAVED_SELECTED_ROWS + 1} rows are selected`)})]);
        // The check of the Workspace dialog finds the same issue, without the fingerprints of the rows.
        expect(new WorkspaceSnapshotter().findIssues()).toEqual(issues);
    });

    test("saves what each catalog widget shows", () => {
        const {appStore} = createSession();
        appStore.catalogStore.widgetBindings.savedCatalogWidgets.mockReturnValue({"widget-a": {type: "catalog-overlay", catalogId: 1}});

        const {workspace} = new WorkspaceSnapshotter().capture();

        expect(workspace.catalogWidgets).toEqual({"widget-a": {type: "catalog-overlay", catalogId: 1}});
        expect(appStore.catalogStore.widgetBindings.savedCatalogWidgets).toHaveBeenCalledWith(new Set(workspace.catalogs?.map(catalog => catalog.id)));
    });

    test("saves what each profile and analysis widget shows, naming only the images the workspace carries", () => {
        createSession();

        const {workspace} = new WorkspaceSnapshotter().capture();

        expect(workspace.plotWidgets).toEqual({"stats-0": {type: "stats", imageId: 1, coordinate: "z"}, "stats-1": {type: "stats"}});
        expect(new Ajv().compile(WORKSPACE_SCHEMA)(JSON.parse(JSON.stringify(workspace)))).toBe(true);
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
        expect(issues).toEqual([
            {kind: WorkspaceItemKind.Image, subject: "", message: "The workspace contains generated files. These will not be preserved when reloading.", hint: "To keep such an image, save it as a file and open the file instead"}
        ]);
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
        // Nor may a widget showing it name it.
        expect(appStore.catalogStore.widgetBindings.savedCatalogWidgets).toHaveBeenCalledWith(new Set());
    });

    test("reports a catalog that no longer names an image instead of saving it without one", () => {
        const {appStore} = createSession();
        jest.spyOn(appStore.catalogStore, "imageIdOf").mockReturnValue(undefined);

        const {workspace, issues} = new WorkspaceSnapshotter().capture();

        expect(workspace.catalogs).toEqual([]);
        expect(issues).toContainEqual({kind: WorkspaceItemKind.Catalog, subject: "sources.vot", message: "Could not save the catalog sources.vot: the image it is overlaid on was not saved"});
    });

    test("reports a color blend made from a generated image instead of saving it without that layer", () => {
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
            message: "Could not save a color-blended image: one of the images it is made of was not saved"
        });
    });

    test("saves the image of the Contour dialog only when the dialog does not follow the active image", () => {
        const {appStore, frame} = createSession();
        Object.assign(appStore, {isFrameLockedToContour: false, contourDataSource: frame});

        expect(new WorkspaceSnapshotter().capture().workspace.contourDataSource).toEqual({imageId: 1});

        Object.assign(appStore, {isFrameLockedToContour: true});
        expect(new WorkspaceSnapshotter().capture().workspace).not.toHaveProperty("contourDataSource");
    });

    test("saves the animator settings, and the channels it plays of an image only when they are not every channel", () => {
        const {appStore, frame} = createSession();
        Object.assign(appStore.animatorStore, {frameRate: 8, step: 2, playMode: 2, animationMode: 1, numericInputType: "Step"});
        Object.assign(frame, {animationChannelRange: [2, 5], frameInfo: {...frame.frameInfo, fileInfoExtended: {depth: 10}}});

        const {workspace} = new WorkspaceSnapshotter().capture();

        expect(workspace.animator).toEqual({frameRate: 8, step: 2, playMode: 2, mode: 1, numericInputType: "Step"});
        expect(workspace.files?.[0].animationChannelRange).toEqual([2, 5]);

        Object.assign(frame, {animationChannelRange: [0, 9]});
        expect(new WorkspaceSnapshotter().capture().workspace.files?.[0]).not.toHaveProperty("animationChannelRange");
    });

    test("saves the level and the hidden tags of the Log widget", () => {
        const {appStore} = createSession();
        Object.assign(appStore.logStore, {logLevel: 2, hiddenTags: ["Region"]});

        const {workspace} = new WorkspaceSnapshotter().capture();

        expect(workspace.log).toEqual({level: 2, hiddenTags: ["Region"]});
    });

    test("saves the open dialogs from the bottom one to the top one, with the Preferences dialog, and leaves out the dialogs of one step", () => {
        const zIndexes = new Map([
            ["contour-dialog", 3],
            ["region-dialog", 1],
            ["file-browser-dialog", 2],
            ["preference-dialog", 4]
        ]);
        createSession({
            dialogStore: {dialogVisible: new Map([...zIndexes.keys()].map(id => [id, true]))},
            zIndexManager: {findIndex: (id: string) => zIndexes.get(id) ?? 0}
        });

        const {workspace} = new WorkspaceSnapshotter().capture();
        expect(workspace.openDialogs).toEqual(["region-dialog", "contour-dialog", "preference-dialog"]);
        expect(workspace).not.toHaveProperty("dialogs");
    });

    test("saves the name of the snippet that the open Snippet dialog shows, and nothing for a new snippet", () => {
        const snippetStore = {activeSnippetName: "Open a file"};
        createSession({dialogStore: {dialogVisible: new Map([["snippet-dialog", true]])}, snippetStore});

        expect(new WorkspaceSnapshotter().capture().workspace.dialogSettings).toEqual({snippet: {name: "Open a file"}});

        snippetStore.activeSnippetName = "";
        expect(new WorkspaceSnapshotter().capture().workspace).not.toHaveProperty("dialogSettings");
    });

    test("reports the code in the Snippet dialog that is not saved as a snippet", () => {
        const saved = {code: "app.openFile('a.fits')", categories: []};
        const snippetStore = {activeSnippetName: "Open a file", activeSnippet: {...saved}, snippets: new Map([["Open a file", saved]])};
        createSession({dialogStore: {dialogVisible: new Map([["snippet-dialog", true]])}, snippetStore});
        const messages = () => new WorkspaceSnapshotter().capture().issues.map(issue => issue.message);
        const unsaved = "Could not save the code in the Snippet dialog: it is not saved as a snippet";

        expect(messages()).not.toContain(unsaved);

        // The code of the saved snippet changed. The workspace still names the snippet.
        snippetStore.activeSnippet.code = "app.openFile('b.fits')";
        expect(messages()).toContain(unsaved);
        expect(new WorkspaceSnapshotter().capture().workspace.dialogSettings).toEqual({snippet: {name: "Open a file"}});

        // A new snippet with code, and an empty new snippet.
        snippetStore.activeSnippetName = "";
        expect(messages()).toContain(unsaved);
        snippetStore.activeSnippet.code = " ";
        expect(messages()).not.toContain(unsaved);

        // The Save mode of the Workspace dialog lists it before the save, with what to do.
        snippetStore.activeSnippet.code = "app.openFile('c.fits')";
        expect(new WorkspaceSnapshotter().findIssues()).toContainEqual({kind: "layout", subject: "Snippet", message: unsaved, hint: "Save the snippet first, then save the workspace"});
    });

    test("saves the name of an example that the Snippet dialog shows, and nothing for an example whose code changed", () => {
        const example = {code: "app.openFile('a.fits')", tags: ["example"], categories: ["Examples"]};
        const snippetStore = {activeSnippetName: "", activeSnippet: {...example}, snippets: new Map([["02. Basics", example]])};
        createSession({dialogStore: {dialogVisible: new Map([["snippet-dialog", true]])}, snippetStore});

        expect(new WorkspaceSnapshotter().capture().workspace.dialogSettings).toEqual({snippet: {name: "02. Basics"}});

        snippetStore.activeSnippet.code = "app.openFile('b.fits')";
        expect(new WorkspaceSnapshotter().capture().workspace).not.toHaveProperty("dialogSettings");
    });

    test("saves how many floating widgets are below each open dialog, counting the viewer of a PV preview", () => {
        const zIndexes = new Map([
            ["stats-0", 1],
            ["region-dialog", 2],
            ["histogram-0", 4],
            ["pv-generator-0-pv-preview-0", 5],
            ["contour-dialog", 6]
        ]);
        const {appStore} = createSession({
            dialogStore: {
                dialogVisible: new Map([
                    ["region-dialog", true],
                    ["contour-dialog", true]
                ])
            },
            zIndexManager: {findIndex: (id: string) => zIndexes.get(id) ?? 0}
        });
        (appStore.widgetsStore as any).floatingWidgets = [{id: "stats-0"}, {id: "histogram-0"}, {id: "pv-generator-0-pv-preview-0", type: "pv-preview", parentId: "pv-generator-0"}];

        expect(new WorkspaceSnapshotter().capture().workspace.dialogs).toEqual({"region-dialog": {widgetsBelow: 1}, "contour-dialog": {widgetsBelow: 3}});

        // A catalog plot is stacked by its component ID, so above the region dialog here.
        zIndexes.set("catalog-plot-component-0", 3);
        (appStore.widgetsStore as any).floatingWidgets.push({id: "catalog-plot-0", componentId: "catalog-plot-component-0"});
        expect(new WorkspaceSnapshotter().capture().workspace.dialogs).toEqual({"region-dialog": {widgetsBelow: 1}, "contour-dialog": {widgetsBelow: 4}});
    });

    test("saves where an open dialog is and the name of the tab that it shows, when the user moved it and chose a tab", () => {
        createSession({
            dialogStore: {
                dialogVisible: new Map([
                    ["contour-dialog", true],
                    ["file-info-dialog", true],
                    ["preference-dialog", true]
                ]),
                dialogGeometries: new Map([["contour-dialog", {x: 100, y: 50, width: 600, height: 700}]]),
                selectedTabOf: (id: string) => ({"contour-dialog": 2, "file-info-dialog": "image-header", "preference-dialog": 1})[id],
                fileInfoSearchString: "CRVAL"
            },
            zIndexManager: {findIndex: () => 0}
        });

        expect(new WorkspaceSnapshotter().capture().workspace.dialogs).toEqual({
            "contour-dialog": {x: 100, y: 50, width: 600, height: 700, tab: "Styling"},
            "file-info-dialog": {tab: "image-header", search: "CRVAL"},
            "preference-dialog": {tab: "RENDER_CONFIG"}
        });
    });

    test("saves the settings that the Contour and Vector Overlay dialogs show but that are not applied, by the image that they are for", () => {
        const unappliedContourConfig = {levels: [], thickness: 3};
        const frame = createFrame(0, {contourConfig: {toConfig: jest.fn(() => undefined), toUnappliedConfig: jest.fn(() => unappliedContourConfig)}});
        createSession({
            frames: [frame],
            activeFrame: frame,
            dialogStore: {
                dialogVisible: new Map(),
                unappliedSettingsOf: (id: string) => (id === "contour-dialog" ? {frame, values: {levels: [1, 2], smoothingMode: 0, smoothingFactor: 1}} : undefined)
            }
        });

        const {workspace} = new WorkspaceSnapshotter().capture();

        expect(workspace.files[0].unappliedContourConfig).toEqual(unappliedContourConfig);
        expect(workspace.dialogSettings).toEqual({contour: {imageId: workspace.files[0].id, levels: [1, 2], smoothingMode: 0, smoothingFactor: 1}});
    });

    test("saves the floating settings panels of widgets from the bottom one to the top one, by the stable IDs of the widgets, with the floating widgets below each, and leaves out a PV preview", () => {
        const zIndexes = new Map([
            ["spectral-profiler-0-settings", 4],
            ["spectral-profiler-0", 3],
            ["image-view-settings", 2],
            ["pv-preview", 1]
        ]);
        createSession({
            widgetsStore: {
                floatingWidgets: [
                    {
                        type: "floating-settings",
                        id: "spectral-profiler-0-settings",
                        parentId: "spectral-profiler-0",
                        parentType: "spectral-profiler",
                        title: "Z Profile Settings: Region #1 ",
                        defaultX: 0,
                        defaultY: 30,
                        defaultWidth: 650,
                        defaultHeight: 400
                    },
                    {type: "floating-settings", id: "image-view-settings", parentId: "image-view", parentType: "image-view", title: "Image View Settings", defaultX: 25, defaultY: 25, defaultWidth: 400, defaultHeight: 300},
                    {type: "pv-preview", id: "pv-generator-0-pv-preview-0", parentId: "pv-generator-0", parentType: "pv-generator", title: "PV Preview Viewer"},
                    {type: "spectral-profiler", id: "spectral-profiler-0"}
                ],
                workspaceIdOf: (type: string, id: string) => (id === "spectral-profiler-0" ? "spectral-profiler-3" : id),
                catalogWidgets: new Map(),
                savedPlotWidgets: () => ({})
            },
            zIndexManager: {findIndex: (id: string) => zIndexes.get(id) ?? 0}
        });

        expect(new WorkspaceSnapshotter().capture().workspace.openWidgetSettings).toEqual([
            {widgetId: "image-view", widgetType: "image-view", title: "Image View", x: 25, y: 25, width: 400, height: 300, widgetsBelow: 1},
            {widgetId: "spectral-profiler-3", widgetType: "spectral-profiler", title: "Z Profile", x: 0, y: 30, width: 650, height: 400, widgetsBelow: 2}
        ]);
    });

    test("saves the spectral coordinate that spectrally matched images are matched by", () => {
        createSession({spectralMatchingType: "FREQ"});

        expect(new WorkspaceSnapshotter().capture().workspace.spectralMatchingType).toBe("FREQ");
    });

    describe("generated images", () => {
        /** A moment image of the session's image, made over a region by the request given. */
        function createMomentImage(fileId: number, request: object, moment: CARTA.Moment) {
            WorkspaceIdRegistry.Instance.register(WorkspaceItemKind.Image, fileId);
            return createFrame(fileId, {
                frameInfo: {fileId, directory: "", hdu: "", fileInfo: {name: `image0.fits.moment.${moment}`}, generated: true},
                generation: {request, moment}
            });
        }

        function momentRequestOf(source: unknown, regionId = 5) {
            return {
                type: "moment",
                source,
                regionId,
                moments: [CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM, CARTA.Moment.MAX_OF_THE_SPECTRUM],
                channelRange: {min: 2, max: 8},
                mask: CARTA.MomentMask.Include,
                pixelRange: {min: 0.1, max: 1}
            };
        }

        test("saves the request once, naming its image and region by the IDs the workspace knows them by", () => {
            const {appStore, frame} = createSession();
            frame.regionSet = {regions: [{regionId: 5, regionType: CARTA.RegionType.RECTANGLE, controlPoints: [], rotation: 0, isTemporary: false}], focusedRegion: undefined} as never;
            const request = momentRequestOf(frame);
            appStore.frames.push(createMomentImage(3, request, CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM) as never, createMomentImage(4, request, CARTA.Moment.MAX_OF_THE_SPECTRUM) as never);

            const {workspace, issues} = new WorkspaceSnapshotter().capture();

            expect(issues).toEqual([]);
            expect(workspace.files?.map(file => file.id)).toEqual([1]);
            expect(workspace.generatedImages).toEqual([
                {
                    request: {
                        type: "moment",
                        sourceImageId: 1,
                        regionId: 5,
                        moments: [CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM, CARTA.Moment.MAX_OF_THE_SPECTRUM],
                        channelRange: {min: 2, max: 8},
                        mask: CARTA.MomentMask.Include,
                        pixelRange: {min: 0.1, max: 1}
                    },
                    images: [
                        expect.objectContaining({id: 2, name: `image0.fits.moment.${CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM}`, moment: CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM, renderConfig: {colorMap: "inferno", bias: 0, contrast: 1}}),
                        expect.objectContaining({id: 3, moment: CARTA.Moment.MAX_OF_THE_SPECTRUM})
                    ]
                }
            ]);
            expect(workspace.generatedImages?.[0].images[0]).not.toHaveProperty("source");
            const validate = new Ajv().compile(WORKSPACE_SCHEMA);
            validate(workspace);
            expect(validate.errors).toBeNull();
        });

        test("saves only the moments whose images are still shown", () => {
            const {appStore, frame} = createSession();
            appStore.frames.push(createMomentImage(3, momentRequestOf(frame, RegionId.IMAGE), CARTA.Moment.MAX_OF_THE_SPECTRUM) as never);

            const {workspace} = new WorkspaceSnapshotter().capture();

            expect(workspace.generatedImages?.[0].request).toMatchObject({regionId: RegionId.IMAGE, moments: [CARTA.Moment.MAX_OF_THE_SPECTRUM]});
        });

        test("reports a request whose region has been deleted, and saves nothing that names its images", () => {
            const {appStore, frame} = createSession();
            const momentImage = createMomentImage(3, momentRequestOf(frame), CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM);
            appStore.frames.push(momentImage as never);
            appStore.activeFrame = momentImage as never;

            const {workspace, issues} = new WorkspaceSnapshotter().capture();

            expect(issues).toEqual([
                {
                    kind: WorkspaceItemKind.GeneratedImage,
                    subject: "the moment images of image0.fits",
                    message: "Could not save the moment images of image0.fits: the region it was made over has been deleted",
                    // The Workspace dialog shows the hint before the user saves.
                    hint: "Draw the region again, make the image again, and close the old one"
                }
            ]);
            expect(workspace.generatedImages).toBeUndefined();
            expect(workspace.selectedFile).toBeUndefined();
        });

        test("saves a request whose region has been deleted when the request kept the shape of the region", () => {
            const {appStore, frame} = createSession();
            const regionShape = {
                regionType: CARTA.RegionType.RECTANGLE,
                controlPoints: [
                    {x: 50, y: 50},
                    {x: 20, y: 20}
                ],
                rotation: 0
            };
            const momentImage = createMomentImage(3, {...momentRequestOf(frame), regionShape, regionShapeOwner: frame}, CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM);
            appStore.frames.push(momentImage as never);

            const {workspace, issues} = new WorkspaceSnapshotter().capture();

            expect(issues).toEqual([]);
            expect(workspace.generatedImages?.[0].request).toEqual(expect.objectContaining({type: "moment", regionShape: {...regionShape, imageId: 1}}));
        });

        test("reports a request whose region has been deleted when the image that the shape of the region is in is closed", () => {
            const {appStore, frame} = createSession();
            const regionShape = {
                regionType: CARTA.RegionType.RECTANGLE,
                controlPoints: [
                    {x: 50, y: 50},
                    {x: 20, y: 20}
                ],
                rotation: 0
            };
            const closedImage = createFrame(8);
            const momentImage = createMomentImage(3, {...momentRequestOf(frame), regionShape, regionShapeOwner: closedImage}, CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM);
            appStore.frames.push(momentImage as never);

            const {workspace, issues} = new WorkspaceSnapshotter().capture();

            expect(issues.map(issue => issue.message)).toEqual(["Could not save the moment images of image0.fits: the region it was made over has been deleted"]);
            expect(workspace.generatedImages).toBeUndefined();
        });

        test("saves a request made of an image another request made after that one, whatever order the session lists them in", () => {
            const {appStore} = createSession();
            const hips = createFrame(6, {frameInfo: {fileId: 6, directory: "", hdu: "", fileInfo: {name: "DSS2.fits"}, generated: true}});
            WorkspaceIdRegistry.Instance.register(WorkspaceItemKind.Image, 6);
            const momentImage = createMomentImage(7, momentRequestOf(hips, RegionId.IMAGE), CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM);
            (hips as any).generation = {request: {type: "hips", query: {hips: "CDS/P/DSS2/red", width: 100, height: 80, ra: 10, dec: -20, fov: 1, coordsys: "icrs", projection: "TAN", rotationAngle: 0}}};
            appStore.frames.push(momentImage as never, hips as never);

            const {workspace, issues} = new WorkspaceSnapshotter().capture();

            expect(issues).toEqual([]);
            expect(workspace.generatedImages?.map(generated => generated.request)).toEqual([
                {type: "hips", survey: "CDS/P/DSS2/red", width: 100, height: 80, object: undefined, center: {x: 10, y: -20}, fov: 1, coordsys: "icrs", projection: "TAN", rotationAngle: 0},
                expect.objectContaining({type: "moment", sourceImageId: 2})
            ]);
        });

        test("reports a request made of a generated image there is no record of how to make", () => {
            const {appStore} = createSession();
            const fittedModel = createFrame(6, {frameInfo: {fileId: 6, directory: "", hdu: "", fileInfo: {name: "model.fits"}, generated: true}});
            WorkspaceIdRegistry.Instance.register(WorkspaceItemKind.Image, 6);
            appStore.frames.push(fittedModel as never, createMomentImage(7, momentRequestOf(fittedModel, RegionId.IMAGE), CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM) as never);

            const {workspace, issues} = new WorkspaceSnapshotter().capture();

            expect(issues.map(issue => issue.message)).toEqual([
                "Could not save the moment images of model.fits: the image it was made from was not saved",
                "The workspace contains generated files. These will not be preserved when reloading."
            ]);
            expect(workspace.generatedImages).toBeUndefined();
        });

        test("reports a request whose image is matched to an image that is not saved, apart from a request whose own image is not saved", () => {
            const {appStore, frame} = createSession();
            const fittedModel = createFrame(6, {frameInfo: {fileId: 6, directory: "", hdu: "", fileInfo: {name: "model.fits"}, generated: true}});
            WorkspaceIdRegistry.Instance.register(WorkspaceItemKind.Image, 6);
            (frame as any).spatialReference = fittedModel;
            appStore.frames.push(fittedModel as never, createMomentImage(7, momentRequestOf(frame, RegionId.IMAGE), CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM) as never);

            const {issues} = new WorkspaceSnapshotter().capture();

            expect(issues[0]).toEqual({
                kind: WorkspaceItemKind.GeneratedImage,
                subject: "the moment images of image0.fits",
                message: "Could not save the moment images of image0.fits: the image it was made from is matched to an image that was not saved",
                hint: "Match the image it was made from to an image that can be saved, or stop matching it"
            });
            // The check of the Workspace dialog finds the same issues.
            expect(new WorkspaceSnapshotter().findIssues()).toEqual(issues);
        });

        test("reports moment images it cannot tell apart once some of them are closed", () => {
            const {appStore, frame} = createSession();
            const request = {...momentRequestOf(frame, RegionId.IMAGE), moments: [CARTA.Moment.MEDIAN_COORDINATE, CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM, CARTA.Moment.MAX_OF_THE_SPECTRUM]};
            const momentImage = createMomentImage(3, request, CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM);
            (momentImage as any).generation = {request};
            appStore.frames.push(momentImage as never);

            const {workspace, issues} = new WorkspaceSnapshotter().capture();

            expect(issues.map(issue => issue.message)).toEqual(["Could not save the moment images of image0.fits: it cannot tell which moment each of its images is"]);
            expect(workspace.generatedImages).toBeUndefined();
        });

        test("saves a PV request with the cut it was made along", () => {
            const {appStore, frame} = createSession();
            frame.regionSet = {regions: [{regionId: 4, regionType: CARTA.RegionType.LINE, controlPoints: [], isTemporary: false}], focusedRegion: undefined} as never;
            WorkspaceIdRegistry.Instance.register(WorkspaceItemKind.Image, 3);
            const pvImage = createFrame(3, {
                frameInfo: {fileId: 3, directory: "", hdu: "", fileInfo: {name: "image0_pv.fits"}, generated: true},
                generation: {request: {type: "pv", source: frame, regionId: 4, width: 3, channelRange: undefined, reverse: true}}
            });
            appStore.frames.push(pvImage as never);

            const {workspace} = new WorkspaceSnapshotter().capture();

            expect(workspace.generatedImages?.[0]).toEqual({
                request: {type: "pv", sourceImageId: 1, regionId: 4, width: 3, channelRange: undefined, reverse: true},
                images: [expect.objectContaining({id: 2, name: "image0_pv.fits"})]
            });
        });

        test("saves the shape that the cut had when the PV image was made, as a copy", () => {
            const {appStore, frame} = createSession();
            frame.regionSet = {regions: [{regionId: 4, regionType: CARTA.RegionType.LINE, controlPoints: [], isTemporary: false}], focusedRegion: undefined} as never;
            WorkspaceIdRegistry.Instance.register(WorkspaceItemKind.Image, 3);
            const regionShape = {
                regionType: CARTA.RegionType.LINE,
                controlPoints: [
                    {x: 10, y: 10},
                    {x: 90, y: 90}
                ],
                rotation: 45
            };
            const pvImage = createFrame(3, {
                frameInfo: {fileId: 3, directory: "", hdu: "", fileInfo: {name: "image0_pv.fits"}, generated: true},
                generation: {request: {type: "pv", source: frame, regionId: 4, width: 3, channelRange: undefined, reverse: true, regionShape, regionShapeOwner: frame}}
            });
            appStore.frames.push(pvImage as never);

            const saved = new WorkspaceSnapshotter().capture().workspace.generatedImages?.[0].request;

            // The shape names the image whose pixels it is in.
            expect(saved).toEqual(expect.objectContaining({regionId: 4, regionShape: {...regionShape, imageId: 1}}));
            expect((saved as {regionShape: typeof regionShape}).regionShape.controlPoints).not.toBe(regionShape.controlPoints);
        });
    });

    test("saves an image fitting with the model and residual images it made, and an initial value that the backend generates as null", () => {
        const {appStore, frame} = createSession();
        const request = {
            type: "fitting",
            source: frame,
            regionId: 0,
            fovInfo: {
                regionType: CARTA.RegionType.RECTANGLE,
                rotation: 30,
                controlPoints: [
                    {x: 10, y: 20},
                    {x: 40, y: 30}
                ]
            },
            initialValues: [{center: {x: 12, y: NaN}, amp: 1.5, fwhm: {x: 3, y: 2}, pa: NaN}],
            fixedParams: [false, false, true, false, false, false, true],
            offset: 0.1,
            solver: CARTA.FittingSolverType.Qr
        };
        for (const [fileId, fittingImage] of [
            [3, "model"],
            [4, "residual"]
        ] as const) {
            WorkspaceIdRegistry.Instance.register(WorkspaceItemKind.Image, fileId);
            appStore.frames.push(createFrame(fileId, {frameInfo: {fileId, directory: "", hdu: "", fileInfo: {name: `image0_${fittingImage}.fits`}, generated: true}, generation: {request, fittingImage}}) as never);
        }

        const {workspace, issues} = new WorkspaceSnapshotter().capture();

        expect(issues).toEqual([]);
        expect(workspace.generatedImages).toEqual([
            {
                request: {
                    type: "fitting",
                    sourceImageId: 1,
                    regionId: 0,
                    fov: {center: {x: 10, y: 20}, size: {x: 40, y: 30}, rotation: 30},
                    components: [{center: {x: 12, y: null}, amp: 1.5, fwhm: {x: 3, y: 2}, pa: null}],
                    fixedParams: [false, false, true, false, false, false, true],
                    offset: 0.1,
                    solver: CARTA.FittingSolverType.Qr
                },
                images: [expect.objectContaining({id: 2, name: "image0_model.fits", fittingImage: "model"}), expect.objectContaining({id: 3, name: "image0_residual.fits", fittingImage: "residual"})]
            }
        ]);
    });

    test("saves the place of each image in the image list", () => {
        const {appStore} = createSession();
        appStore.imageViewConfigStore.getImageListIndex.mockReturnValue(3);

        expect(new WorkspaceSnapshotter().capture().workspace.files?.[0].imageListIndex).toBe(3);
        expect(appStore.imageViewConfigStore.getImageListIndex).toHaveBeenCalledWith(ImageType.FRAME, 0);
    });

    test("saves the result of the last image fitting of an image, with a rotation that is not finite as 0", () => {
        const {frame} = createSession();
        Object.assign(frame, {
            fittingResult: "Component #1",
            fittingLog: "the log",
            fittingResultRegionParams: [
                {
                    points: [
                        {x: 1, y: 2},
                        {x: 2, y: 2.5}
                    ],
                    rotation: NaN
                }
            ]
        });

        const {workspace} = new WorkspaceSnapshotter().capture();

        expect(workspace.files?.[0].fitResult).toEqual({result: "Component #1", log: "the log", ellipses: [{center: {x: 1, y: 2}, size: {x: 2, y: 2.5}, rotation: 0}]});
    });

    test("saves the image that the Image Fitting dialog fits by its workspace ID, and the active image over the field of view when that image is not saved", () => {
        const {appStore} = createSession();
        Object.assign(appStore.imageFittingStore, {selectedFileId: 0, selectedRegionId: 5});

        expect(new WorkspaceSnapshotter().capture().workspace.imageFitting).toEqual(expect.objectContaining({imageId: 1, regionId: 5}));

        Object.assign(appStore.imageFittingStore, {selectedFileId: 7});
        appStore.getFrame = (fileId: number) => (fileId === 7 ? (createFrame(7) as never) : undefined);
        const imageFitting = new WorkspaceSnapshotter().capture().workspace.imageFitting;
        expect(imageFitting?.imageId).toBeUndefined();
        expect(imageFitting?.regionId).toBe(0);
    });

    test("captures the color-blended image in front by the image list index it is saved at", () => {
        const {appStore, frame} = createSession();
        const colorBlending = {id: 0, selectedFrames: [frame], alpha: [1, 0.5]};
        appStore.imageViewConfigStore.colorBlendingImageMap = new Map([[0, colorBlending]]) as never;
        appStore.imageViewConfigStore.getImageListIndex = jest.fn(() => 1);
        (appStore as any).activeImage = {type: ImageType.COLOR_BLENDING, store: colorBlending};

        const {workspace} = new WorkspaceSnapshotter().capture();

        expect(workspace.colorBlendingImages).toEqual([{imageListIndex: 1, selectedFrameId: [1], alpha: [1, 0.5]}]);
        expect(workspace.selectedColorBlending).toBe(1);
        expect(new Ajv().compile(WORKSPACE_SCHEMA)(workspace)).toBe(true);
    });

    test("saves the layers of a color-blended image that are hidden", () => {
        const {appStore, frame} = createSession();
        const colorBlending = {id: 0, selectedFrames: [frame], alpha: [1, 0.5], isRasterVisible: true, isContourVisible: false, isVectorOverlayVisible: false};
        appStore.imageViewConfigStore.colorBlendingImageMap = new Map([[0, colorBlending]]) as never;

        expect(new WorkspaceSnapshotter().capture().workspace.colorBlendingImages?.[0]).toEqual({imageListIndex: 0, selectedFrameId: [1], alpha: [1, 0.5], contourVisible: false, vectorOverlayVisible: false});
    });

    test("leaves out a region that the backend refused, also from the selection, and reports it", () => {
        const {frame} = createSession();
        const region = (regionId: number, name = "") => ({regionId, regionType: CARTA.RegionType.RECTANGLE, rotation: 0, controlPoints: [{x: 0, y: 0}], name, color: "#ffffff", lineWidth: 2, isLocked: false, dashLength: 0});
        Object.assign(frame.regionSet, {regions: [region(0), region(5), region(-1, "box"), region(-2)], selectedRegionIds: new Set([5, -1]), focusedRegion: {regionId: -1}});

        const {workspace, issues} = new WorkspaceSnapshotter().capture();

        expect(workspace.files?.[0].regionsSet?.regions?.map(saved => saved.id)).toEqual([5]);
        expect(workspace.files?.[0].regionsSet?.selectedRegion).toBeUndefined();
        expect(workspace.files?.[0].regionsSet).not.toHaveProperty("selectedRegions");
        expect(issues.map(issue => issue.message)).toEqual([
            `Could not save the region "box" of ${frame.frameInfo.fileInfo.name}: the backend has not accepted the region`,
            `Could not save a region of ${frame.frameInfo.fileInfo.name}: the backend has not accepted the region`
        ]);
        expect(new WorkspaceSnapshotter().findIssues()).toEqual(issues);
        expect(new Ajv().compile(WORKSPACE_SCHEMA)(JSON.parse(JSON.stringify(workspace)))).toBe(true);
    });

    test("saves the regions that are selected together, and where the cursor is, frozen or not", () => {
        const {appStore, frame} = createSession();
        const region = (regionId: number) => ({regionId, regionType: CARTA.RegionType.RECTANGLE, rotation: 0, controlPoints: [{x: 0, y: 0}], name: "", color: "#ffffff", lineWidth: 2, isLocked: false, dashLength: 0});
        Object.assign(frame.regionSet, {regions: [region(5), region(6)], selectedRegionIds: new Set([5, 6]), focusedRegion: {regionId: 6}});
        Object.assign(appStore, {isCursorFrozen: true});
        Object.assign(frame, {cursorInfo: {posImageSpace: {x: 3, y: 4}}});

        const {workspace} = new WorkspaceSnapshotter().capture();

        expect(workspace.files?.[0].regionsSet).toMatchObject({selectedRegion: 6, selectedRegions: [5, 6]});
        expect(workspace.cursor).toEqual({frozen: true, position: {x: 3, y: 4}});

        Object.assign(appStore, {isCursorFrozen: false});
        expect(new WorkspaceSnapshotter().capture().workspace.cursor).toEqual({frozen: false, position: {x: 3, y: 4}});

        Object.assign(frame, {cursorInfo: {posImageSpace: {x: NaN, y: 4}}});
        expect(new WorkspaceSnapshotter().capture().workspace.cursor).toEqual({frozen: false});

        Object.assign(appStore, {isCursorMirrored: true});
        expect(new WorkspaceSnapshotter().capture().workspace.cursor).toEqual({frozen: false, mirrored: true});
    });

    test("saves the auto spatial matching of moment images only when it is off", () => {
        const {appStore} = createSession();

        expect(new WorkspaceSnapshotter().capture().workspace).not.toHaveProperty("momentAutoMatching");

        Object.assign(appStore, {shouldMatchMoment: false});
        expect(new WorkspaceSnapshotter().capture().workspace.momentAutoMatching).toBe(false);
    });

    test("saves the image that the Beam tab shows only when it is not the image in front", () => {
        const other = createFrame(1);
        WorkspaceIdRegistry.Instance.register(WorkspaceItemKind.Image, 1);
        const {appStore, frame} = createSession();
        const beam = {selectedFileId: 1};
        Object.assign(appStore, {frames: [frame, other], getFrame: (fileId: number) => [frame, other].find(f => f.frameInfo.fileId === fileId), overlaySettings: {...(appStore as any).overlaySettings, beam}});

        const imageId = WorkspaceIdRegistry.Instance.workspaceIdOf(WorkspaceItemKind.Image, 1);
        expect(new WorkspaceSnapshotter().capture().workspace.beamSettingsImageId).toBe(imageId);

        beam.selectedFileId = 0;
        expect(new WorkspaceSnapshotter().capture().workspace).not.toHaveProperty("beamSettingsImageId");
    });

    test("saves the image toolbar: whether it is expanded, the active layer, and the type of a new region of the image in front", () => {
        const {appStore, frame} = createSession();
        Object.assign(appStore, {isToolbarExpanded: false, activeLayer: "regionCreating"});
        Object.assign(frame.regionSet, {newRegionType: CARTA.RegionType.ELLIPSE, mode: 1});

        expect(new WorkspaceSnapshotter().capture().workspace.toolbar).toEqual({expanded: false, activeLayer: "regionCreating", newRegionType: CARTA.RegionType.ELLIPSE, regionMode: 1});
    });

    test("names no color-blended image in front when the one there could not be saved", () => {
        const generatedFrame = createFrame(2, {frameInfo: {fileId: 2, directory: "", hdu: "", fileInfo: {name: "moment.fits"}, generated: true}});
        const {appStore, frame} = createSession();
        WorkspaceIdRegistry.Instance.register(WorkspaceItemKind.Image, 2);
        const colorBlending = {id: 0, selectedFrames: [frame, generatedFrame], alpha: [1, 0.5, 0.5]};
        appStore.imageViewConfigStore.colorBlendingImageMap = new Map([[0, colorBlending]]) as never;
        (appStore as any).activeImage = {type: ImageType.COLOR_BLENDING, store: colorBlending};

        const {workspace} = new WorkspaceSnapshotter().capture();

        expect(workspace.selectedColorBlending).toBeUndefined();
    });

    test("saves the image of the rest frequency tab of the Image List by its place among the images that the workspace saves", () => {
        const {appStore} = createSession();
        // The second image is a generated image that the workspace does not save.
        const unsaved = createFrame(5, {frameInfo: {fileId: 5, directory: "/data", hdu: "", fileInfo: {name: "unsaved.fits"}, lelExpr: undefined, generated: true}});
        const second = createFrame(6);
        WorkspaceIdRegistry.Instance.register(WorkspaceItemKind.Image, 6);
        (appStore as any).frames = [appStore.frames[0], unsaved, second];
        const layoutWith = (index: number) => ({
            layoutVersion: 2,
            docked: {type: "row", content: [{type: "stack", content: [{type: "component", id: "layer-list", widgetSettings: {settingsTabId: 1, restFrequencyImageIndex: index, columnWidths: [1, 2, 3, 4, 5]}}]}]},
            floating: []
        });
        const savedIndex = (index: number) => {
            (appStore.layoutStore.currentLayoutConfig as jest.Mock).mockReturnValue(layoutWith(index));
            return new WorkspaceSnapshotter().capture().workspace.layout.docked.content[0].content[0].widgetSettings.restFrequencyImageIndex;
        };

        expect(savedIndex(0)).toBe(0);
        expect(savedIndex(2)).toBe(1);
        expect(savedIndex(1)).toBeUndefined();
    });

    test("carries the arrangement the session was saved in, in its own copy of the layout", () => {
        const {appStore} = createSession();

        const {workspace} = new WorkspaceSnapshotter().capture();

        expect(appStore.layoutStore.currentLayoutConfig).toHaveBeenCalledWith("workspace");
        expect(workspace.layout).toMatchObject({layoutVersion: 2});
    });

    test("leaves the floating viewer of a PV preview out of the layout, because a restore makes the preview again", () => {
        const {appStore} = createSession();
        (appStore.layoutStore.currentLayoutConfig as jest.Mock).mockReturnValue({
            layoutVersion: 2,
            docked: {type: "row", content: [{type: "component", id: "image-view"}]},
            floating: [
                {type: "component", id: "stats"},
                {type: "component", id: "pv-preview"}
            ]
        });

        expect(new WorkspaceSnapshotter().capture().workspace.layout.floating).toEqual([{type: "component", id: "stats"}]);
    });

    test("keeps a docked viewer of a PV preview that names its PV generator", () => {
        const {appStore} = createSession();
        const viewer = {type: "component", id: "pv-preview", widgetSettings: {pvGeneratorId: "pv-generator-0"}};
        (appStore.layoutStore.currentLayoutConfig as jest.Mock).mockReturnValue({
            layoutVersion: 2,
            docked: {type: "row", content: [{type: "stack", content: [{type: "component", id: "image-view"}, viewer]}]},
            floating: []
        });

        expect(new WorkspaceSnapshotter().capture().workspace.layout.docked.content[0].content).toEqual([{type: "component", id: "image-view"}, viewer]);
    });

    test("leaves a docked viewer of a PV preview that names no PV generator out of the layout, keeps the shown tab on its widget and removes a container left empty", () => {
        const {appStore} = createSession();
        (appStore.layoutStore.currentLayoutConfig as jest.Mock).mockReturnValue({
            layoutVersion: 2,
            docked: {
                type: "row",
                content: [
                    {
                        type: "stack",
                        activeItemIndex: 2,
                        content: [
                            {type: "component", id: "pv-generator-0-pv-preview"},
                            {type: "component", id: "image-view"},
                            {type: "component", id: "stats"}
                        ]
                    },
                    {type: "column", content: [{type: "stack", content: [{type: "component", id: "pv-generator-1-pv-preview"}]}]},
                    {
                        type: "stack",
                        activeItemIndex: 1,
                        content: [
                            {type: "component", id: "histogram"},
                            {type: "component", id: "pv-generator-0-pv-preview"}
                        ]
                    }
                ]
            },
            floating: []
        });

        expect(new WorkspaceSnapshotter().capture().workspace.layout.docked).toEqual({
            type: "row",
            content: [
                {
                    type: "stack",
                    activeItemIndex: 1,
                    content: [
                        {type: "component", id: "image-view"},
                        {type: "component", id: "stats"}
                    ]
                },
                {type: "stack", content: [{type: "component", id: "histogram"}]}
            ]
        });
    });

    test("saves the size of the image view, and leaves it out when the image view is not shown", () => {
        const frame = createFrame(0, {renderWidth: 640, renderHeight: 400});
        createSession({frames: [frame], activeFrame: frame, devicePixelRatio: 2, pixelRatio: 4, fullViewWidth: 700, fullViewHeight: 480});
        const {workspace} = new WorkspaceSnapshotter().capture();
        expect(workspace.imageView).toEqual({width: 640, height: 400, devicePixelRatio: 2, fullWidth: 700, fullHeight: 480, viewport: {width: window.innerWidth, height: window.innerHeight}});
        expect(new Ajv().compile(WORKSPACE_SCHEMA)(workspace)).toBe(true);

        const hidden = createFrame(0, {renderWidth: 1, renderHeight: 1});
        createSession({frames: [hidden], activeFrame: hidden, devicePixelRatio: 2});
        expect(new WorkspaceSnapshotter().capture().workspace.imageView).toBeUndefined();
    });

    test("leaves out the size of an image view that is closed or behind another tab, because it keeps the size from when it was last shown", () => {
        const frame = createFrame(0, {renderWidth: 640, renderHeight: 400});
        const {appStore} = createSession({frames: [frame], activeFrame: frame, devicePixelRatio: 1});
        appStore.layoutStore.isComponentHidden.mockReturnValue(true);

        expect(new WorkspaceSnapshotter().capture().workspace.imageView).toBeUndefined();
        expect(appStore.layoutStore.isComponentHidden).toHaveBeenCalledWith("image-view");
    });

    test("saves the size of an image in the image view while a PV preview is active, because the preview is drawn in the PV generator", () => {
        const frame = createFrame(0, {renderWidth: 640, renderHeight: 400});
        const preview = createFrame(5, {renderWidth: 300, renderHeight: 200, isPreview: true});
        createSession({frames: [frame], activeFrame: preview, devicePixelRatio: 1, fullViewWidth: 700, fullViewHeight: 480});

        expect(new WorkspaceSnapshotter().capture().workspace.imageView).toMatchObject({width: 640, height: 400});
    });

    test("saves the custom texts of the WCS overlay, and the custom title and colorbar label of each image, but not the default ones", () => {
        const {frame} = createSession();
        Object.assign(frame, {titleCustomText: "M51 in Halpha", defaultTitleText: "image0.fits", colorbarLabelCustomText: "Jy/beam", defaultColorbarLabelText: "Jy/beam"});

        const {workspace} = new WorkspaceSnapshotter().capture();

        expect(workspace.wcsOverlay).toEqual({labels: {hasCustomText: true, customLabelX: "Right ascension", customLabelY: ""}, title: {hasCustomText: true}, colorbar: {hasLabelCustomText: false}});
        expect(workspace.files?.[0].titleCustomText).toBe("M51 in Halpha");
        expect(workspace.files?.[0]).not.toHaveProperty("colorbarLabelCustomText");
        Object.assign(frame, {titleCustomText: "image0.fits", colorbarLabelCustomText: "flux"});
        const saved = new WorkspaceSnapshotter().capture().workspace.files?.[0];
        expect(saved).not.toHaveProperty("titleCustomText");
        expect(saved?.colorbarLabelCustomText).toBe("flux");
    });

    test("saves the name of each color-blended image, and its custom title but not the default one", () => {
        const custom = {selectedFrames: [], alpha: [1], filename: "Color Blending 1", titleCustomText: "RGB of M51"};
        const plain = {selectedFrames: [], alpha: [1], filename: "Color Blending 2", titleCustomText: "Color Blending 2"};
        createSession({
            imageViewConfigStore: {
                colorBlendingImageMap: new Map([
                    [0, custom],
                    [1, plain]
                ]),
                getImageListIndex: jest.fn((_type: unknown, id: number) => id + 1)
            }
        });

        const {workspace} = new WorkspaceSnapshotter().capture();

        expect(workspace.colorBlendingImages).toEqual([
            {name: "Color Blending 1", imageListIndex: 1, selectedFrameId: [], alpha: [1], titleCustomText: "RGB of M51"},
            {name: "Color Blending 2", imageListIndex: 2, selectedFrameId: [], alpha: [1]}
        ]);
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
