jest.mock("stores", () => ({
    AppStore: {
        Instance: {
            imageRatio: 1,
            updateActiveLayer: jest.fn(),
            updateLayerPixelRatio: jest.fn(),
            isCursorFrozen: false,
            hoveredFrame: null,
            setHoveredFrame: jest.fn(),
            preferenceStore: {
                isRegionCornerMode: false
            },
            fileBrowserStore: {
                isLoadingDialogOpen: false
            }
        }
    },
    PreferenceStore: {
        Instance: {
            zoomPoint: "cursor",
            regionSize: 10
        }
    }
}));

import {RegionMode} from "enums";

import {RegionViewComponent} from "./RegionViewComponent";

describe("RegionViewComponent shift+drag box selection click suppression", () => {
    let mockFrame: any;
    let mockRegionSet: any;
    let component: RegionViewComponent;

    beforeEach(() => {
        mockRegionSet = {
            mode: RegionMode.MOVING,
            isLocked: false,
            newRegionType: 0,
            regionsAndAnnotationsForRender: [],
            selectedRegionIds: new Set(),
            applyRegionBoxSelection: jest.fn(),
            clearSelection: jest.fn()
        };

        mockFrame = {
            aspectRatio: 1,
            zoomLevel: 1,
            centerMovement: {x: 0, y: 0},
            regionSet: mockRegionSet,
            spatialReference: null,
            wcsInfo: null,
            isPreview: false
        };

        component = new RegionViewComponent({
            frame: mockFrame,
            dragPanningEnabled: true,
            docked: false,
            width: 800,
            height: 600,
            left: 0,
            top: 0,
            onClickToCenter: jest.fn()
        });

        (component as any).stageRef = {
            current: {
                getPosition: () => ({x: 0, y: 0}),
                scaleX: () => 1
            }
        };
    });

    afterEach(() => {
        component.componentWillUnmount();
    });

    test("shift+drag box selection suppresses subsequent stage click to prevent clearSelection", () => {
        const stageTarget = {id: () => ""};
        const mouseDownKonvaEvent = {
            evt: {button: 0, shiftKey: true, offsetX: 100, offsetY: 100, x: 100, y: 100} as MouseEvent,
            target: stageTarget,
            currentTarget: stageTarget
        } as any;

        (component as any).handleStageMouseDown(mouseDownKonvaEvent);

        const moveKonvaEvent = {
            evt: {offsetX: 200, offsetY: 200, x: 200, y: 200, buttons: 1} as MouseEvent,
            target: stageTarget,
            currentTarget: stageTarget
        } as any;

        component.handleMove(moveKonvaEvent);

        const mouseUpKonvaEvent = {
            evt: {button: 0, shiftKey: true, offsetX: 200, offsetY: 200, x: 200, y: 200} as MouseEvent,
            target: stageTarget,
            currentTarget: stageTarget
        } as any;

        (component as any).handleStageMouseUp(mouseUpKonvaEvent);

        expect(mockRegionSet.applyRegionBoxSelection).toHaveBeenCalled();

        const clickKonvaEvent = {
            evt: {button: 0, shiftKey: true, offsetX: 200, offsetY: 200, x: 200, y: 200, ctrlKey: false, metaKey: false} as MouseEvent,
            target: stageTarget,
            currentTarget: stageTarget
        } as any;

        component.handleClick(clickKonvaEvent);

        expect(mockRegionSet.clearSelection).not.toHaveBeenCalled();
    });

    test("shift+click without drag does not suppress next stage click", () => {
        const stageTarget = {id: () => ""};
        const mouseDownKonvaEvent = {
            evt: {button: 0, shiftKey: true, offsetX: 100, offsetY: 100, x: 100, y: 100} as MouseEvent,
            target: stageTarget,
            currentTarget: stageTarget
        } as any;

        (component as any).handleStageMouseDown(mouseDownKonvaEvent);

        const mouseUpKonvaEvent = {
            evt: {button: 0, shiftKey: true, offsetX: 100, offsetY: 100, x: 100, y: 100} as MouseEvent,
            target: stageTarget,
            currentTarget: stageTarget
        } as any;

        (component as any).handleStageMouseUp(mouseUpKonvaEvent);

        expect(mockRegionSet.applyRegionBoxSelection).not.toHaveBeenCalled();

        const clickKonvaEvent = {
            evt: {button: 0, shiftKey: false, offsetX: 100, offsetY: 100, x: 100, y: 100, ctrlKey: false, metaKey: false} as MouseEvent,
            target: stageTarget,
            currentTarget: stageTarget
        } as any;

        component.handleClick(clickKonvaEvent);

        expect(mockRegionSet.clearSelection).toHaveBeenCalled();
    });

    test("shift+drag box selection suppresses subsequent region click selection", () => {
        const stageTarget = {id: () => ""};
        const mouseDownKonvaEvent = {
            evt: {button: 0, shiftKey: true, offsetX: 50, offsetY: 50, x: 50, y: 50} as MouseEvent,
            target: stageTarget,
            currentTarget: stageTarget
        } as any;

        (component as any).handleStageMouseDown(mouseDownKonvaEvent);

        const moveKonvaEvent = {
            evt: {offsetX: 150, offsetY: 150, x: 150, y: 150, buttons: 1} as MouseEvent,
            target: stageTarget,
            currentTarget: stageTarget
        } as any;

        component.handleMove(moveKonvaEvent);

        const mouseUpKonvaEvent = {
            evt: {button: 0, shiftKey: true, offsetX: 150, offsetY: 150, x: 150, y: 150} as MouseEvent,
            target: stageTarget,
            currentTarget: stageTarget
        } as any;

        (component as any).handleStageMouseUp(mouseUpKonvaEvent);

        const shouldSuppress = (component as any).shouldSuppressRegionSelection({button: 0} as MouseEvent);
        expect(shouldSuppress).toBe(true);

        const shouldSuppressNext = (component as any).shouldSuppressRegionSelection({button: 0} as MouseEvent);
        expect(shouldSuppressNext).toBe(false);
    });

    test("box selection suppression does not leak into a later gesture when no region click consumes it", () => {
        const stageTarget = {id: () => ""};
        const boxSelect = (from: number, to: number) => {
            (component as any).handleStageMouseDown({
                evt: {button: 0, shiftKey: true, offsetX: from, offsetY: from, x: from, y: from} as MouseEvent,
                target: stageTarget,
                currentTarget: stageTarget
            } as any);
            component.handleMove({
                evt: {offsetX: to, offsetY: to, x: to, y: to, buttons: 1} as MouseEvent,
                target: stageTarget,
                currentTarget: stageTarget
            } as any);
            (component as any).handleStageMouseUp({
                evt: {button: 0, shiftKey: true, offsetX: to, offsetY: to, x: to, y: to} as MouseEvent,
                target: stageTarget,
                currentTarget: stageTarget
            } as any);
        };

        // The box selection ends over empty canvas, so no region click arrives to consume the flag.
        boxSelect(50, 150);

        // A later plain left click on a region must still select it.
        (component as any).handleStageMouseDown({
            evt: {button: 0, shiftKey: false, offsetX: 300, offsetY: 300, x: 300, y: 300} as MouseEvent,
            target: stageTarget,
            currentTarget: stageTarget
        } as any);

        expect((component as any).shouldSuppressRegionSelection({button: 0} as MouseEvent)).toBe(false);
    });

    test("anchor drag selection is not suppressed after a box selection", () => {
        const stageTarget = {id: () => ""};

        (component as any).handleStageMouseDown({
            evt: {button: 0, shiftKey: true, offsetX: 50, offsetY: 50, x: 50, y: 50} as MouseEvent,
            target: stageTarget,
            currentTarget: stageTarget
        } as any);
        component.handleMove({
            evt: {offsetX: 150, offsetY: 150, x: 150, y: 150, buttons: 1} as MouseEvent,
            target: stageTarget,
            currentTarget: stageTarget
        } as any);
        (component as any).handleStageMouseUp({
            evt: {button: 0, shiftKey: true, offsetX: 150, offsetY: 150, x: 150, y: 150} as MouseEvent,
            target: stageTarget,
            currentTarget: stageTarget
        } as any);

        // Anchor drag start calls onSelect without a mouse event and must keep updating the selection.
        expect((component as any).shouldSuppressRegionSelection()).toBe(false);
    });
});
