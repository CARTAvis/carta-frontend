import React from "react";
import {fireEvent, render, screen} from "@testing-library/react";

import {AppStore} from "stores";

import {ExportImageMenuComponent} from "./ExportImageMenuComponent";

describe("ExportImageMenuComponent", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let mockModifierString: jest.SpyInstance; // Indirectly used when rendering
    let mockExportImage: jest.SpyInstance;
    let mockExportSvgImage: jest.SpyInstance;

    beforeEach(() => {
        mockModifierString = jest.spyOn(AppStore.prototype, "modifierString", "get").mockImplementation(() => "ctrl + ");
        mockExportImage = jest.spyOn(AppStore.Instance, "exportImage");
        mockExportSvgImage = jest.spyOn(AppStore.Instance, "exportSvgImage");
    });

    test("renders two menu dividers and four menu items", () => {
        render(<ExportImageMenuComponent />);

        const separators = screen.getAllByRole("separator");
        expect(separators).toHaveLength(2);
        expect(separators[0]).toHaveTextContent(/^PNG$/);
        expect(separators[1]).toHaveTextContent(/^SVG$/);

        const menuitems = screen.getAllByRole("menuitem");
        expect(menuitems?.length).toEqual(4);
        expect(menuitems?.[0]).toHaveTextContent(/^Normal \(100%\)ctrl \+ E$/);
        expect(menuitems?.[1]).toHaveTextContent(/^High \(200%\)$/);
        expect(menuitems?.[2]).toHaveTextContent(/^Highest \(400%\)$/);
        expect(menuitems?.[3]).toHaveTextContent(/^Export as SVG$/);
    });

    test("calls the expected export method when clicked", () => {
        render(<ExportImageMenuComponent />);

        fireEvent.click(screen.getByText(/Normal /));
        expect(mockExportImage).toHaveBeenCalledWith(1);
        fireEvent.click(screen.getByText(/High /));
        expect(mockExportImage).toHaveBeenCalledWith(2);
        fireEvent.click(screen.getByText(/Highest /));
        expect(mockExportImage).toHaveBeenCalledWith(4);
        fireEvent.click(screen.getByText(/Export as SVG/));
        expect(mockExportSvgImage).toHaveBeenCalled();
    });
});
