import React from "react";
import {rs} from "@rstest/core";
import {fireEvent, render, screen} from "@testing-library/react";

const {MockExportImage} = rs.hoisted(() => ({MockExportImage: rs.fn()}));

rs.mock("stores", () => ({
    AppStore: {Instance: {exportImage: MockExportImage, modifierString: "ctrl + "}}
}));

import {ExportImageMenuComponent} from "./ExportImageMenuComponent";

describe("ExportImageMenuComponent", () => {
    afterEach(() => {
        MockExportImage.mockClear();
    });

    test("renders one menu divider and three menu items", () => {
        render(<ExportImageMenuComponent />);
        expect(screen.getByRole("separator")).toHaveTextContent(/^Resolution$/);

        const menuitems = screen.getAllByRole("menuitem");
        expect(menuitems?.length).toEqual(3);
        expect(menuitems?.[0]).toHaveTextContent(/^Normal \(100%\)ctrl \+ E$/);
        expect(menuitems?.[1]).toHaveTextContent(/^High \(200%\)$/);
        expect(menuitems?.[2]).toHaveTextContent(/^Highest \(400%\)$/);
    });

    test("calls exportImage() with required image ratio when clicked", () => {
        render(<ExportImageMenuComponent />);

        fireEvent.click(screen.getByText(/Normal /));
        expect(MockExportImage).toHaveBeenCalledWith(1);
        fireEvent.click(screen.getByText(/High /));
        expect(MockExportImage).toHaveBeenCalledWith(2);
        fireEvent.click(screen.getByText(/Highest /));
        expect(MockExportImage).toHaveBeenCalledWith(4);
    });
});
