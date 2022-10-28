import React from "react";
import {render, screen} from "@testing-library/react";
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
    
    test("renders", () => {
        render(<ExportImageMenuComponent />);
        screen.debug();
    });
});