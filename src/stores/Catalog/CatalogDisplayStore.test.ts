import * as CARTACompute from "carta_computation";
import {CARTA} from "carta-protobuf";
import {runInAction} from "mobx";

import {AngularSizeUnit, CatalogDisplayMode, CatalogOverlay, CatalogSizeUnits, CatalogTextureType} from "enums";
import {CatalogWebGLService} from "services";
import {CatalogDisplayStore, type CatalogProfileStore, CatalogStore} from "stores";

describe("CatalogDisplayStore angular size axis type", () => {
    test("keeps axis mode per catalog and converts radius values to diameters", () => {
        const diameterDisplayStore = new CatalogDisplayStore(0);
        const radiusDisplayStore = new CatalogDisplayStore(1);

        diameterDisplayStore.setCatalogDisplayMode(CatalogDisplayMode.WORLD);
        radiusDisplayStore.setCatalogDisplayMode(CatalogDisplayMode.WORLD);
        radiusDisplayStore.setCatalogSourceRadiusType("radius");

        expect(diameterDisplayStore.catalogSourceRadiusType).toBe("diameter");
        expect(radiusDisplayStore.catalogSourceRadiusType).toBe("radius");
        expect(diameterDisplayStore.pixelSizeFactor).toBe(1);
        expect(radiusDisplayStore.pixelSizeFactor).toBe(2);
        expect(radiusDisplayStore.catalogSize).toBe(radiusDisplayStore.showedCatalogSize * 2);

        radiusDisplayStore.setCatalogDisplayMode(CatalogDisplayMode.CANVAS);
        radiusDisplayStore.setCanvasSizeUnit(CatalogSizeUnits.ARCSEC);
        expect(radiusDisplayStore.pixelSizeFactor).toBe(1);

        diameterDisplayStore.dispose();
        radiusDisplayStore.dispose();
    });

    test("applies the mode to an existing mapped overlay", () => {
        const fileId = 987654;
        const profileStore = {
            get1DPlotData: jest.fn(() => ({wcsData: new Float32Array([2, 4])}))
        };
        const calculateCatalogSize = jest.spyOn(CARTACompute, "CalculateCatalogSize").mockReturnValue(new Float32Array([2, 4]));
        const widgetStore = new CatalogDisplayStore(fileId);
        const previousProfileStore = CatalogStore.Instance.catalogProfileStores.get(fileId);
        CatalogStore.Instance.catalogProfileStores.set(fileId, profileStore as unknown as CatalogProfileStore);

        try {
            widgetStore.setCatalogDisplayMode(CatalogDisplayMode.WORLD);
            widgetStore.setSizeMap("size");
            widgetStore.setSizeColumnMin(2, "default");
            widgetStore.setSizeColumnMax(4, "default");
            calculateCatalogSize.mockClear();

            widgetStore.sizeArray();
            const diameterCall = calculateCatalogSize.mock.calls[calculateCatalogSize.mock.calls.length - 1];
            widgetStore.setCatalogSourceRadiusType("radius");
            widgetStore.sizeArray();
            const radiusCall = calculateCatalogSize.mock.calls[calculateCatalogSize.mock.calls.length - 1];

            expect(diameterCall?.[7]).toBe(1);
            expect(radiusCall?.[7]).toBe(2);
            expect(widgetStore.catalogSize).toBe(widgetStore.showedCatalogSize * 2);
        } finally {
            widgetStore.dispose();
            if (previousProfileStore) {
                CatalogStore.Instance.catalogProfileStores.set(fileId, previousProfileStore);
            } else {
                CatalogStore.Instance.catalogProfileStores.delete(fileId);
            }
            calculateCatalogSize.mockRestore();
        }
    });

    test("recomputes a fixed angular size when its world unit changes", () => {
        const displayStore = new CatalogDisplayStore(0);

        displayStore.setCatalogSourceRadiusType("radius");
        displayStore.setCatalogSize(12);
        displayStore.setCatalogDisplayMode(CatalogDisplayMode.WORLD);

        expect(displayStore.catalogSize).toBe(24);

        displayStore.setWorldSizeUnit(AngularSizeUnit.ARCMIN);

        expect(displayStore.showedCatalogSize).toBe(12);
        expect(displayStore.pixelSizeFactor).toBe(120);
        expect(displayStore.catalogSize).toBe(1440);

        displayStore.dispose();
    });

    test("leaves the sources with no size to draw until an angular size column is mapped", () => {
        const fileId = 987655;
        const profileStore = {
            get1DPlotData: jest.fn(() => ({wcsData: new Float32Array([2, 4])}))
        };
        const calculateCatalogSize = jest.spyOn(CARTACompute, "CalculateCatalogSize").mockReturnValue(new Float32Array([2, 4]));
        const displayStore = new CatalogDisplayStore(fileId);
        CatalogStore.Instance.catalogProfileStores.set(fileId, profileStore as unknown as CatalogProfileStore);

        try {
            expect(displayStore.isSourceSizeDefined).toBe(true);

            displayStore.setCatalogDisplayMode(CatalogDisplayMode.WORLD);
            expect(displayStore.isSourceSizeDefined).toBe(false);

            displayStore.setSizeMap("size");
            expect(displayStore.isSourceSizeDefined).toBe(true);

            // A fixed size is a size again once the sources are no longer drawn on the sky.
            displayStore.setCatalogDisplayMode(CatalogDisplayMode.CANVAS);
            displayStore.setSizeMap(CatalogOverlay.NONE);
            expect(displayStore.isSourceSizeDefined).toBe(true);
        } finally {
            displayStore.dispose();
            runInAction(() => CatalogStore.Instance.catalogProfileStores.delete(fileId));
            calculateCatalogSize.mockRestore();
        }
    });

    test("clamps a fixed size when its canvas unit changes range", () => {
        const displayStore = new CatalogDisplayStore(0);

        displayStore.setCatalogSize(30);
        displayStore.setCanvasSizeUnit(CatalogSizeUnits.DEG);

        expect(displayStore.showedCatalogSize).toBe(10);
        expect(displayStore.catalogSize).toBe(10 * displayStore.pixelSizeFactor);

        displayStore.dispose();
    });
});

