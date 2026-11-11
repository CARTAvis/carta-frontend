import {afterEach, describe, expect, jest, test} from "@jest/globals";

import {CatalogDatabase, CatalogSystemType, RadiusUnits} from "enums";
import {type Workspace, type WorkspaceCatalogQuerySource} from "models";
import {CatalogApiService} from "services";
import {AppStore, MirrorSiteStore, type WorkspaceSourceWriteResult} from "stores";

import {getChangedFolderPrefix, WorkspacePreflightStore} from "./WorkspacePreflightStore";

/** The files that exist, by their paths relative to the top folder. */
function mockFiles(paths: string[], writeResult: WorkspaceSourceWriteResult = {state: "failed"}) {
    const exists = (directory: string, filename: string) => paths.includes(directory ? `${directory}/${filename}` : filename);
    const backendService = {
        getFileInfo: jest.fn(async (directory: string, filename: string) => ({success: exists(directory, filename)})),
        getCatalogFileInfo: jest.fn(async (directory: string, filename: string) => ({success: exists(directory, filename)}))
    };
    const writeWorkspaceSourceChanges = jest.fn(async (_name: string, _changes: unknown) => writeResult);
    jest.spyOn(AppStore, "Instance", "get").mockReturnValue({backendService, writeWorkspaceSourceChanges} as unknown as AppStore);
    return {backendService, writeWorkspaceSourceChanges};
}

const SIMBAD_QUERY: WorkspaceCatalogQuerySource = {type: "simbad", center: {x: 1, y: 2}, system: CatalogSystemType.ICRS, radius: 2, radiusUnits: RadiusUnits.ARCMINUTES, maxObjects: 50};

/** A workspace copied from another computer: its files were in /data/alice. */
function createWorkspace(overrides: Partial<Workspace> = {}): Workspace {
    return {
        workspaceVersion: 2,
        frontendVersion: 0,
        files: [
            {id: 1, source: {type: "file", directory: "data/alice/band6", filename: "cube.fits"}, regionsSet: {regions: [{id: 2, type: 3, rotation: 0, points: []}]}},
            {id: 2, source: {type: "lel", directory: "data/alice/band6", expression: 'cube.fits - "cont 1.fits"'}},
            {id: 3, source: {type: "hypercube", directory: "data/alice/pol", stokesFiles: [{filename: "q.fits"}, {filename: "u.fits"}]}}
        ],
        generatedImages: [{request: {type: "moment"} as never, images: [{id: 4, name: "Moment 0 of cube.fits"}]}],
        catalogs: [
            {id: 1, source: {type: "file", directory: "data/alice/catalogs", filename: "sources.xml"}, associatedImageId: 1},
            {id: 2, source: SIMBAD_QUERY, associatedImageId: 1}
        ],
        references: {spatial: 1, spectral: 1},
        layout: {} as never,
        ...overrides
    };
}

const MOVED = ["mnt/x/band6/cube.fits", "mnt/x/band6/cont 1.fits", "mnt/x/pol/q.fits", "mnt/x/pol/u.fits", "mnt/x/catalogs/sources.xml"];

afterEach(() => {
    jest.restoreAllMocks();
});

describe("getChangedFolderPrefix", () => {
    test("returns the parts of two folders that differ, when the folders end in the same names", () => {
        expect(getChangedFolderPrefix("data/alice/band6", "mnt/x/band6")).toEqual({from: "data/alice", to: "mnt/x"});
        expect(getChangedFolderPrefix("data/alice/band6", "mnt/other")).toEqual({from: "data/alice/band6", to: "mnt/other"});
        expect(getChangedFolderPrefix("band6", "share/band6")).toEqual({from: "band6", to: "share/band6"});
    });
});

