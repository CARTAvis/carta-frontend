import {render, screen} from "@testing-library/react";

import {CatalogOverlayPlotSettingsPanelComponent} from "./CatalogOverlayPlotSettingsPanelComponent";

describe("CatalogOverlayPlotSettingsPanelComponent without a catalog", () => {
    test("keeps the controls on show, disabled, rather than emptying the panel", () => {
        render(<CatalogOverlayPlotSettingsPanelComponent id="catalog-overlay-0" docked={true} />);

        expect(screen.getByText("File")).toBeInTheDocument();
        expect(screen.getByText("Shape")).toBeInTheDocument();
        expect(screen.getByTestId("catalog-settings-shape-dropdown")).toBeDisabled();
        expect(screen.getByTestId("catalog-settings-major-size-column-dropdown")).toBeDisabled();
    });
});
