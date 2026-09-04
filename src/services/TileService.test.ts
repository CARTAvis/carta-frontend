jest.mock("models", () => ({TileCoordinate: {}}));
jest.mock("services", () => ({BackendService: {Instance: {}}, TileWebGLService: {Instance: {gl: null}}}));
jest.mock("stores", () => ({
    AppStore: {
        Instance: {
            alertStore: {dismissInteractiveAlert: jest.fn(), showInteractiveAlert: jest.fn()},
            channelMapStore: {channelArray: [], isChannelMapEnabled: false}
        }
    },
    PREVIEW_PV_FILEID: -1
}));
jest.mock("utilities", () => ({clamp: jest.fn(), copyToFP32Texture: jest.fn(), createFP32Texture: jest.fn(), GL2: {}}));
jest.mock("!worker-loader!zfp_wrapper", () => jest.fn());

import {TileService} from "./TileService";

describe("channel-map color blending", () => {
    const makeService = () =>
        Object.assign(Object.create(TileService.prototype), {
            backendService: {setChannels: jest.fn(() => true)},
            channelMapRequestedChannels: new Map(),
            streamingTileRanges: new Map(),
            pendingRequests: new Map(),
            getRequiredRequestTiles: jest.fn(tiles => tiles),
            updateRemainingTileCount: jest.fn()
        });

    test("requests each layer's channels with the existing range protocol", () => {
        const service = makeService();
        const tiles = [{encode: () => 42}];
        service.requestChannelMapTiles(tiles, {frameInfo: {fileId: 1}, channel: 0, stokes: 0}, {x: 0, y: 0}, 11, [0, 1, 2]);
        service.requestChannelMapTiles(tiles, {frameInfo: {fileId: 2}, channel: 7, stokes: 0}, {x: 0, y: 0}, 11, [7]);
        expect(service.backendService.setChannels.mock.calls.map(call => [call[0], call[5]])).toEqual([
            [1, {min: 0, max: 2}],
            [2, {min: 7, max: 7}]
        ]);
        expect(service.channelMapRequestedChannels.get(2)).toEqual(new Set([7]));
    });

    test("changing one layer's viewport preserves another layer's pending tiles", () => {
        const service = makeService();
        service.pendingRequests.set("1_0_0", new Map([[10, true]]));
        service.pendingRequests.set("2_0_7", new Map([[10, true]]));
        service.clearQueueForChannelMap(service.pendingRequests, 1, {min: 0, max: 3}, [20], [10]);
        expect(service.pendingRequests.has("1_0_0")).toBe(false);
        expect(service.pendingRequests.has("2_0_7")).toBe(true);
    });

    test("cancelling a layer preserves other file requests", () => {
        const service = makeService();
        service.pendingRequests.set("1_0_0", new Map([[10, true]]));
        service.pendingRequests.set("10_0_7", new Map([[10, true]]));
        service.cancelChannelMapRequests(1);
        expect(service.pendingRequests.get("1_0_0").size).toBe(0);
        expect(service.pendingRequests.get("10_0_7").size).toBe(1);
    });
});
