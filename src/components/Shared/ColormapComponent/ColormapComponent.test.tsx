import * as React from "react";
import {fireEvent, render, screen} from "@testing-library/react";

import {ColormapComponent} from "./ColormapComponent";

describe("ColormapComponent hover preview", () => {
    test("reports the colormap under the pointer", async () => {
        const onColormapHover = jest.fn();
        const onDropdownOpenChange = jest.fn();
        render(<ColormapComponent selectedColormap="inferno" inverted={false} onColormapSelect={jest.fn()} onColormapHover={onColormapHover} onDropdownOpenChange={onDropdownOpenChange} />);

        fireEvent.click(screen.getByTestId("colormap-dropdown"));
        fireEvent.mouseEnter(await screen.findByText("viridis"));

        expect(onDropdownOpenChange).toHaveBeenCalledWith(true);
        expect(onColormapHover).toHaveBeenLastCalledWith("viridis");
    });
});
