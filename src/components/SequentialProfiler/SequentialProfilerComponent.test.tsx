import * as React from "react";
import {act, fireEvent, render, screen} from "@testing-library/react";
import {observable, runInAction} from "mobx";

import {RegionGroupType} from "enums";

jest.mock("carta-protobuf", () => ({CARTA: {StatsType: {Sum: 2, FluxDensity: 3, Mean: 4, Max: 5}}}), {virtual: true});
jest.mock("components/Shared", () => ({
    LinePlotComponent: ({xMin, xMax, multiPlotPropsMap}) => (
        <div data-testid="plot-data" data-x-min={xMin} data-x-max={xMax}>
            {JSON.stringify(Array.from(multiPlotPropsMap, ([name, props]) => ({name, data: props.data})))}
        </div>
    )
}));
jest.mock("utilities", () => ({getColorForTheme: () => "#000", SELECTABLE_COLORS: ["blue"]}));
jest.mock("stores", () => ({
    AppStore: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        get Instance() {
            return MOCK_APP_STORE;
        }
    },
    WidgetsStore: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        get Instance() {
            return MOCK_WIDGETS_STORE;
        }
    },
    SEQUENTIAL_X_AXIS_OPTIONS: [{value: "index", label: "Index"}]
}));

import {RegionGroupStore} from "../../stores/RegionGroupStore/RegionGroupStore";
import {RegionGroupManagerComponent} from "../RegionGroup/RegionGroupManagerComponent";

import {SequentialProfilerComponent} from "./SequentialProfilerComponent";

const GROUPS = observable.map<string, any>();
const MOCK_WIDGETS_STORE = {
    sequentialProfileWidgets: new Map([["sequential-profiler-0", {getLineColor: () => "auto-blue", plotType: "Lines", lineWidth: 1, linePlotPointSize: 3, visibleXAxisFormats: ["index"]}]])
};
const FRAME = {id: 2, frameInfo: {fileId: 2}, filename: "frame.fits", requiredStokes: 0, headerUnit: "Jy/beam", regionSet: {editableRegionsList: [{regionId: 7, isClosedRegion: true, nameString: "Region 7"}]}};
const MOCK_APP_STORE = {
    get regionGroupStores() {
        return Array.from(GROUPS.values());
    },
    timeSeriesStore: {elements: [{frame: {id: 1}}]},
    frames: [FRAME],
    activeFrame: FRAME,
    frameNames: [{value: 2, label: "frame.fits"}],
    getFrame: (id: number) => (id === 1 ? {id} : id === 2 ? FRAME : undefined),
    isDarkTheme: false,
    setRegionGroupManagerSelectedId: () => undefined,
    createRegionGroup: (type = RegionGroupType.TIME_SERIES) => {
        const group = new RegionGroupStore("region-series", "Region Group 1", type);
        runInAction(() => GROUPS.set(group.regionGroupId, group));
        return group;
    },
    syncRegionSeriesGroup: (group: RegionGroupStore) => {
        group.syncRegionSeriesFrame({frameId: 2, stokes: 0, regionIds: [7], regionSumUnit: "Jy/beam", regionFluxDensityUnit: "Jy"}, () => ({regionFluxDensity: 8}));
    }
};

test("plots a newly created region series immediately", () => {
    GROUPS.set("light-curve", {
        regionGroupId: "light-curve",
        regionGroupName: "Light curve 1",
        regionGroupType: RegionGroupType.TIME_SERIES,
        entries: [{frameId: 1, region: {mjdUtc: 59000, regionFluxDensity: 3, isDisplayed: true}}]
    });
    const {unmount} = render(<SequentialProfilerComponent id="sequential-profiler-0" docked={true} />);
    expect(screen.getByTestId("plot-data")).toHaveTextContent("Light curve 1");

    act(() => {
        runInAction(() => {
            GROUPS.set("region-series", {
                regionGroupId: "region-series",
                regionGroupName: "Region Group 2",
                regionGroupType: RegionGroupType.REGION_SERIES,
                regionSeriesFrameId: 2,
                entries: [{frameId: 2, region: {regionId: 7, regionFluxDensity: 8, isDisplayed: true}}]
            });
        });
    });

    expect(screen.getByTestId("plot-data")).toHaveTextContent("Region series 2");
    expect(screen.getByTestId("plot-data")).toHaveTextContent('"x":7,"y":8');
    expect(screen.getByTestId("plot-data")).not.toHaveTextContent("Light curve 1");
    unmount();
    GROUPS.clear();
});

test("plots intensity mean and max for time-series groups", () => {
    MOCK_APP_STORE.timeSeriesStore.elements = [{frame: {id: 1}}];
    runInAction(() => {
        GROUPS.set("light-curve", {
            regionGroupId: "light-curve",
            regionGroupName: "Light curve 1",
            regionGroupType: RegionGroupType.TIME_SERIES,
            entries: [{frameId: 1, region: {mjdUtc: 59000, regionFluxDensity: 3, regionMean: 4, regionMax: 8, regionSum: 12, isDisplayed: true}}]
        });
    });

    const {unmount} = render(<SequentialProfilerComponent id="sequential-profiler-0" docked={true} />);
    const statisticSelect = screen.getAllByRole("combobox")[1];
    expect(screen.getByRole("option", {name: "Intensity mean"})).toBeInTheDocument();
    expect(screen.getByRole("option", {name: "Intensity max"})).toBeInTheDocument();

    fireEvent.change(statisticSelect, {target: {value: "4"}});
    expect(screen.getByTestId("plot-data")).toHaveTextContent('"y":4');
    fireEvent.change(statisticSelect, {target: {value: "5"}});
    expect(screen.getByTestId("plot-data")).toHaveTextContent('"y":8');

    unmount();
    GROUPS.clear();
});

test("leaves space outside the first and last time-series points", () => {
    MOCK_APP_STORE.timeSeriesStore.elements = [{frame: {id: 1}}];
    GROUPS.set("light-curve", {
        regionGroupId: "light-curve",
        regionGroupName: "Light curve 1",
        regionGroupType: RegionGroupType.TIME_SERIES,
        entries: [
            {frameId: 1, region: {mjdUtc: 59000, regionFluxDensity: 3, isDisplayed: true}},
            {frameId: 2, region: {mjdUtc: 59001, regionFluxDensity: 4, isDisplayed: true}}
        ]
    });

    const {unmount} = render(<SequentialProfilerComponent id="sequential-profiler-0" docked={true} />);
    const plot = screen.getByTestId("plot-data");
    expect(Number(plot.getAttribute("data-x-min"))).toBeCloseTo(58999.95);
    expect(Number(plot.getAttribute("data-x-max"))).toBeCloseTo(59001.05);
    unmount();
    GROUPS.clear();
});

test("creating a region series from management replaces the empty plot", async () => {
    MOCK_APP_STORE.timeSeriesStore.elements = [];
    const {unmount} = render(
        <>
            <SequentialProfilerComponent id="sequential-profiler-0" docked={true} />
            <RegionGroupManagerComponent id="sequential-profiler-0" docked={false} />
        </>
    );
    expect(screen.getByText("No series")).toBeInTheDocument();

    await act(async () => {
        fireEvent.click(screen.getByRole("button", {name: "New region series"}));
    });

    expect(screen.queryByText("No series")).not.toBeInTheDocument();
    expect(screen.getByTestId("plot-data")).toHaveTextContent('"x":7,"y":8');
    unmount();
    GROUPS.clear();
});
