import React from "react";
import {render} from "@testing-library/react";

import {FlexLayoutDomMarker} from "./WidgetButton";

describe("FlexLayoutDomMarker", () => {
    test("marks docked widget content containers", () => {
        const {container} = render(
            <div>
                <FlexLayoutDomMarker nodeId="widget-1" target="tab-content" />
            </div>
        );

        expect(container.firstElementChild).toHaveAttribute("data-testid", "widget-1-content");
    });
});
