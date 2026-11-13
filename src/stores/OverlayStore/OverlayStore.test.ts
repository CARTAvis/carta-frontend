import Ajv from "ajv";
import * as AST from "ast_wrapper";
import {runInAction} from "mobx";

import {AstColorsIndex, LabelType, NumberFormatType, PreferenceKeys, SystemType} from "enums";
import {AlertStore, AppStore, PreferenceStore} from "stores";

import {OverlaySettings, type WcsOverlayConfig} from "./OverlayStore";

const PREFERENCE_KEYS = [PreferenceKeys.WCS_OVERLAY_AST_COLOR, PreferenceKeys.WCS_OVERLAY_AST_GRID_VISIBLE, PreferenceKeys.WCS_OVERLAY_AST_LABELS_VISIBLE];

/** Every setting is different from its default. */
const CUSTOM_OVERLAY: WcsOverlayConfig = {
    isVisible: false,
    global: {labelType: LabelType.Interior, color: "auto-red", tolerance: 5, system: SystemType.Galactic},
    title: {isVisible: true, isHidden: true, font: 4, fontSize: 24, hasCustomColor: true, color: "auto-green"},
    grid: {isVisible: false, hasCustomColor: true, color: "auto-orange", width: 2, hasCustomGap: true, gapX: 0.5, gapY: 0.3},
    border: {isVisible: false, hasCustomColor: true, color: "auto-violet", width: 3},
    axes: {isVisible: true, hasCustomColor: true, color: "auto-gray", width: 1.5},
    ticks: {shouldDrawAll: false, hasCustomDensity: true, densityX: 2, densityY: 6, hasCustomColor: true, color: "auto-rose", width: 2.5, length: 3, majorLength: 5},
    numbers: {isVisible: false, isHidden: true, font: 1, fontSize: 14, hasCustomColor: true, color: "auto-lime", hasCustomFormat: true, formatX: NumberFormatType.HMS, formatY: NumberFormatType.DMS, hasCustomPrecision: true, precision: 5},
    labels: {isVisible: false, isHidden: true, hasCustomColor: true, color: "auto-cerulean", font: 3, fontSize: 20, hasRaDecReference: false}
};

/** The settings of `CUSTOM_OVERLAY` that a layout saves: all but the color, the grid visibility and the label visibility, which have a preference. */
const CUSTOM_LAYOUT_OVERLAY: WcsOverlayConfig = {
    ...CUSTOM_OVERLAY,
    global: {labelType: LabelType.Interior, tolerance: 5, system: SystemType.Galactic},
    grid: {hasCustomColor: true, color: "auto-orange", width: 2, hasCustomGap: true, gapX: 0.5, gapY: 0.3},
    labels: {isHidden: true, hasCustomColor: true, color: "auto-cerulean", font: 3, fontSize: 20, hasRaDecReference: false}
};

const LAYOUT_SCHEMA = require("carta-schemas/layout_schema_2.json");

let mockAppStore: {frames: any[]; activeFrame: null; imageRatio: number; imageViewConfigStore: {visibleFrames: any[]}};

function createOverlay(): OverlaySettings {
    return new (OverlaySettings as any)();
}

function setPreference(key: PreferenceKeys, value: unknown) {
    runInAction(() => PreferenceStore.Instance.preferences.set(key, value));
}

