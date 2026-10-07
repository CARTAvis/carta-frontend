// load the stores first: importing the widget store alone reaches ColormapComponent through a circular import before "utilities" is initialised
import "stores";

import {HistogramWidgetStore} from "./HistogramWidgetStore";

describe("HistogramWidgetStore mean/RMS setting", () => {
    test("is off by default and persists in the widget config", () => {
        const store = new HistogramWidgetStore();
        expect(store.isMeanRmsVisible).toBe(false);
        expect(store.toConfig().meanRmsVisible).toBe(false);

        store.setMeanRmsVisible(true);
        expect(store.toConfig().meanRmsVisible).toBe(true);
    });

    test("is restored from the widget config", () => {
        const store = new HistogramWidgetStore();
        store.applyConfig({meanRmsVisible: true});
        expect(store.isMeanRmsVisible).toBe(true);

        store.applyConfig({meanRmsVisible: "yes"});
        expect(store.isMeanRmsVisible).toBe(true);
    });
});
