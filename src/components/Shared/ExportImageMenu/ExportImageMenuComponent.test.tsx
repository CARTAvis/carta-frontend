import React from "react";
import {fireEvent, render, screen} from "@testing-library/react";

import {AppStore} from "stores";

import {ExportImageMenuComponent} from "./ExportImageMenuComponent";

describe("ExportImageMenuComponent", () => {
    let mockExportImage: jest.SpyInstance;
    let mockExportSvgImage: jest.SpyInstance;

    beforeEach(() => {
        mockExportImage = jest.spyOn(AppStore.Instance, "exportImage");
        mockExportSvgImage = jest.spyOn(AppStore.Instance, "exportSvgImage");
    });

    test("renders resolution radios and PNG/SVG buttons", () => {
        render(<ExportImageMenuComponent />);

        const separators = screen.getAllByRole("separator");
        expect(separators).toHaveLength(1);
        expect(separators[0]).toHaveTextContent(/^Resolution$/);

        const radios = screen.getAllByRole("radio");
        expect(radios).toHaveLength(3);
        expect(radios[0]).toBeChecked();
        expect(screen.getAllByRole("button")).toHaveLength(2);
        expect(screen.getByRole("button", {name: "PNG"})).toBeInTheDocument();
        expect(screen.getByRole("button", {name: "SVG"})).toBeInTheDocument();
    });

    test("calls the expected export method when clicked", () => {
        render(<ExportImageMenuComponent />);
        const pngButton = screen.getByRole("button", {name: "PNG"});
        const svgButton = screen.getByRole("button", {name: "SVG"});

        fireEvent.click(pngButton);
        expect(mockExportImage).toHaveBeenCalledWith(1);
        fireEvent.click(svgButton);
        expect(mockExportSvgImage).toHaveBeenCalledWith(1);

        fireEvent.click(screen.getByRole("radio", {name: "400%"}));
        fireEvent.click(pngButton);
        fireEvent.click(svgButton);
        expect(mockExportImage).toHaveBeenCalledWith(4);
        expect(mockExportSvgImage).toHaveBeenCalledWith(4);
    });
});