describe("WorkspacePreflightStore", () => {
    test("lists the images with their files, regions and references, the catalogs, and the other settings", () => {
        mockFiles([]);
        const store = new WorkspacePreflightStore("copied", createWorkspace(), true);

        expect(store.images.map(({name, references, regionCount, isGenerated, hasParts}) => ({name, references, regionCount, isGenerated, hasParts}))).toEqual([
            {name: "cube.fits", references: "spatial, spectral reference", regionCount: 1, isGenerated: false, hasParts: false},
            {name: 'cube.fits - "cont 1.fits"', references: undefined, regionCount: 0, isGenerated: false, hasParts: true},
            {name: "q.fits, u.fits", references: undefined, regionCount: 0, isGenerated: false, hasParts: true},
            {name: "Moment 0 of cube.fits", references: undefined, regionCount: 0, isGenerated: true, hasParts: false}
        ]);
        expect(store.images[1].files.map(file => file.filename)).toEqual(["cube.fits", "cont 1.fits"]);
        expect(store.catalogs.map(({name, database}) => [name, database])).toEqual([
            ["sources.xml", undefined],
            ["SIMBAD query", CatalogDatabase.SIMBAD]
        ]);
        expect(store.regionCount).toBe(1);
        expect(store.restoredSettings).toEqual(["Layout", "Image matching"]);
    });

    test("finds the missing files, and opens the workspace without the images and catalogs that read them", async () => {
        mockFiles(["data/alice/band6/cube.fits", "data/alice/band6/cont 1.fits", "data/alice/pol/q.fits"]);
        const store = new WorkspacePreflightStore("copied", createWorkspace(), true);

        const checking = store.check();
        expect(store.isChecking).toBe(true);
        await checking;

        expect(store.missingFiles.map(file => file.filename)).toEqual(["u.fits", "sources.xml"]);
        expect(store.leftOut).toEqual({imageIds: [3], catalogIds: [1]});
        expect(store.leftOutCount).toBe(2);
        expect(store.preparedWorkspace).toBe(store["workspace"]);
    });

    test("moves the other missing files the way that the first file moved, also in other folders", async () => {
        mockFiles(MOVED);
        const store = new WorkspacePreflightStore("copied", createWorkspace(), true);
        await store.check();
        expect(store.missingFiles).toHaveLength(6);

        const cube = store.images[0].files[0];
        store.setLocation(cube, {directory: "mnt/x/band6", filename: "cube.fits"});
        const move = store.getFolderMove(cube, "data/alice/band6");
        expect(move.from).toBe("data/alice");
        expect(move.to).toBe("mnt/x");
        expect(move.files.map(file => file.filename)).toEqual(["cube.fits", "cont 1.fits", "q.fits", "u.fits", "sources.xml"]);
        store.moveFolder(move);
        await store.check();

        expect(store.missingFiles).toEqual([]);
        expect(store.leftOutCount).toBe(0);
        expect(store.files.map(file => store.statusOf(file))).toEqual(["moved", "moved", "moved", "moved", "moved", "moved"]);
        expect(store.preparedWorkspace.files!.map(file => file.source)).toEqual([
            {type: "file", directory: "mnt/x/band6", filename: "cube.fits", hdu: undefined},
            {type: "lel", directory: "mnt/x/band6", expression: 'cube.fits - "cont 1.fits"'},
            {
                type: "hypercube",
                directory: "data/alice/pol",
                stokesFiles: [
                    {filename: "q.fits", directory: "mnt/x/pol", hdu: undefined},
                    {filename: "u.fits", directory: "mnt/x/pol", hdu: undefined}
                ]
            }
        ]);
        expect(store.preparedWorkspace.catalogs![0].source).toEqual({type: "file", directory: "mnt/x/catalogs", filename: "sources.xml"});
        expect(store.changeDescriptions).toHaveLength(6);
    });

    test("does not count a name in brackets that no file has as missing, because it may name a region", async () => {
        mockFiles(["data/cube.fits"]);
        const store = new WorkspacePreflightStore(
            "lel",
            createWorkspace({
                files: [
                    {id: 1, source: {type: "lel", directory: "data", expression: "cube.fits[centre] + 'broken"}},
                    {id: 2, source: {type: "lel", directory: "data", expression: "cube.fits[centre]"}}
                ],
                generatedImages: [],
                catalogs: []
            }),
            true
        );

        await store.check();

        expect(store.images.map(image => image.isCheckedWhenOpened)).toEqual([true, false]);
        expect(store.images[1].files.map(file => [file.filename, store.statusOf(file)])).toEqual([
            ["cube.fits", "found"],
            ["centre", "region"]
        ]);
        expect(store.missingFiles).toEqual([]);
        expect(store.leftOutCount).toBe(0);
    });

    test("gives each image, each catalog and each group the level of its worst check", async () => {
        mockFiles(["data/alice/band6/cube.fits", "data/alice/band6/cont 1.fits", "data/alice/pol/q.fits", "data/alice/pol/u.fits"]);
        jest.spyOn(CatalogApiService.Instance, "benchmarkMirror").mockResolvedValue(null);
        const store = new WorkspacePreflightStore("copied", createWorkspace(), true);
        expect(store.imagesLevel).toBe("checking");

        await Promise.all([store.check(), store.testMirrors()]);

        expect(store.images.map(store.levelOfImage)).toEqual(["ok", "ok", "ok", "ok"]);
        expect(store.imagesLevel).toBe("ok");
        // The catalog file is missing, and the mirror of the query does not answer.
        expect(store.catalogs.map(store.levelOfCatalog)).toEqual(["left-out", "left-out"]);
        expect(store.catalogsLevel).toBe("left-out");
    });

    test("uses one new folder for every file of an expression", () => {
        mockFiles([]);
        const store = new WorkspacePreflightStore("copied", createWorkspace(), true);

        store.setLocation(store.images[1].files[1], {directory: "mnt/x/band6", filename: "renamed.fits"});

        expect(store.images[1].files.map(file => store.pathOf(file))).toEqual(["mnt/x/band6/cube.fits", "mnt/x/band6/cont 1.fits"]);
    });

    test("tests the mirror, and leaves out the online catalogs while it does not answer", async () => {
        mockFiles(MOVED);
        const [first, second] = MirrorSiteStore.Instance.getMirrorSites(CatalogDatabase.SIMBAD);
        const benchmark = jest.spyOn(CatalogApiService.Instance, "benchmarkMirror").mockImplementation(async (_database, mirror) => (mirror === second ? 400 : null));
        const store = new WorkspacePreflightStore("copied", createWorkspace({catalogMirrors: {[CatalogDatabase.SIMBAD]: first}}), true);

        await store.testMirrors();
        expect(store.mirrors.get(CatalogDatabase.SIMBAD)).toEqual({saved: first, chosen: first, state: "no-answer"});
        expect(store.leftOut.catalogIds).toContain(2);

        await store.testMirror(CatalogDatabase.SIMBAD, second);
        expect(benchmark).toHaveBeenLastCalledWith(CatalogDatabase.SIMBAD, second, 10000);
        expect(store.leftOut.catalogIds).not.toContain(2);
        expect(store.changes.mirrors).toEqual(new Map([[CatalogDatabase.SIMBAD, {from: first, to: second}]]));
        expect(store.preparedWorkspace.catalogMirrors).toEqual({[CatalogDatabase.SIMBAD]: second});
    });

    test("saves the new locations to the workspace, and then shows the files as found", async () => {
        const written = createWorkspace({files: [{id: 1, source: {type: "file", directory: "mnt/x/band6", filename: "cube.fits"}}], catalogs: []});
        const {writeWorkspaceSourceChanges} = mockFiles(MOVED, {state: "written", workspace: written});
        const store = new WorkspacePreflightStore("copied", createWorkspace({files: [{id: 1, source: {type: "file", directory: "data/alice/band6", filename: "cube.fits"}}], catalogs: []}), true);
        await store.check();
        const cube = store.images[0].files[0];
        store.setLocation(cube, {directory: "mnt/x/band6", filename: "cube.fits"});
        await store.check();

        await store.saveChanges();

        expect(writeWorkspaceSourceChanges).toHaveBeenCalledWith(
            "copied",
            expect.objectContaining({images: new Map([[1, {from: {type: "file", directory: "data/alice/band6", filename: "cube.fits"}, to: {type: "file", directory: "mnt/x/band6", filename: "cube.fits", hdu: undefined}}]])})
        );
        expect(store.hasSavedChanges).toBe(true);
        expect(store.changeDescriptions).toEqual([]);
        expect(store.statusOf(store.images[0].files[0])).toBe("found");
    });
});
