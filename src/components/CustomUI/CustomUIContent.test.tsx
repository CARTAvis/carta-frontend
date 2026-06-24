import * as React from "react";
import {render, screen} from "@testing-library/react";

import {CustomUIStore} from "stores/CustomUI/CustomUIStore";

import {CustomUIContent} from "./CustomUIContent";

jest.mock("react-plotly.js", () => ({__esModule: true, default: () => <div data-testid="plot" />}));

describe("CustomUIContent", () => {
    beforeEach(() => CustomUIStore.Instance.clear());

    test("renders the declarative form for a schema definition", () => {
        CustomUIStore.Instance.registerWidget("w", {schema: {type: "object", properties: {name: {type: "string", title: "Name"}}}});
        render(<CustomUIContent id="w" />);
        expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    test("invokes the imperative render on mount and cleanup on unmount", () => {
        const cleanup = jest.fn();
        const renderFn = jest.fn(() => cleanup);
        CustomUIStore.Instance.registerWidget("i", {render: renderFn});
        const {unmount} = render(<CustomUIContent id="i" />);
        expect(renderFn).toHaveBeenCalledTimes(1);

        expect((renderFn.mock.calls as any)[0][0]).toBeInstanceOf(HTMLElement);
        unmount();
        expect(cleanup).toHaveBeenCalledTimes(1);
    });

    test("renders an empty fallback when no definition exists", () => {
        render(<CustomUIContent id="missing" />);
        expect(screen.getByText(/no definition/i)).toBeInTheDocument();
    });
});
