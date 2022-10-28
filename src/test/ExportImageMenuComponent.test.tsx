import React from "react";
import "@testing-library/jest-dom";
import {fireEvent, render, screen} from "@testing-library/react";
import {ExportImageMenuComponent} from "../components/Shared";
import {AppStore} from "../stores/AppStore";

describe("test ExportImageMenuComponent", () => {
    
    let modifierStringMock: jest.SpyInstance;
    let exportImageMock: jest.SpyInstance;
    
    beforeEach(() => {
        modifierStringMock = jest.spyOn(AppStore.prototype, "modifierString", "get").mockImplementation(() => "ctrl + ");
        exportImageMock = jest.spyOn(AppStore.Instance, "exportImage");
    });
    
    afterEach(() => {
        jest.restoreAllMocks();
    })
    
    test("renders four list items", () => {
        render(<ExportImageMenuComponent />);
        const listitems = screen.getAllByRole("listitem");
        
        expect(listitems?.length).toEqual(4);
        expect(listitems?.[0]).toHaveTextContent("Resolution");
        expect(listitems?.[1]).toHaveTextContent("Normal (100%)ctrl + E");
        expect(listitems?.[2]).toHaveTextContent("High (200%)");
        expect(listitems?.[3]).toHaveTextContent("Highest (400%)");
    });

    test("calls exportImage() with required image ratio when clicked", () => {
        render(<ExportImageMenuComponent />);

        fireEvent.click(screen.getByText(/Normal /));
        expect(exportImageMock).toBeCalledWith(1);
        fireEvent.click(screen.getByText(/High /));
        expect(exportImageMock).toBeCalledWith(2);
        fireEvent.click(screen.getByText(/Highest /));
        expect(exportImageMock).toBeCalledWith(4);
    })
});