describe("CatalogDisplayStore overlay maps after replotting", () => {
    const fileId = 246810;
    const catalogStore = CatalogStore.Instance;
    let columnData: Float32Array;
    let previousProfileStore: CatalogProfileStore | undefined;
    let displayStore: CatalogDisplayStore;
    let updateDataTexture: jest.SpyInstance;

    // Rebuilding the overlay positions (Plot, a filter, streamed data) resets and refills the plotted source count
    const replot = (sourceCount: number) => {
        runInAction(() => {
            catalogStore.catalogCounts.set(fileId, 0);
            catalogStore.catalogCounts.set(fileId, sourceCount);
        });
    };

    beforeEach(() => {
        columnData = Float32Array.from([10, 20, 30, 40]);
        // the catalog data of the profile store is not observable: the accessor returns whatever data is currently loaded
        const profileStore = {get1DPlotData: jest.fn(() => ({wcsData: columnData}))};
        previousProfileStore = catalogStore.catalogProfileStores.get(fileId) as CatalogProfileStore | undefined;
        runInAction(() => {
            catalogStore.catalogProfileStores.set(fileId, profileStore as unknown as CatalogProfileStore);
            catalogStore.catalogCounts.set(fileId, columnData.length);
        });
        updateDataTexture = jest.spyOn(CatalogWebGLService.Instance, "updateDataTexture").mockImplementation(() => {});
        jest.spyOn(CARTACompute, "CalculateCatalogColor").mockImplementation((column: Float32Array) => Float32Array.from(column));
        jest.spyOn(CARTACompute, "CalculateCatalogSize").mockImplementation((column: Float32Array) => Float32Array.from(column));
        displayStore = new CatalogDisplayStore(fileId);
    });

    afterEach(() => {
        displayStore.dispose();
        runInAction(() => {
            if (previousProfileStore) {
                catalogStore.catalogProfileStores.set(fileId, previousProfileStore);
            } else {
                catalogStore.catalogProfileStores.delete(fileId);
            }
            catalogStore.catalogCounts.delete(fileId);
        });
        jest.restoreAllMocks();
    });

    test("recomputes the color texture from the current catalog data when the sources are replotted", () => {
        displayStore.setColorMapColumn("ANG_DIST");
        expect(displayStore.colorColumnMin.default).toBe(10);
        expect(displayStore.colorColumnMax.default).toBe(40);
        expect(updateDataTexture).toHaveBeenLastCalledWith(fileId, Float32Array.from([10, 20, 30, 40]), CatalogTextureType.Color);

        // a filter replaces the loaded catalog data without any observable change (#2849)
        updateDataTexture.mockClear();
        columnData = Float32Array.from([20, 30]);
        expect(updateDataTexture).not.toHaveBeenCalled();

        replot(columnData.length);
        expect(displayStore.colorColumnMin.default).toBe(20);
        expect(displayStore.colorColumnMax.default).toBe(30);
        expect(updateDataTexture).toHaveBeenLastCalledWith(fileId, Float32Array.from([20, 30]), CatalogTextureType.Color);
    });

    test("keeps a customized color range when the same sources are replotted", () => {
        displayStore.setColorMapColumn("ANG_DIST");
        displayStore.setColorColumnMin(15, "clipd");
        displayStore.setColorColumnMax(35, "clipd");

        replot(columnData.length);
        expect(displayStore.colorColumnMin.default).toBe(10);
        expect(displayStore.colorColumnMin.clipd).toBe(15);
        expect(displayStore.colorColumnMax.default).toBe(40);
        expect(displayStore.colorColumnMax.clipd).toBe(35);
        expect(CARTACompute.CalculateCatalogColor).toHaveBeenLastCalledWith(expect.any(Float32Array), false, 15, 35, expect.anything(), expect.anything(), expect.anything());
    });

    test("recomputes the size texture from the current catalog data when the sources are replotted", () => {
        displayStore.setSizeMap("FLUX");
        expect(updateDataTexture).toHaveBeenLastCalledWith(fileId, Float32Array.from([10, 20, 30, 40]), CatalogTextureType.Size);

        columnData = Float32Array.from([20, 30]);
        replot(columnData.length);
        expect(displayStore.sizeColumnMin.default).toBe(20);
        expect(displayStore.sizeColumnMax.default).toBe(30);
        expect(updateDataTexture).toHaveBeenLastCalledWith(fileId, Float32Array.from([20, 30]), CatalogTextureType.Size);
    });

    test("keeps the canvas size range when the sources are replotted", () => {
        displayStore.setSizeMap("FLUX");
        displayStore.setSizeMax(30);
        displayStore.setSizeMin(8);

        columnData = Float32Array.from([20, 30]);
        replot(columnData.length);
        expect([displayStore.sizeMin.diameter, displayStore.sizeMax.diameter]).toEqual([8, 30]);
    });

    // In world mode the columns are used as they are: the output range has to follow the data range (PR #2965 review)
    test("keeps the angular size range equal to the data range when the sources are replotted", () => {
        displayStore.setCatalogDisplayMode(CatalogDisplayMode.WORLD);
        displayStore.setSizeMap("MAJOR_AXIS");
        expect([displayStore.sizeMin.diameter, displayStore.sizeMax.diameter]).toEqual([10, 40]);

        columnData = Float32Array.from([20, 30]);
        replot(columnData.length);
        expect([displayStore.sizeColumnMin.clipd, displayStore.sizeColumnMax.clipd]).toEqual([20, 30]);
        expect([displayStore.sizeMin.diameter, displayStore.sizeMax.diameter]).toEqual([20, 30]);
        expect(CARTACompute.CalculateCatalogSize).toHaveBeenLastCalledWith(expect.any(Float32Array), 20, 30, 20, 30, expect.anything(), expect.anything(), expect.anything(), expect.anything(), expect.anything());
    });

    test("keeps the position angle range equal to the data range when the sources are replotted", () => {
        jest.spyOn(CARTACompute, "CalculateCatalogOrientation").mockImplementation((column: Float32Array) => Float32Array.from(column));
        displayStore.setCatalogDisplayMode(CatalogDisplayMode.WORLD);
        displayStore.setOrientationMapColumn("PA");
        expect([displayStore.angleMin, displayStore.angleMax]).toEqual([10, 40]);

        columnData = Float32Array.from([20, 30]);
        replot(columnData.length);
        expect([displayStore.orientationMin.clipd, displayStore.orientationMax.clipd]).toEqual([20, 30]);
        expect([displayStore.angleMin, displayStore.angleMax]).toEqual([20, 30]);
        expect(CARTACompute.CalculateCatalogOrientation).toHaveBeenLastCalledWith(expect.any(Float32Array), 20, 30, 20, 30, expect.anything(), expect.anything(), expect.anything());
    });
});

