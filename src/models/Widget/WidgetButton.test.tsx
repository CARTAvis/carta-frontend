import React from "react";
import {fireEvent, render, screen} from "@testing-library/react";

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

    test("marks the FlexLayout maximize button", () => {
        render(
            <div>
                <button data-layout-path="/model/tabset/button/max" />
                <FlexLayoutDomMarker nodeId="widget-2" target="tabset-toolbar" />
            </div>
        );

        expect(screen.getByRole("button")).toHaveAttribute("data-testid", "widget-2-header-maximize-button");
    });

    test("stops tabstrip double clicks from bubbling to FlexLayout maximize handler", () => {
        const onDoubleClick = jest.fn();

        render(
            <div data-layout-path="/model/tabset/tabstrip" onDoubleClick={onDoubleClick}>
                <div data-testid="toolbar">
                    <FlexLayoutDomMarker nodeId="widget-3" target="tabset-tabstrip" />
                </div>
            </div>
        );

        fireEvent.doubleClick(screen.getByTestId("toolbar"));

        expect(onDoubleClick).not.toHaveBeenCalled();
    });
});
