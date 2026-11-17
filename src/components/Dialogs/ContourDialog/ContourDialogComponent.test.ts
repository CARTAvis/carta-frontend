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
        appStore = observable({
            contourDataSource: null as ReturnType<typeof createFrame> | null,
            dialogStore: {dialogVisible: new Map()},
            isLoadingWorkspace: false,
            preferenceStore: {contourSmoothingMode: CARTA.SmoothingMode.GaussianBlur, contourSmoothingFactor: 4}
        });
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
});
