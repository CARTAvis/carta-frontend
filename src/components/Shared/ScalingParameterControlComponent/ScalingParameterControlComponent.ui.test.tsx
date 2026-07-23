import * as React from "react";
import {fireEvent, render, screen} from "@testing-library/react";

import {FrameScaling} from "enums";

import {ScalingParameterControlComponent} from "./ScalingParameterControlComponent";

describe("ScalingParameterControlComponent parameter isolation", () => {
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
