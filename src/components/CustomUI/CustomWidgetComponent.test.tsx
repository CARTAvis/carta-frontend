import * as React from "react";
import {render, screen} from "@testing-library/react";

import {CustomUIStore} from "stores/CustomUI/CustomUIStore";

import {CustomWidgetComponent} from "./CustomWidgetComponent";

jest.mock("react-plotly.js", () => ({__esModule: true, default: () => <div data-testid="plot" />}));

describe("CustomWidgetComponent", () => {
    beforeEach(() => CustomUIStore.Instance.clear());

    test("exposes a 'custom' WidgetConfig type", () => {
        expect(CustomWidgetComponent.WidgetConfig.type).toBe("custom");
    });

    test("renders the content engine for its id", () => {
        CustomUIStore.Instance.registerWidget("w", {schema: {type: "object", properties: {name: {type: "string"}}}});
        render(<CustomWidgetComponent {...({id: "w", docked: true} as any)} />);
        expect(screen.getByRole("textbox")).toBeInTheDocument();
    });
});
