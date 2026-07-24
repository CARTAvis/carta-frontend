import * as React from "react";
import {fireEvent, render, screen} from "@testing-library/react";

import {FrameScaling} from "enums";

import {ScalingParameterControlComponent} from "./ScalingParameterControlComponent";

describe("ScalingParameterControlComponent parameter isolation", () => {
    test("renders an empty disabled parameter", () => {
        render(<ScalingParameterControlComponent scaling={FrameScaling.GAMMA} min={0.1} max={2} value={undefined} disabled={true} onValueChange={jest.fn()} />);

        expect(screen.getByRole("spinbutton")).toBeDisabled();
        expect((screen.getByRole("spinbutton") as HTMLInputElement).value).toBe("");
        expect(screen.getByRole("slider")).toHaveAttribute("aria-disabled", "true");
        expect(screen.getByRole("button", {name: "Reset gamma to default"})).toBeDisabled();
    });

    test.each([
        [FrameScaling.SINH, 0.5, 1 / 3, "0.333333"],
        [FrameScaling.GAMMA, 0.3, 0.123456789, "0.123457"]
    ])("displays scaling %s with at most six decimal places", (scaling, initialValue, value, expected) => {
        const onValueChange = jest.fn();
        const {rerender} = render(<ScalingParameterControlComponent scaling={scaling} min={0.1} max={2} value={initialValue} onValueChange={onValueChange} />);

        rerender(<ScalingParameterControlComponent scaling={scaling} min={0.1} max={2} value={value} onValueChange={onValueChange} />);

        expect((screen.getByRole("spinbutton") as HTMLInputElement).value).toBe(expected);
    });

    test("discards the focused input draft when the scaling changes", () => {
        const gammaChange = jest.fn();
        const {rerender} = render(<ScalingParameterControlComponent scaling={FrameScaling.LOG} min={0.1} max={10_000} value={1_000} onValueChange={jest.fn()} />);
        const logInput = screen.getByRole("spinbutton");
        fireEvent.focus(logInput);
        fireEvent.change(logInput, {target: {value: "25"}});

        rerender(<ScalingParameterControlComponent scaling={FrameScaling.GAMMA} min={0.1} max={2} value={1.5} onValueChange={gammaChange} />);

        expect((screen.getByRole("spinbutton") as HTMLInputElement).value).toBe("1.5");
        expect(gammaChange).not.toHaveBeenCalled();
    });
});
