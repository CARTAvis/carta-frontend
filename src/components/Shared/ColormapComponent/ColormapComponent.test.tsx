import * as React from "react";
import {Classes} from "@blueprintjs/core";
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

    test("does not move the keyboard active item when hovering", async () => {
        render(<ColormapComponent selectedColormap="inferno" inverted={false} onColormapSelect={jest.fn()} onColormapHover={jest.fn()} />);

        fireEvent.click(screen.getByTestId("colormap-dropdown"));

        const selectedItem = await screen.findByRole("menuitem", {name: "inferno"});
        const hoveredItem = screen.getByRole("menuitem", {name: "viridis"});

        expect(selectedItem).toHaveClass(Classes.ACTIVE);
        fireEvent.mouseEnter(hoveredItem);

        expect(selectedItem).toHaveClass(Classes.ACTIVE);
        expect(hoveredItem).not.toHaveClass(Classes.ACTIVE);
    });
});
