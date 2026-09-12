import React from "react";
import {act, fireEvent, render, screen} from "@testing-library/react";

import {PreferenceKeys, VectorGraphicFormat} from "enums";
import {AppStore} from "stores";

import {ExportImageMenuComponent} from "./ExportImageMenuComponent";

describe("ExportImageMenuComponent", () => {
    let mockExportImage: jest.SpyInstance;
    let mockExportSvgImage: jest.SpyInstance;
    let mockExportPdfImage: jest.SpyInstance;

    beforeEach(() => {
        mockExportImage = jest.spyOn(AppStore.Instance, "exportImage");
        mockExportSvgImage = jest.spyOn(AppStore.Instance, "exportSvgImage");
        mockExportPdfImage = jest.spyOn(AppStore.Instance, "exportPdfImage");
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test("renders resolution radios and PNG/PDF buttons by default", () => {
        render(<ExportImageMenuComponent />);

        expect(screen.getByRole("heading", {name: "Resolution"})).toBeInTheDocument();

        const radios = screen.getAllByRole("radio");
        expect(radios).toHaveLength(3);
        expect(radios[0]).toBeChecked();
        expect(screen.getAllByRole("button")).toHaveLength(2);
        expect(screen.getByRole("button", {name: "PNG"})).toBeInTheDocument();
        expect(screen.getByRole("button", {name: "PDF"})).toBeInTheDocument();
        expect(screen.queryByRole("button", {name: "SVG"})).not.toBeInTheDocument();
    });

    test("calls the selected PDF export method when clicked", () => {
        render(<ExportImageMenuComponent />);
        const pngButton = screen.getByRole("button", {name: "PNG"});
        const pdfButton = screen.getByRole("button", {name: "PDF"});

        fireEvent.click(pngButton);
        expect(mockExportImage).toHaveBeenCalledWith(1);
        fireEvent.click(pdfButton);
        expect(mockExportPdfImage).toHaveBeenCalledWith(1);

        fireEvent.click(screen.getByRole("radio", {name: "400%"}));
        fireEvent.click(pngButton);
        fireEvent.click(pdfButton);
        expect(mockExportImage).toHaveBeenCalledWith(4);
        expect(mockExportPdfImage).toHaveBeenCalledWith(4);
    });

    test("renders and calls the selected SVG export method", () => {
        AppStore.Instance.preferenceStore.preferences.set(PreferenceKeys.RENDER_CONFIG_VECTOR_GRAPHIC_FORMAT, VectorGraphicFormat.SVG);
        render(<ExportImageMenuComponent />);

        expect(screen.getByRole("button", {name: "PNG"})).toBeInTheDocument();
        expect(screen.getByRole("button", {name: "SVG"})).toBeInTheDocument();
        expect(screen.queryByRole("button", {name: "PDF"})).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", {name: "SVG"}));
        expect(mockExportSvgImage).toHaveBeenCalledWith(1);
        act(() => {
            AppStore.Instance.preferenceStore.preferences.delete(PreferenceKeys.RENDER_CONFIG_VECTOR_GRAPHIC_FORMAT);
        });
    });
});
