import * as React from "react";
import {Classes} from "@blueprintjs/core";
import {act, render, screen} from "@testing-library/react";

const MOCK_TILE_SERVICE = {channelMapTotalTiles: 10, channelMapRenderedTiles: 6, isChannelMapLoading: true};
const MOCK_APP_STORE = {isDarkTheme: false};

jest.mock("services", () => ({TileService: {Instance: MOCK_TILE_SERVICE}}));
jest.mock("stores", () => ({AppStore: {Instance: MOCK_APP_STORE}}));

import {ChannelMapProgressComponent} from "./ChannelMapProgressComponent";

describe("ChannelMapProgressComponent", () => {
    beforeEach(() => {
        jest.useFakeTimers();
        MOCK_APP_STORE.isDarkTheme = false;
        MOCK_TILE_SERVICE.channelMapRenderedTiles = 6;
        MOCK_TILE_SERVICE.isChannelMapLoading = true;
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test("shows rendered and total channel-map tiles while loading", () => {
        render(<ChannelMapProgressComponent />);

        expect(screen.queryByTestId("channel-map-progress")).not.toBeInTheDocument();
        act(() => jest.advanceTimersByTime(3_000));

        expect(screen.getByTestId("channel-map-progress")).not.toHaveClass(Classes.DARK);
        expect(screen.getByTestId("channel-map-progress")).toHaveTextContent("6 / 10");
    });

    test("applies Blueprint's dark theme when the app is dark", () => {
        MOCK_APP_STORE.isDarkTheme = true;
        render(<ChannelMapProgressComponent />);
        act(() => jest.advanceTimersByTime(3_000));

        expect(screen.getByTestId("channel-map-progress")).toHaveClass(Classes.DARK);
    });

    test("hides after all channel-map tiles are rendered", () => {
        MOCK_TILE_SERVICE.channelMapRenderedTiles = 10;
        MOCK_TILE_SERVICE.isChannelMapLoading = false;
        render(<ChannelMapProgressComponent />);

        expect(screen.queryByTestId("channel-map-progress")).not.toBeInTheDocument();
    });

    test("does not show when rendering finishes within three seconds", () => {
        const {unmount} = render(<ChannelMapProgressComponent />);
        MOCK_TILE_SERVICE.channelMapRenderedTiles = 10;
        MOCK_TILE_SERVICE.isChannelMapLoading = false;
        unmount();
        render(<ChannelMapProgressComponent />);
        act(() => jest.advanceTimersByTime(3_000));

        expect(screen.queryByTestId("channel-map-progress")).not.toBeInTheDocument();
    });
});
