import React from "react";
import {rs} from "@rstest/core";
import {render, waitFor} from "@testing-library/react";
import type {ColorResult} from "@uiw/react-color";

import {ColorPickerComponent} from "./ColorPickerComponent";

// eslint-disable-next-line @typescript-eslint/naming-convention
const mockColorPickerChange = rs.fn();

rs.mock("./ColorPickerPopover", () => ({
    ColorPickerPopover: ({onChange, children}: {onChange: (color: ColorResult) => void; children: React.ReactNode}) => {
        mockColorPickerChange.mockImplementation(onChange);
        return children;
    }
}));

describe("ColorPickerComponent", () => {
    const redWithZeroAlpha: ColorResult = {
        rgb: {r: 255, g: 0, b: 0},
        hsl: {h: 0, s: 100, l: 50},
        hsv: {h: 0, s: 100, v: 100},
        rgba: {r: 255, g: 0, b: 0, a: 0},
        hsla: {h: 0, s: 100, l: 50, a: 0},
        hsva: {h: 0, s: 100, v: 100, a: 0},
        xy: {x: 0.64, y: 0.33},
        hex: "#ff0000",
        hexa: "#ff000000"
    };

    it("preserves RGB values when alpha is zero", async () => {
        const setColor = rs.fn();

        render(<ColorPickerComponent color="#000000" presetColors={[]} darkTheme={false} disableAlpha={false} setColor={setColor} />);

        mockColorPickerChange(redWithZeroAlpha);

        await waitFor(() => expect(setColor).toHaveBeenCalledWith(redWithZeroAlpha));

        const redWithAlpha = {...redWithZeroAlpha, rgba: {...redWithZeroAlpha.rgba, a: 1}, hsla: {...redWithZeroAlpha.hsla, a: 1}, hsva: {...redWithZeroAlpha.hsva, a: 1}, hexa: "#ff0000ff"};
        mockColorPickerChange(redWithAlpha);

        await waitFor(() => expect(setColor).toHaveBeenLastCalledWith(redWithAlpha));
    });

    it("delivers the pending color when unmounted", () => {
        rs.useFakeTimers();
        try {
            const setColor = rs.fn();
            const {unmount} = render(<ColorPickerComponent color="#000000" presetColors={[]} darkTheme={false} disableAlpha={false} setColor={setColor} />);
            const finalColor = {...redWithZeroAlpha, hexa: "#ff0000ff"};

            mockColorPickerChange(redWithZeroAlpha);
            mockColorPickerChange(finalColor);
            expect(setColor).toHaveBeenCalledTimes(1);

            unmount();
            expect(setColor).toHaveBeenLastCalledWith(finalColor);
            rs.runOnlyPendingTimers();
            expect(setColor).toHaveBeenCalledTimes(2);
        } finally {
            rs.useRealTimers();
        }
    });
});