describe("the WCS overlay in a layout", () => {
    beforeEach(() => {
        mockAppStore = {frames: [], activeFrame: null, imageRatio: 1, imageViewConfigStore: {visibleFrames: []}};
        jest.spyOn(AppStore, "Instance", "get").mockReturnValue(mockAppStore as any);
        runInAction(() => PREFERENCE_KEYS.forEach(key => PreferenceStore.Instance.preferences.delete(key)));
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test("saves every setting and applies it again", () => {
        const overlay = createOverlay();

        overlay.applyConfig(CUSTOM_OVERLAY);

        expect(overlay.toConfig()).toEqual(CUSTOM_LAYOUT_OVERLAY);
        expect(overlay.toConfig(true)).toEqual(CUSTOM_OVERLAY);
        const other = createOverlay();
        other.applyConfig(JSON.parse(JSON.stringify(overlay.toConfig(true))));
        expect(other.toConfig(true)).toEqual(CUSTOM_OVERLAY);
    });

    test("writes settings the layout schema accepts, with every setting changed", () => {
        const overlay = createOverlay();
        overlay.applyConfig(CUSTOM_OVERLAY);
        const validateWidget = new Ajv({strictTypes: false}).compile({$ref: "#/definitions/carta-widget", definitions: LAYOUT_SCHEMA.definitions});

        const widget = JSON.parse(JSON.stringify({type: "component", id: "image-view", widgetSettings: {wcsOverlay: overlay.toConfig(true)}}));

        expect(validateWidget(widget)).toBe(true);
    });

    test("changes nothing when the layout saved no overlay, as a preset layout or an older layout", () => {
        const overlay = createOverlay();
        overlay.applyConfig(CUSTOM_OVERLAY);

        overlay.applyConfig(null);
        overlay.applyConfig(undefined);

        expect(overlay.toConfig(true)).toEqual(CUSTOM_OVERLAY);
    });

    test("sets every setting without a preference back to its default when the layout saved an empty overlay", () => {
        const defaults = createOverlay().toConfig();
        const overlay = createOverlay();
        overlay.applyConfig(CUSTOM_OVERLAY);

        overlay.applyConfig({});

        expect(overlay.toConfig()).toEqual(defaults);
    });

    test("uses the default for each value that the controls do not accept", () => {
        const defaults = createOverlay().toConfig();
        const overlay = createOverlay();

        overlay.applyConfig({
            isVisible: "no",
            global: {labelType: "Inside", color: "", tolerance: 0, system: "J2000"},
            title: {font: 99, fontSize: 200},
            grid: {width: -1, gapX: 0},
            border: {width: 0.1},
            ticks: {length: 101, densityX: -1},
            numbers: {formatX: "hours", precision: 2.5},
            labels: {fontSize: 6, font: 1.5}
        });

        expect(overlay.toConfig()).toEqual(defaults);
    });

    test("keeps the settings that have a preference when the layout leaves them out", () => {
        const overlay = createOverlay();
        overlay.global.setColor("auto-green");
        overlay.grid.setVisible(true);

        overlay.applyConfig({});

        expect(overlay.global.color).toBe("auto-green");
        expect(overlay.grid.isVisible).toBe(true);
        setPreference(PreferenceKeys.WCS_OVERLAY_AST_LABELS_VISIBLE, false);
        expect(overlay.labels.isVisible).toBe(false);
    });

    test("leaves out of a layout the settings that have a preference, also when the session set them, so that the preferences still apply", () => {
        const overlay = createOverlay();
        overlay.global.setColor("auto-green");
        overlay.grid.setVisible(true);
        overlay.labels.setVisible(false);

        const config = overlay.toConfig();

        expect(config.global).not.toHaveProperty("color");
        expect(config.grid).not.toHaveProperty("isVisible");
        expect(config.labels).not.toHaveProperty("isVisible");
        const other = createOverlay();
        other.applyConfig(JSON.parse(JSON.stringify(config)));
        setPreference(PreferenceKeys.WCS_OVERLAY_AST_COLOR, "auto-red");
        setPreference(PreferenceKeys.WCS_OVERLAY_AST_GRID_VISIBLE, false);
        setPreference(PreferenceKeys.WCS_OVERLAY_AST_LABELS_VISIBLE, true);
        expect(other.global.color).toBe("auto-red");
        expect(other.grid.isVisible).toBe(false);
        expect(other.labels.isVisible).toBe(true);
    });

    test("saves the settings that follow the preferences as they are shown, for a workspace", () => {
        setPreference(PreferenceKeys.WCS_OVERLAY_AST_COLOR, "auto-red");
        const overlay = createOverlay();

        const config = overlay.toConfig(true);

        expect(config.global.color).toBe("auto-red");
        expect(config.grid.isVisible).toBe(false);
        expect(config.labels.isVisible).toBe(true);
    });

    test("accepts grid and axis widths above 30, as the settings panel does", () => {
        const overlay = createOverlay();

        overlay.applyConfig({grid: {width: 40}, axes: {width: 45}});

        expect(overlay.grid.width).toBe(40);
        expect(overlay.axes.width).toBe(45);
    });

    test("keeps a setting that the session set when the preference changes", () => {
        const overlay = createOverlay();
        overlay.grid.setVisible(false);
        overlay.labels.setVisible(true);

        setPreference(PreferenceKeys.WCS_OVERLAY_AST_GRID_VISIBLE, true);
        setPreference(PreferenceKeys.WCS_OVERLAY_AST_LABELS_VISIBLE, false);

        expect(overlay.grid.isVisible).toBe(false);
        expect(overlay.labels.isVisible).toBe(true);
    });

    test("does not change the user's preferences", () => {
        const preferences = [...PreferenceStore.Instance.preferences.entries()];
        const overlay = createOverlay();

        overlay.applyConfig(CUSTOM_OVERLAY);

        expect([...PreferenceStore.Instance.preferences.entries()]).toEqual(preferences);
    });

    test("passes the colors to AST, also the global color that follows the preference", () => {
        const overlay = createOverlay();
        (AST.setColor as jest.Mock).mockClear();

        overlay.applyConfig(CUSTOM_OVERLAY);
        expect(AST.setColor).toHaveBeenCalledWith(expect.anything(), AstColorsIndex.GLOBAL);
        expect(AST.setColor).toHaveBeenCalledWith(expect.anything(), AstColorsIndex.GRID);
        expect(AST.setColor).toHaveBeenCalledWith(expect.anything(), AstColorsIndex.LABEL);

        (AST.setColor as jest.Mock).mockClear();
        overlay.applyConfig({});
        setPreference(PreferenceKeys.WCS_OVERLAY_AST_COLOR, "auto-green");
        expect(AST.setColor).toHaveBeenCalledWith(expect.anything(), AstColorsIndex.GLOBAL);
    });

    test("sets the coordinate system at once, without asking the user and without turning off spatial matching", () => {
        const overlay = createOverlay();
        overlay.applyConfig({global: {system: SystemType.Image}});
        const reference = {spatialReference: null, clearSpatialReference: jest.fn()};
        mockAppStore.frames = [reference, {spatialReference: reference, clearSpatialReference: jest.fn()}];

        const problems = overlay.applyConfig({global: {system: SystemType.FK5}});

        expect(problems).toEqual([]);
        expect(overlay.global.system).toBe(SystemType.FK5);
        expect(AlertStore.Instance.isAlertVisible).toBe(false);
        mockAppStore.frames.forEach(frame => expect(frame.clearSpatialReference).not.toHaveBeenCalled());
    });

    test("shows automatic coordinates instead of image coordinates while the images are matched spatially, and says so", () => {
        const reference = {spatialReference: null};
        mockAppStore.frames = [reference, {spatialReference: reference}];
        const overlay = createOverlay();

        const problems = overlay.applyConfig({global: {system: SystemType.Image}});

        expect(overlay.global.system).toBe(SystemType.Auto);
        expect(problems).toEqual(["Showed the WCS overlay in automatic coordinates instead of image coordinates, because the images are matched spatially"]);
    });

    test("keeps a custom number format when the system that the layout saved gives other formats", () => {
        const overlay = createOverlay();
        overlay.global.setValidWcs(true);
        overlay.numbers.setValidWcs(true);

        overlay.applyConfig({global: {system: SystemType.Galactic}, numbers: {hasCustomFormat: true, formatX: NumberFormatType.HMS, formatY: NumberFormatType.DMS}});

        expect(overlay.numbers.formatTypeX).toBe(NumberFormatType.HMS);
        expect(overlay.numbers.formatTypeY).toBe(NumberFormatType.DMS);
    });

    test("gives a custom format that the layout left out the default format of the system that the layout saved", () => {
        const overlay = createOverlay();
        overlay.global.setValidWcs(true);
        overlay.numbers.setValidWcs(true);
        overlay.applyConfig({global: {system: SystemType.FK5}});
        expect(overlay.numbers.formatTypeX).toBe(NumberFormatType.HMS);

        overlay.applyConfig({global: {system: SystemType.Galactic}, numbers: {hasCustomFormat: true}});

        expect(overlay.numbers.formatTypeX).toBe(NumberFormatType.Degrees);
        expect(overlay.numbers.formatTypeY).toBe(NumberFormatType.Degrees);
    });

    test("shows the formats of the system when the layout saved no custom format", () => {
        const overlay = createOverlay();
        overlay.global.setValidWcs(true);
        overlay.numbers.setValidWcs(true);

        overlay.applyConfig({global: {system: SystemType.Galactic}, numbers: {hasCustomFormat: false, formatX: NumberFormatType.HMS}});

        expect(overlay.numbers.formatX).toBe(NumberFormatType.Degrees);
    });

    test("leaves the custom texts and their switches alone, because a workspace saves them", () => {
        const overlay = createOverlay();
        overlay.applyTextConfig({labels: {hasCustomText: true, customLabelX: "RA", customLabelY: "Dec"}, title: {hasCustomText: true}});

        overlay.applyConfig(null);

        expect(overlay.toTextConfig()).toEqual({labels: {hasCustomText: true, customLabelX: "RA", customLabelY: "Dec"}, title: {hasCustomText: true}});
    });
});

describe("the custom texts of the WCS overlay in a workspace", () => {
    beforeEach(() => {
        jest.spyOn(AppStore, "Instance", "get").mockReturnValue({frames: [], activeFrame: null, imageRatio: 1, imageViewConfigStore: {visibleFrames: []}} as any);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test("saves the texts and their switches, and applies them again", () => {
        const texts = {labels: {hasCustomText: true, customLabelX: "RA (deg)", customLabelY: ""}, title: {hasCustomText: true}};
        const overlay = createOverlay();

        overlay.applyTextConfig(texts);

        expect(overlay.toTextConfig()).toEqual(texts);
        expect(overlay.labels.hasCustomText).toBe(true);
    });

    test("turns the custom texts off when the workspace saved none, or saved values of the wrong type", () => {
        const overlay = createOverlay();
        overlay.applyTextConfig({labels: {hasCustomText: true, customLabelX: "RA", customLabelY: "Dec"}, title: {hasCustomText: true}});

        overlay.applyTextConfig({labels: {hasCustomText: "yes", customLabelX: 3}});

        expect(overlay.toTextConfig()).toEqual({labels: {hasCustomText: false, customLabelX: "", customLabelY: ""}, title: {hasCustomText: false}});
    });

    test("leaves how the overlay looks alone", () => {
        const overlay = createOverlay();
        overlay.applyConfig(CUSTOM_OVERLAY);

        overlay.applyTextConfig(undefined);

        expect(overlay.toConfig(true)).toEqual(CUSTOM_OVERLAY);
    });
});
