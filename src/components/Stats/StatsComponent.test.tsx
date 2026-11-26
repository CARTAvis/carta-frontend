import type {ReactNode} from "react";
import {fireEvent, render, screen, within} from "@testing-library/react";
import {CARTA} from "carta-protobuf";
import {runInAction} from "mobx";

import {PreferenceKeys} from "enums/preference";
import {AppStore, PreferenceStore} from "stores";
import {exportTsvFile} from "utilities/export/export";

import {StatsComponent} from "./StatsComponent";

jest.mock("components/Shared", () => ({
    RegionSelectorComponent: () => null,
    ResizeDetector: ({children}: {children: ReactNode}) => children
}));
jest.mock("components/Shared/LinePlot/Toolbar/ToolbarComponent", () => ({
    ToolbarComponent: ({exportData}: {exportData: () => void}) => <button onClick={exportData}>Export data</button>
}));
jest.mock("utilities/export/export", () => ({
    ...jest.requireActual("utilities/export/export"),
    exportTsvFile: jest.fn()
}));

afterEach(() => {
    runInAction(() => PreferenceStore.Instance.preferences.delete(PreferenceKeys.STATISTICS));
    jest.restoreAllMocks();
});

test("displays and exports only enabled statistics with the image intensity unit", () => {
    const frame = {
        frameInfo: {fileId: 0, fileInfoExtended: {stokes: 1}},
        filename: "cube.fits",
        headerUnit: "Jy/beam",
        getBeamProperties: () => null,
        polarizationInfo: [],
        requiredStokes: 0,
        coordinateOptionsZ: [],
        regionSet: {regions: []}
    };
    const widget = {effectiveFrame: frame, effectiveRegionId: -1, coordinate: "z", setCoordinate: jest.fn()};
    const statistics = [
        {statsType: CARTA.StatsType.Mean, value: 1},
        {statsType: CARTA.StatsType.Median, value: 2},
        {statsType: CARTA.StatsType.Q1, value: 3},
        {statsType: CARTA.StatsType.Q3, value: 4},
        {statsType: CARTA.StatsType.Quartile, value: 1},
        {statsType: CARTA.StatsType.MedAbsDevMed, value: 5}
    ];
    jest.spyOn(AppStore, "Instance", "get").mockReturnValue({
        preferenceStore: PreferenceStore.Instance,
        regionStats: new Map([[0, new Map([[-1, new Map([[0, {statistics}]])]])]]),
        widgetsStore: {statsWidgets: new Map([["stats", widget]]), setWidgetTitle: jest.fn()}
    } as unknown as AppStore);
    runInAction(() => PreferenceStore.Instance.preferences.set(PreferenceKeys.STATISTICS, [CARTA.StatsType.Median, CARTA.StatsType.Q1, CARTA.StatsType.Quartile, CARTA.StatsType.MedAbsDevMed]));

    render(<StatsComponent id="stats" docked />);
    const table = within(screen.getByTestId("statistics-table"));
    const enabledNames = ["Median", "Q1", "Quartile (Q3-Q1)", "MedAbsDevMed"];
    for (const name of enabledNames) {
        expect(table.getByRole("cell", {name}).closest("tr")).toHaveTextContent("Jy/beam");
    }
    expect(table.queryByRole("cell", {name: "Q3"})).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", {name: "Export data"}));
    expect(exportTsvFile).toHaveBeenCalledWith("cube.fits", "statistics", expect.any(String));
    const tsv = jest.mocked(exportTsvFile).mock.calls[0][2];
    const rows = tsv.split("\n").map(line => line.split("\t"));
    for (const name of enabledNames) {
        expect(rows.find(([label]) => label.trim() === name)?.[2]).toBe("Jy/beam");
    }
    expect(rows.some(([label]) => label.trim() === "Q3")).toBe(false);
});
