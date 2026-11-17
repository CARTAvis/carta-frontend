jest.mock("components/Dialogs", () => ({DraggableDialogComponent: jest.fn(), TaskProgressDialogComponent: jest.fn()}));
jest.mock("components/Shared", () => ({genMeanRmsMarkers: jest.fn(), LinePlotComponent: jest.fn(), SafeNumericInput: jest.fn(), SCALING_POPOVER_PROPS: {}, ScrollShadow: jest.fn()}));
jest.mock("icons/CustomIcons", () => ({CustomIcon: {}}));
jest.mock("stores", () => ({AppStore: {Instance: {}}}));
jest.mock("stores/Widgets", () => ({
    RenderConfigWidgetStore: jest.fn(() => ({clearXYBounds: jest.fn(), initXYBoundaries: jest.fn(), isAutoScaledX: true}))
}));
jest.mock("utilities", () => ({getColorForTheme: jest.fn(), getHistogramPlotData: jest.fn(() => null), toExponential: jest.fn(), toFixed: jest.fn()}));
jest.mock("./ContourGeneratorPanel/ContourGeneratorPanelComponent", () => ({ContourGeneratorPanelComponent: jest.fn()}));
jest.mock("./ContourStylePanel/ContourStylePanelComponent", () => ({ContourStylePanelComponent: jest.fn()}));

import {CARTA} from "carta-protobuf";
import {observable, runInAction} from "mobx";

import {AppStore} from "stores";

import {ContourDialogComponent} from "./ContourDialogComponent";

function createFrame() {
    return observable({
        renderConfig: {contourHistogram: undefined},
        frameInfo: {fileId: 0},
        contourConfig: {levels: [] as number[], smoothingMode: CARTA.SmoothingMode.GaussianBlur, smoothingFactor: 4}
    });
}

describe("ContourDialogComponent", () => {
    let appStore: {contourDataSource: ReturnType<typeof createFrame> | null};
    let dialog: ContourDialogComponent | undefined;

    beforeEach(() => {
        appStore = observable(
            {
                contourDataSource: null as ReturnType<typeof createFrame> | null,
                dialogStore: {dialogVisible: new Map(), registerSettingsHandler: () => () => {}},
                isLoadingWorkspace: false,
                preferenceStore: {contourSmoothingMode: CARTA.SmoothingMode.GaussianBlur, contourSmoothingFactor: 4}
            },
            {dialogStore: false}
        );
        (AppStore as any).Instance = appStore;
    });

    afterEach(() => {
        dialog?.componentWillUnmount();
        dialog = undefined;
    });

    test("shows the levels and the smoothing that a restore applies to the image after it opens", () => {
        const frame = createFrame();
        runInAction(() => (appStore.contourDataSource = frame));
        dialog = new ContourDialogComponent({appStore} as any);
        expect(dialog.levels).toEqual([]);

        runInAction(() => {
            frame.contourConfig.levels = [0.05, 0.1, 0.15];
            frame.contourConfig.smoothingMode = CARTA.SmoothingMode.BlockAverage;
            frame.contourConfig.smoothingFactor = 3;
        });

        expect(dialog.levels).toEqual([0.05, 0.1, 0.15]);
        expect(dialog.smoothingMode).toBe(CARTA.SmoothingMode.BlockAverage);
        expect(dialog.smoothingFactor).toBe(3);
    });

    test("shows the levels of another image when the dialog shows it", () => {
        const frame = createFrame();
        dialog = new ContourDialogComponent({appStore} as any);
        frame.contourConfig.levels = [1, 2];

        runInAction(() => (appStore.contourDataSource = frame));

        expect(dialog.levels).toEqual([1, 2]);
    });

    test("keeps levels that are not applied until the dialog shows another image, as before", () => {
        const frame = createFrame();
        const otherFrame = createFrame();
        runInAction(() => (appStore.contourDataSource = frame));
        dialog = new ContourDialogComponent({appStore} as any);
        runInAction(() => (dialog!.levels = [5, 6]));

        expect(dialog.levels).toEqual([5, 6]);
        runInAction(() => (appStore.contourDataSource = otherFrame));
        expect(dialog.levels).toEqual([]);
    });

    describe("settings that are not applied", () => {
        const captureOf = (component: ContourDialogComponent) => (component as any).captureUnappliedSettings();
        const applyTo = (component: ContourDialogComponent, settings: unknown) => (component as any).applyUnappliedSettings(settings);

        test("gives nothing when the dialog shows the settings of its image", () => {
            runInAction(() => (appStore.contourDataSource = createFrame()));
            dialog = new ContourDialogComponent({appStore} as any);

            expect(captureOf(dialog)).toBeUndefined();
        });

        test("gives the levels and the smoothing that differ from the image", () => {
            const frame = createFrame();
            runInAction(() => (appStore.contourDataSource = frame));
            dialog = new ContourDialogComponent({appStore} as any);
            runInAction(() => {
                dialog!.levels = [1, 2];
                dialog!.smoothingFactor = 6;
            });

            expect(captureOf(dialog)).toEqual({frame, values: {levels: [1, 2], smoothingMode: CARTA.SmoothingMode.GaussianBlur, smoothingFactor: 6}});
        });

        test("gives the values of the level generator only while the dialog is open", () => {
            const frame = createFrame();
            runInAction(() => (appStore.contourDataSource = frame));
            dialog = new ContourDialogComponent({appStore} as any);
            (dialog as any).setGeneratorPanel({toSettings: () => ({numLevels: 8}), applySettings: jest.fn()});

            expect(captureOf(dialog)).toBeUndefined();
            (appStore as any).dialogStore.dialogVisible.set("contour-dialog", true);
            expect(captureOf(dialog).values.generator).toEqual({numLevels: 8});
            (appStore as any).dialogStore.dialogVisible.delete("contour-dialog");
        });

        test("shows the saved levels and gives the generator its values when it mounts again", () => {
            const frame = createFrame();
            runInAction(() => (appStore.contourDataSource = frame));
            dialog = new ContourDialogComponent({appStore} as any);
            (appStore as any).dialogStore.dialogVisible.set("contour-dialog", true);

            applyTo(dialog, {frame, values: {levels: [3, 4], smoothingMode: CARTA.SmoothingMode.BlockAverage, smoothingFactor: 2, generator: {numLevels: 8}}});
            const panel = {applySettings: jest.fn()};
            (dialog as any).setGeneratorPanel(panel);

            expect(dialog.levels).toEqual([3, 4]);
            expect(dialog.smoothingMode).toBe(CARTA.SmoothingMode.BlockAverage);
            expect(dialog.smoothingFactor).toBe(2);
            expect(panel.applySettings).toHaveBeenCalledWith({numLevels: 8});
            (appStore as any).dialogStore.dialogVisible.delete("contour-dialog");
        });

        test("shows the settings of the image when the saved settings are for another image or there are none", () => {
            const frame = createFrame();
            frame.contourConfig.levels = [7];
            runInAction(() => (appStore.contourDataSource = frame));
            dialog = new ContourDialogComponent({appStore} as any);
            runInAction(() => (dialog!.levels = [1]));

            applyTo(dialog, {frame: createFrame(), values: {levels: [3], smoothingMode: CARTA.SmoothingMode.BlockAverage, smoothingFactor: 2}});
            expect(dialog.levels).toEqual([7]);

            runInAction(() => (dialog!.levels = [1]));
            applyTo(dialog, undefined);
            expect(dialog.levels).toEqual([7]);
        });
    });
});
