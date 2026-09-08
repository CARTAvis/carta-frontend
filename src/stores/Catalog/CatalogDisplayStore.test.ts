import * as CARTACompute from "carta_computation";

import {CatalogDisplayMode, CatalogSizeUnits} from "enums";
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
