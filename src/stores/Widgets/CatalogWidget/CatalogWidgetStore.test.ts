import {CatalogWidgetStore} from "stores";

describe("CatalogWidgetStore angular size axis type", () => {
    test("converts radius values to diameters", () => {
        const widgetStore = new CatalogWidgetStore(0);

        expect(widgetStore.catalogSourceRadiusTypes.get("radius")?.value).toBe(2);

        widgetStore.dispose();
    });
});
