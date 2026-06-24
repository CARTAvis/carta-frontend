import * as React from "react";
import {fireEvent, render, screen} from "@testing-library/react";

import {ajv8Validator, BlueprintForm} from "./BlueprintTheme";

jest.mock("react-plotly.js", () => ({__esModule: true, default: () => <div data-testid="plot" />}));

describe("BlueprintForm theme", () => {
    test("renders a text input and emits onChange", () => {
        const onChange = jest.fn();
        render(<BlueprintForm validator={ajv8Validator} schema={{type: "object", properties: {name: {type: "string", title: "Name"}}}} onChange={onChange} />);
        const input = screen.getByRole("textbox");
        fireEvent.change(input, {target: {value: "abc"}});
        expect(onChange).toHaveBeenCalled();
        const last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
        expect(last.formData.name).toBe("abc");
    });

    test("renders a select for an enum and emits onChange", () => {
        const onChange = jest.fn();
        render(<BlueprintForm validator={ajv8Validator} schema={{type: "object", properties: {color: {type: "string", enum: ["red", "green"]}}}} onChange={onChange} />);
        const select = screen.getByRole("combobox");
        fireEvent.change(select, {target: {value: "green"}});
        const last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
        expect(last.formData.color).toBe("green");
    });

    test("renders the plot field for ui:field plot", () => {
        render(<BlueprintForm validator={ajv8Validator} schema={{type: "object", properties: {chart: {type: "object"}}}} uiSchema={{chart: {"ui:field": "plot"}}} formData={{chart: {data: []}}} />);
        expect(screen.getByTestId("plot")).toBeInTheDocument();
    });
});
