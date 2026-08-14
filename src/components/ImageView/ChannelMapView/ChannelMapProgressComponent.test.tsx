import * as React from "react";
import {Classes} from "@blueprintjs/core";
import {render, screen} from "@testing-library/react";

const MOCK_TILE_SERVICE = {channelMapTotalTiles: 10, channelMapRenderedTiles: 6};
const MOCK_APP_STORE = {isDarkTheme: false};

jest.mock("services", () => ({TileService: {Instance: MOCK_TILE_SERVICE}}));
jest.mock("stores", () => ({AppStore: {Instance: MOCK_APP_STORE}}));

import {ChannelMapProgressComponent} from "./ChannelMapProgressComponent";

describe("ChannelMapProgressComponent", () => {
    beforeEach(() => {
        MOCK_APP_STORE.isDarkTheme = false;
        MOCK_TILE_SERVICE.channelMapRenderedTiles = 6;
    });

    test("shows rendered and total channel-map tiles while loading", () => {
        render(<ChannelMapProgressComponent />);

        expect(screen.getByTestId("channel-map-progress")).not.toHaveClass(Classes.DARK);
        expect(screen.getByTestId("channel-map-progress")).toHaveTextContent("6 / 10");
    });

    test("applies Blueprint's dark theme when the app is dark", () => {
        MOCK_APP_STORE.isDarkTheme = true;
        render(<ChannelMapProgressComponent />);

        expect(screen.getByTestId("channel-map-progress")).toHaveClass(Classes.DARK);
    });

    test("hides after all channel-map tiles are rendered", () => {
        MOCK_TILE_SERVICE.channelMapRenderedTiles = 10;
        render(<ChannelMapProgressComponent />);

        expect(screen.queryByTestId("channel-map-progress")).not.toBeInTheDocument();
    });
});
