import * as CARTACompute from "carta_computation";
import {runInAction} from "mobx";

import {CatalogDisplayMode, CatalogSizeUnits, CatalogTextureType} from "enums";
import {CatalogWebGLService} from "services";
import {CatalogDisplayStore, type CatalogProfileStore, CatalogStore} from "stores";

describe("CatalogDisplayStore angular size axis type", () => {
    test("keeps axis mode per catalog and converts radius values to diameters", () => {
        const diameterDisplayStore = new CatalogDisplayStore(0);
        const radiusDisplayStore = new CatalogDisplayStore(1);

        diameterDisplayStore.setCatalogDisplayMode(CatalogDisplayMode.WORLD);
        radiusDisplayStore.setCatalogDisplayMode(CatalogDisplayMode.WORLD);
        const fixedCatalogSize = radiusDisplayStore.catalogSize;

        radiusDisplayStore.setCatalogSourceRadiusType("radius");

        expect(diameterDisplayStore.catalogSourceRadiusType).toBe("diameter");
        expect(radiusDisplayStore.catalogSourceRadiusType).toBe("radius");
        expect(diameterDisplayStore.pixelSizeFactor).toBe(1);
        expect(radiusDisplayStore.pixelSizeFactor).toBe(2);
        expect(radiusDisplayStore.catalogSize).toBe(fixedCatalogSize);

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
            const fixedCatalogSize = widgetStore.catalogSize;
            calculateCatalogSize.mockClear();

            widgetStore.sizeArray();
            const diameterCall = calculateCatalogSize.mock.calls[calculateCatalogSize.mock.calls.length - 1];
            widgetStore.setCatalogSourceRadiusType("radius");
            widgetStore.sizeArray();
            const radiusCall = calculateCatalogSize.mock.calls[calculateCatalogSize.mock.calls.length - 1];

            expect(diameterCall?.[7]).toBe(1);
            expect(radiusCall?.[7]).toBe(2);
            expect(widgetStore.catalogSize).toBe(fixedCatalogSize);
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
});