describe("CatalogDisplayStore data-derived range cache", () => {
    test("scans only rows appended after the cached prefix", () => {
        const displayStore = new CatalogDisplayStore(13579);
        let data = Float32Array.from([1, 2, 3, 4]);
        const profileStore = {
            catalogControlHeader: new Map([["VALUE", {filter: "", display: true}]]),
            numVisibleRows: 2,
            sortingInfo: {columnName: null, sortingType: null},
            get1DPlotData: () => ({wcsData: data})
        } as unknown as CatalogProfileStore;
        const columnRange = (displayStore as any).columnRange.bind(displayStore);
        const fround = jest.spyOn(Math, "fround").mockImplementation(value => value);

        try {
            expect(columnRange(profileStore, "VALUE")).toEqual({min: 1, max: 2});

            data = Float32Array.from([1, 2, 3, 4]);
            profileStore.numVisibleRows = 4;
            expect(columnRange(profileStore, "VALUE")).toEqual({min: 1, max: 4});
            expect(fround).toHaveBeenCalledTimes(4);

            data = Float32Array.from([10, 20, 30, 40]);
            profileStore.numVisibleRows = 2;
            expect(columnRange(profileStore, "VALUE")).toEqual({min: 10, max: 20});
            expect(fround).toHaveBeenCalledTimes(6);

            profileStore.numVisibleRows = 4;
            profileStore.sortingInfo = {columnName: "VALUE", sortingType: CARTA.SortingType.Ascending};
            expect(columnRange(profileStore, "VALUE")).toEqual({min: 10, max: 40});
            expect(fround).toHaveBeenCalledTimes(10);

            profileStore.catalogControlHeader.get("VALUE")!.filter = "> 15";
            expect(columnRange(profileStore, "VALUE")).toEqual({min: 10, max: 40});
            expect(fround).toHaveBeenCalledTimes(14);

            displayStore.setSizeMap("VALUE");
            expect(columnRange(profileStore, "VALUE")).toEqual({min: 10, max: 40});
            expect(fround).toHaveBeenCalledTimes(18);
        } finally {
            fround.mockRestore();
            displayStore.dispose();
        }
    });
});
