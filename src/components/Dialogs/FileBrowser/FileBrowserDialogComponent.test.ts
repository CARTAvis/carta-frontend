import {type Mock, rs} from "@rstest/core";
import {CARTA} from "carta-protobuf";

import {BrowserMode, FrequencyUnit} from "enums";
import {AppStore, CatalogProfileStore, FileBrowserStore, type ISelectedFile} from "stores";
import {type FrameStore} from "stores/Frame";

import {FileBrowserDialogComponent} from "./FileBrowserDialogComponent";

interface TestableFileBrowserDialogComponent {
    imageArithmeticString: string;
    loadSelectedFiles: Mock<() => Promise<FrameStore[]>>;
    loadAsTimeSeries: () => Promise<void>;
    loadFile: (file: ISelectedFile) => Promise<FrameStore | undefined>;
    loadExpression: () => Promise<FrameStore>;
    loadComplexImage: (filename: string, expression: string) => Promise<FrameStore>;
    handleSaveFile: (shouldOverwrite?: boolean) => Promise<void>;
    handleExportRegionsClicked: () => Promise<void>;
    handleOverwriteAlertConfirmed: () => Promise<void>;
}

describe("FileBrowserDialogComponent", () => {
    afterEach(() => {
        rs.restoreAllMocks();
    });

    describe("top-level directory", () => {
        let fileBrowserStore: FileBrowserStore;
        let appStore: AppStore;
        let component: TestableFileBrowserDialogComponent;

        beforeEach(() => {
            fileBrowserStore = {
                browserMode: BrowserMode.File,
                fileList: {directory: ""},
                catalogFileList: {directory: ""},
                saveStartingDirectory: rs.fn(),
                setImportingRegions: rs.fn(),
                showLoadingDialog: rs.fn(),
                resetLoadingStates: rs.fn(),
                saveFilename: "image.fits",
                saveFileType: CARTA.FileType.FITS,
                saveRegionId: 0,
                saveStokesRange: [],
                shouldDropDegenerateAxes: false,
                saveRestFreqInHz: 1,
                exportFilename: "regions.crtf",
                exportCoordinateType: CARTA.CoordinateType.WORLD,
                exportFileType: CARTA.FileType.CRTF,
                exportRegionIndexes: [1]
            } as unknown as FileBrowserStore;
            appStore = {
                fileBrowserStore,
                frames: [{}],
                activeFrame: {numChannels: 1, headerRestFreq: 2},
                openFile: rs.fn(),
                appendFile: rs.fn(),
                appendCatalog: rs.fn(),
                importRegion: rs.fn(),
                saveFile: rs.fn(),
                exportRegions: rs.fn()
            } as unknown as AppStore;
            rs.spyOn(AppStore, "Instance", "get").mockReturnValue(appStore);
            rs.spyOn(FileBrowserStore, "Instance", "get").mockReturnValue(fileBrowserStore);
            component = new FileBrowserDialogComponent({}) as unknown as TestableFileBrowserDialogComponent;
        });

        test.each([false, true])("loads an image with append=%s", async isAppendingFrame => {
            fileBrowserStore.isAppendingFrame = isAppendingFrame;
            await component.loadFile({fileInfo: {name: "image.fits"}, hdu: "0"});

            expect(isAppendingFrame ? appStore.appendFile : appStore.openFile).toHaveBeenCalledWith("", "image.fits", "0");
        });

        test("loads a catalog", async () => {
            fileBrowserStore.browserMode = BrowserMode.Catalog;
            await component.loadFile({fileInfo: {name: "catalog.fits"}});

            expect(appStore.appendCatalog).toHaveBeenCalledWith("", "catalog.fits", CatalogProfileStore.INIT_TABLE_ROWS);
        });

        test("imports regions", async () => {
            fileBrowserStore.browserMode = BrowserMode.RegionImport;
            await component.loadFile({fileInfo: {name: "regions.crtf", type: CARTA.FileType.CRTF}});

            expect(appStore.importRegion).toHaveBeenCalledWith("", "regions.crtf", CARTA.FileType.CRTF);
        });

        test("loads an image arithmetic expression", async () => {
            component.imageArithmeticString = '"image.fits" * 2';
            await component.loadExpression();

            expect(appStore.openFile).toHaveBeenCalledWith("", '"image.fits" * 2', "", true);
        });

        test("loads a complex image", async () => {
            await component.loadComplexImage("image.fits", "AMPLITUDE");

            expect(appStore.openFile).toHaveBeenCalledWith("", 'AMPLITUDE("image.fits")', "", true);
        });

        test.each([false, true])("saves an image with overwrite=%s", async shouldOverwrite => {
            await component.handleSaveFile(shouldOverwrite);

            expect(appStore.saveFile).toHaveBeenCalledWith("", "image.fits", CARTA.FileType.FITS, 0, [], [], false, 1, shouldOverwrite);
        });

        test.each([false, true])("exports regions with overwrite=%s", async shouldOverwrite => {
            fileBrowserStore.browserMode = BrowserMode.RegionExport;
            if (shouldOverwrite) {
                await component.handleOverwriteAlertConfirmed();
            } else {
                await component.handleExportRegionsClicked();
            }

            expect(appStore.exportRegions).toHaveBeenCalledWith("", "regions.crtf", CARTA.CoordinateType.WORLD, CARTA.FileType.CRTF, [1], shouldOverwrite);
        });

        test.each([null, undefined])("rejects a missing image directory (%s)", async directory => {
            fileBrowserStore.fileList = {directory};

            await expect(component.loadFile({fileInfo: {name: "image.fits"}})).rejects.toThrow("No directory selected");
            expect(appStore.openFile).not.toHaveBeenCalled();
        });

        test.each([null, undefined])("rejects a missing catalog directory (%s)", async directory => {
            fileBrowserStore.browserMode = BrowserMode.Catalog;
            fileBrowserStore.catalogFileList = {directory, parent: null, files: [], subdirectories: []};

            await expect(component.loadFile({fileInfo: {name: "catalog.fits"}})).rejects.toThrow("No catalog directory selected");
            expect(appStore.appendCatalog).not.toHaveBeenCalled();
        });
    });

    test("handleSaveFile refuses a cube with a nonlinear spectral axis", async () => {
        const saveFile = rs.fn();
        const activeFrame = {isSpectralAxisNonlinear: true, restFreqStore: {customRestFreq: {value: NaN, unit: FrequencyUnit.HZ}}};
        rs.spyOn(AppStore, "Instance", "get").mockReturnValue({activeFrame, saveFile} as unknown as AppStore);

        const component = new FileBrowserDialogComponent({}) as unknown as TestableFileBrowserDialogComponent;
        await expect(component.handleSaveFile()).rejects.toThrow("Not available for nonlinear spectral axes");
        expect(saveFile).not.toHaveBeenCalled();
    });

    test("loadAsTimeSeries spatially matches only the newly loaded frames in append mode", async () => {
        const spatialReference = {filename: "reference.fits"} as FrameStore;
        const existingFrame = {filename: "existing.fits"} as FrameStore;
        const loadedFrameA = {filename: "loaded-a.fits"} as FrameStore;
        const loadedFrameB = {filename: "loaded-b.fits"} as FrameStore;
        const loadedFrames = [loadedFrameA, loadedFrameB];
        const setSpatialMatchingEnabled = rs.fn(async (frame: FrameStore) => {
            frame.spatialReference = spatialReference;
        });
        const setTimeSeriesMember = rs.fn();

        rs.spyOn(AppStore, "Instance", "get").mockReturnValue({
            frames: [spatialReference, existingFrame, ...loadedFrames],
            spatialReference,
            setSpatialMatchingEnabled,
            setTimeSeriesMember,
            timeSeriesStore: {
                elements: [{frame: loadedFrameA}, {frame: loadedFrameB}],
                first: rs.fn()
            },
            animatorStore: {setAnimationMode: rs.fn()},
            widgetsStore: {selectDockedWidgetTab: rs.fn()}
        } as unknown as AppStore);

        const component = new FileBrowserDialogComponent({}) as unknown as TestableFileBrowserDialogComponent;
        component.loadSelectedFiles = rs.fn().mockResolvedValue(loadedFrames);

        await component.loadAsTimeSeries();

        expect(setSpatialMatchingEnabled.mock.calls.map(([frame]) => frame)).toEqual(loadedFrames);
        expect(setSpatialMatchingEnabled).not.toHaveBeenCalledWith(spatialReference, true);
        expect(setSpatialMatchingEnabled).not.toHaveBeenCalledWith(existingFrame, true);
        expect(setTimeSeriesMember.mock.calls.map(([frame]) => frame)).toEqual(loadedFrames);
    });
});
