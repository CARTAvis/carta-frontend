import * as React from "react";
import {render, screen} from "@testing-library/react";

import {LogStore} from "stores/LogStore/LogStore";

import {CustomUIErrorBoundary} from "./CustomUIErrorBoundary";

const Boom = () => {
    throw new Error("kaboom");
};

describe("CustomUIErrorBoundary", () => {
    test("renders children when there is no error", () => {
        render(
            <CustomUIErrorBoundary label="X">
                <div>hello</div>
            </CustomUIErrorBoundary>
        );
        expect(screen.getByText("hello")).toBeInTheDocument();
    });

    test("renders a fallback and logs when a child throws", () => {
        const errorSpy = jest.spyOn(LogStore.Instance, "addError").mockImplementation(() => {});
        jest.spyOn(console, "error").mockImplementation(() => {});
        render(
            <CustomUIErrorBoundary label="X">
                <Boom />
            </CustomUIErrorBoundary>
        );
        expect(screen.getByText(/failed to render/i)).toBeInTheDocument();
        expect(errorSpy).toHaveBeenCalled();
    });
});
