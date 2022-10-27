import React from "react";
import {render, screen} from "@testing-library/react";
import {ExportImageMenuComponent} from "../components/Shared";

describe("test ExportImageMenuComponent", () => {
    test("renders", () => {
        render(<ExportImageMenuComponent />);
        screen.debug();
    });
});