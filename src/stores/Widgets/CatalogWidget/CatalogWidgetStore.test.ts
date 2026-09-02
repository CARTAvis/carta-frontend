import * as CARTACompute from "carta_computation";

import {CatalogDisplayMode} from "enums";
import {type CatalogProfileStore, CatalogStore, CatalogWidgetStore} from "stores";

describe("CatalogWidgetStore angular size axis type", () => {
    test("keeps axis mode per catalog and converts radius values to diameters", () => {
        const diameterWidgetStore = new CatalogWidgetStore(0);
        const radiusWidgetStore = new CatalogWidgetStore(1);

        diameterWidgetStore.setCatalogDisplayMode(CatalogDisplayMode.WORLD);
        radiusWidgetStore.setCatalogDisplayMode(CatalogDisplayMode.WORLD);
        const fixedCatalogSize = radiusWidgetStore.catalogSize;

        radiusWidgetStore.setCatalogSourceRadiusType("radius");

        expect(diameterWidgetStore.catalogSourceRadiusType).toBe("diameter");
        expect(radiusWidgetStore.catalogSourceRadiusType).toBe("radius");
        expect(diameterWidgetStore.pixelSizeFactor).toBe(1);
        expect(radiusWidgetStore.pixelSizeFactor).toBe(2);
        expect(radiusWidgetStore.catalogSize).toBe(fixedCatalogSize);

        diameterWidgetStore.dispose();
        radiusWidgetStore.dispose();
    });

    test("applies the mode to an existing mapped overlay", () => {
        const fileId = 987654;
        const profileStore = {
            get1DPlotData: jest.fn(() => ({wcsData: new Float32Array([2, 4])}))
        };
        const calculateCatalogSize = jest.spyOn(CARTACompute, "CalculateCatalogSize").mockReturnValue(new Float32Array([2, 4]));
        const widgetStore = new CatalogWidgetStore(fileId);
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
