import * as React from "react";
import {render, screen} from "@testing-library/react";

import {CustomUIStore} from "stores/CustomUI/CustomUIStore";
import {DialogStore} from "stores/DialogStore/DialogStore";

import {CustomDialogComponent} from "./CustomDialogComponent";

jest.mock("react-plotly.js", () => ({__esModule: true, default: () => <div data-testid="plot" />}));
jest.mock("components/Dialogs/DraggableDialog/DraggableDialogComponent", () => ({
    DraggableDialogComponent: (props: any) => (props.dialogProps.isOpen ? <div data-testid="dialog">{props.children}</div> : null)
}));

describe("CustomDialogComponent", () => {
    beforeEach(() => {
        CustomUIStore.Instance.clear();
        DialogStore.Instance.dialogVisible.clear();
    });

    test("renders a dialog only for open dialog-surface definitions", () => {
        CustomUIStore.Instance.registerDialog("d", {title: "D", schema: {type: "object", properties: {name: {type: "string"}}}});
        const {rerender} = render(<CustomDialogComponent />);
        expect(screen.queryByTestId("dialog")).toBeNull();

        DialogStore.Instance.dialogVisible.set("d", true);
        rerender(<CustomDialogComponent />);
        expect(screen.getByTestId("dialog")).toBeInTheDocument();
        expect(screen.getByRole("textbox")).toBeInTheDocument();
    });
});
