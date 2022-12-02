import React from "react";
import {fireEvent, render, screen} from "@testing-library/react";
import {ExportImageMenuComponent} from "../components/Shared";
import {AppStore} from "../stores/AppStore";

describe("ExportImageMenuComponent", () => {
    let mockModifierString: jest.SpyInstance;
    let mockExportImage: jest.SpyInstance;

    beforeEach(() => {
        mockModifierString = jest.spyOn(AppStore.prototype, "modifierString", "get").mockImplementation(() => "ctrl + ");
        mockExportImage = jest.spyOn(AppStore.Instance, "exportImage");
    });

    test("renders four list items", () => {
        render(<ExportImageMenuComponent />);
        const listitems = screen.getAllByRole("listitem");

        expect(listitems?.length).toEqual(4);
        expect(listitems?.[0]).toHaveTextContent(/^Resolution$/);
        expect(listitems?.[1]).toHaveTextContent(/^Normal \(100%\)ctrl \+ E$/);
        expect(listitems?.[2]).toHaveTextContent(/^High \(200%\)$/);
        expect(listitems?.[3]).toHaveTextContent(/^Highest \(400%\)$/);
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
