import * as React from "react";
import {act, render, screen} from "@testing-library/react";
import {CARTA} from "carta-protobuf";
import {observable, runInAction} from "mobx";

import {AppStore} from "stores";

import {RegionListComponent} from "./RegionListComponent";

jest.mock("react-window", () => ({
    List: ({rowComponent: Row}) => <Row index={0} style={{}} />
}));
jest.mock("components/Shared", () => ({ResizeDetector: ({children}) => children, getRegionIconOpacity: () => 1}));
jest.mock("icons/CustomIcons", () => ({CustomIcon: () => null}));
jest.mock("stores", () => ({AppStore: {Instance: {fileBrowserStore: {isLoadingDialogOpen: false}}}}));
jest.mock("stores/Frame", () => ({CURSOR_REGION_ID: 0, RegionStore: {regionTypeString: () => "Annulus"}, WCS_PRECISION: 10}));
jest.mock("utilities", () => ({
    ...jest.requireActual("utilities/units/units"),
    clamp: jest.requireActual("utilities/math/math").clamp,
    getFormattedWCSPoint: () => ({x: "12:34:56", y: "+10:20:30"})
}));

test.each([CARTA.RegionType.ANNULUS, CARTA.RegionType.ANNANNULUS])("shows and tracks the inner axes on the visible annulus row for type %s", async regionType => {
    const annulus = observable({
        regionId: 1,
        regionType,
        center: {x: 100, y: 200},
        size: {x: 24.6, y: 40.2},
        innerSize: {x: 12.3, y: 20.1},
        rotation: 0,
        nameString: "Test annulus"
    });
    const temporary = {...annulus, regionId: -1, isTemporary: true};
    const frame = {
        isValidWcs: false,
        regionSet: {regions: [temporary, annulus], selectedRegionIds: new Set(), visibleEditableRegionsList: [annulus]}
    };
    Object.assign(AppStore.Instance, {activeFrame: frame});

    const widgetRef = React.createRef<RegionListComponent>();
    await act(async () => {
        render(<RegionListComponent id="region-list" docked={false} ref={widgetRef} />);
    });
    await act(async () => {
        runInAction(() => {
            widgetRef.current.width = 700;
            widgetRef.current.height = 180;
        });
    });
    expect(screen.getByTestId("region-list-table-row-1")).toHaveTextContent("24.6 / 12.340.2 / 20.1");

    act(() => {
        runInAction(() => {
            annulus.innerSize = {x: 6.15, y: 10.05};
        });
    });
    expect(screen.getByTestId("region-list-table-row-1")).toHaveTextContent("24.6 / 6.240.2 / 10.1");
});

test("switches the center between world and pixel coordinates on a WCS image", async () => {
    const overlaySettings = observable({isImgCoordinates: false, global: {}, numbers: {}});
    const region = {regionId: 1, regionType: CARTA.RegionType.POINT, center: {x: 100, y: 200}, size: {x: 0, y: 0}, rotation: 0};
    const regionSet = {regions: [region], selectedRegionIds: new Set(), visibleEditableRegionsList: [region]};
    Object.assign(AppStore.Instance, {activeFrame: {isValidWcs: true, regionSet}, overlaySettings});
    await act(async () => {
        render(<RegionListComponent id="region-list" docked={false} />);
    });

    expect(screen.getByText("Center")).toBeInTheDocument();
    expect(screen.getByTestId("region-list-table-row-1")).toHaveTextContent("12:34:56+10:20:30");

    act(() =>
        runInAction(() => {
            overlaySettings.isImgCoordinates = true;
        })
    );
    expect(screen.getByText("Pixel Center")).toBeInTheDocument();
    expect(screen.getByText("(100.0, 200.0)")).toBeInTheDocument();

    act(() =>
        runInAction(() => {
            overlaySettings.isImgCoordinates = false;
        })
    );
    expect(screen.getByTestId("region-list-table-row-1")).toHaveTextContent("12:34:56+10:20:30");
});
