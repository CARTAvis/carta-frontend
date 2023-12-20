import React from "react";
import {fireEvent, render, screen} from "@testing-library/react";

import {AppStore} from "stores";

import {ExportImageMenuComponent} from "./ExportImageMenuComponent";

describe("ExportImageMenuComponent", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let mockModifierString: jest.SpyInstance; // Indirectly used when rendering
    let mockExportImage: jest.SpyInstance;

    beforeEach(() => {
        mockModifierString = jest.spyOn(AppStore.prototype, "modifierString", "get").mockImplementation(() => "ctrl + ");
        mockExportImage = jest.spyOn(AppStore.Instance, "exportImage");
    });

    test("renders one menu divider and three menu items", () => {
        render(<ExportImageMenuComponent />);
        expect(screen.getAllByRole("none")?.[0]).toHaveTextContent(/^Resolution$/);

        const menuitems = screen.getAllByRole("menuitem");
        expect(menuitems?.length).toEqual(3);
        expect(menuitems?.[0]).toHaveTextContent(/^Normal \(100%\)ctrl \+ E$/);
        expect(menuitems?.[1]).toHaveTextContent(/^High \(200%\)$/);
        expect(menuitems?.[2]).toHaveTextContent(/^Highest \(400%\)$/);
    });

    test("calls exportImage() with required image ratio when clicked", () => {
        render(<ExportImageMenuComponent />);

        fireEvent.click(screen.getByText(/Normal /));
        expect(mockExportImage).toBeCalledWith(1);
        fireEvent.click(screen.getByText(/High /));
        expect(mockExportImage).toBeCalledWith(2);
        fireEvent.click(screen.getByText(/Highest /));
        expect(mockExportImage).toBeCalledWith(4);
    });
});
