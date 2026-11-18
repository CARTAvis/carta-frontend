const MOCK_DIALOG_STORE = {dialogGeometries: new Map<string, {x: number; y: number; width: number; height: number}>(), setDialogGeometry: jest.fn()};
jest.mock("stores", () => ({
    AppStore: {Instance: {dialogStore: MOCK_DIALOG_STORE, zIndexManager: {findIndex: jest.fn(), updateIndexOnSelect: jest.fn()}}},
    HelpStore: {Instance: {}}
}));

import {DraggableDialogComponent} from "./DraggableDialogComponent";

interface TestableDraggableDialog {
    rnd: unknown;
    onDragStop: (event: unknown, data: {x: number; y: number; node: HTMLElement}) => void;
    applyGeometry: () => void;
    setRnd: (rnd: unknown) => void;
}

/** Returns an element whose box is the given rectangle, in pixels of the browser window. */
function elementAt(rect: {left: number; top: number; width: number; height: number}, offsetParent?: HTMLElement): HTMLElement {
    const element = document.createElement("div");
    jest.spyOn(element, "getBoundingClientRect").mockReturnValue({...rect, right: rect.left + rect.width, bottom: rect.top + rect.height, x: rect.left, y: rect.top} as DOMRect);
    Object.defineProperty(element, "offsetWidth", {value: rect.width});
    Object.defineProperty(element, "offsetHeight", {value: rect.height});
    Object.defineProperty(element, "offsetParent", {value: offsetParent ?? null});
    return element;
}

function createDialog(props: {isResizingEnabled?: boolean} = {}) {
    const dialog = new DraggableDialogComponent({
        dialogProps: {isOpen: true},
        defaultWidth: 600,
        defaultHeight: 700,
        minWidth: 400,
        minHeight: 300,
        isResizingEnabled: props.isResizingEnabled ?? true,
        dialogId: "contour-dialog"
    }) as unknown as TestableDraggableDialog;
    const app = elementAt({left: 0, top: 0, width: 1000, height: 800});
    const self = elementAt({left: 100, top: 100, width: 500, height: 600}, app);
    const rnd = {getDraggablePosition: jest.fn(() => ({x: 100, y: 100})), getSelfElement: () => self, updatePosition: jest.fn(), updateSize: jest.fn()};
    return {dialog, rnd, self};
}

describe("DraggableDialogComponent", () => {
    beforeEach(() => {
        MOCK_DIALOG_STORE.dialogGeometries.clear();
        MOCK_DIALOG_STORE.setDialogGeometry.mockClear();
        document.body.innerHTML = "";
        // The layout area starts below the 48 pixel menu bar.
        const layout = elementAt({left: 0, top: 48, width: 1000, height: 752});
        layout.className = "layout-container";
        document.body.appendChild(layout);
    });

    test("keeps the position of Rnd after a drag, not the position that the drag callback gives", () => {
        const {dialog, rnd, self} = createDialog();
        dialog.rnd = rnd;

        // The callback counts from the element around the dialog, 40 pixels lower than the app.
        dialog.onDragStop(undefined, {x: 100, y: 60, node: self});

        expect(MOCK_DIALOG_STORE.setDialogGeometry).toHaveBeenCalledWith("contour-dialog", {x: 100, y: 100, width: 500, height: 600});
    });

    test("does not move a dialog again to the place that its own drag kept", () => {
        const {dialog, rnd} = createDialog();
        dialog.rnd = rnd;

        // The dialog is at (100, 100) with the size 500 by 600, partly below the layout area.
        (dialog as unknown as {onGeometryChanged: (geometry: unknown) => void}).onGeometryChanged({x: 100, y: 100, width: 500, height: 600});

        expect(rnd.updatePosition).not.toHaveBeenCalled();
    });

    test("puts a dialog inside the layout area, below the menu bar, and between its minimum size and the size of the area", () => {
        const {dialog, rnd} = createDialog();
        dialog.rnd = rnd;
        MOCK_DIALOG_STORE.dialogGeometries.set("contour-dialog", {x: -50, y: 10, width: 2000, height: 100});

        dialog.applyGeometry();

        expect(rnd.updateSize).toHaveBeenCalledWith({width: 1000, height: 300});
        expect(rnd.updatePosition).toHaveBeenCalledWith({x: 0, y: 48});
    });

    test("keeps the size of a dialog that cannot be resized", () => {
        const {dialog, rnd} = createDialog({isResizingEnabled: false});
        dialog.rnd = rnd;
        MOCK_DIALOG_STORE.dialogGeometries.set("contour-dialog", {x: 200, y: 100, width: 900, height: 900});

        dialog.applyGeometry();

        expect(rnd.updateSize).not.toHaveBeenCalled();
        expect(rnd.updatePosition).toHaveBeenCalledWith({x: 200, y: 100});
    });

    test("places a dialog that opens only when the dialog store has a place for it", () => {
        const first = createDialog();
        first.dialog.setRnd(first.rnd);
        expect(first.rnd.updatePosition).not.toHaveBeenCalled();

        MOCK_DIALOG_STORE.dialogGeometries.set("contour-dialog", {x: 200, y: 100, width: 600, height: 650});
        const second = createDialog();
        second.dialog.setRnd(second.rnd);
        expect(second.rnd.updatePosition).toHaveBeenCalledWith({x: 200, y: 100});
    });
});
