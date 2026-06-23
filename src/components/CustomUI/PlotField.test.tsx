import * as React from "react";
import {render} from "@testing-library/react";

import {PlotField} from "./PlotField";

jest.mock("react-plotly.js", () => ({
    __esModule: true,
    default: (props: any) => <div data-testid="plot" data-traces={(props.data ?? []).length} />
}));

describe("PlotField", () => {
    test("renders a Plot with the bound data array", () => {
        const {getByTestId} = render(<PlotField {...({formData: {data: [{x: [1], y: [2]}], layout: {title: "t"}}} as any)} />);
        expect(getByTestId("plot").getAttribute("data-traces")).toBe("1");
    });

    test("renders safely with empty formData", () => {
        const {getByTestId} = render(<PlotField {...({} as any)} />);
        expect(getByTestId("plot").getAttribute("data-traces")).toBe("0");
    });
});
