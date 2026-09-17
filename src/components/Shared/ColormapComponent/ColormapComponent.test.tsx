import * as React from "react";
import {Classes} from "@blueprintjs/core";
import {rs} from "@rstest/core";
import {fireEvent, render, screen} from "@testing-library/react";

import {ColormapComponent} from "./ColormapComponent";

describe("ColormapComponent hover preview", () => {
    test("reports the colormap under the pointer", () => {
        const onColormapHover = rs.fn();
        const onDropdownOpenChange = rs.fn();
        render(<ColormapComponent selectedColormap="inferno" inverted={false} onColormapSelect={rs.fn()} onColormapHover={onColormapHover} onDropdownOpenChange={onDropdownOpenChange} />);

        fireEvent.click(screen.getByTestId("colormap-dropdown"));
        fireEvent.mouseEnter(screen.getByText("viridis"));

        expect(onDropdownOpenChange).toHaveBeenCalledWith(true);
        expect(onColormapHover).toHaveBeenLastCalledWith("viridis");
    });

    test("does not move the keyboard active item when hovering", () => {
        render(<ColormapComponent selectedColormap="inferno" inverted={false} onColormapSelect={rs.fn()} onColormapHover={rs.fn()} />);

        fireEvent.click(screen.getByTestId("colormap-dropdown"));

        const selectedItem = screen.getByRole("menuitem", {name: "inferno"});
        const hoveredItem = screen.getByRole("menuitem", {name: "viridis"});

        expect(selectedItem).toHaveClass(Classes.ACTIVE);
        fireEvent.mouseEnter(hoveredItem);

        expect(selectedItem).toHaveClass(Classes.ACTIVE);
        expect(hoveredItem).not.toHaveClass(Classes.ACTIVE);
    });
});
