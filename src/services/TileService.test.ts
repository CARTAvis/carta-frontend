jest.mock("models", () => ({TileCoordinate: {addFileIdAndChannel: jest.fn(() => 1)}}));
jest.mock("services", () => ({BackendService: {Instance: {}}, TileWebGLService: {Instance: {gl: null}}}));
jest.mock("stores", () => ({AppStore: {Instance: {}}, PREVIEW_PV_FILEID: -1}));
jest.mock("utilities", () => ({clamp: jest.fn(), copyToFP32Texture: jest.fn(), createFP32Texture: jest.fn(), GL2: {}}));
jest.mock("!worker-loader!zfp_wrapper", () => jest.fn());

import {TileService} from "./TileService";

type TestTileService = {
    activeChannelMapRequests: Map<number, unknown>;
    backendService: {setChannels: jest.Mock};
    cachedTiles: {has: jest.Mock};
    channelMapRequestQueues: Map<number, unknown[]>;
    clearQueueForChannelMap: jest.Mock;
    getCompressedCache: jest.Mock;
    getRequiredRequestTiles: jest.Mock;
    handleChannelMapFlowControl: (eventId: number, message: {fileId: number; receivedChannel: number}) => void;
    pendingDecompressions: Map<string, Map<number, Map<number, boolean>>>;
    pendingRequests: Map<string, Map<number, boolean>>;
    queueChannelMapRequests: (fileId: number, requests: unknown[]) => void;
    requestChannelMapTiles: TileService["requestChannelMapTiles"];
    cancelChannelMapRequests: TileService["cancelChannelMapRequests"];
    updateRemainingTileCount: jest.Mock;
};

const CreateService = () => {
    const service = Object.create(TileService.prototype) as TestTileService;
    let requestId = 0;
    service.backendService = {setChannels: jest.fn(() => ++requestId)};
    service.channelMapRequestQueues = new Map();
    service.activeChannelMapRequests = new Map();
    service.pendingRequests = new Map();
    service.pendingDecompressions = new Map();
    service.updateRemainingTileCount = jest.fn();
    return service;
};

const MakeRequest = (channel: number, tiles: number[] = []) => ({
    fileId: 1,
    channel,
    stokes: 0,
    requiredTiles: {tiles}
});

describe("TileService channel map request queue", () => {
    test("sends one channel at a time and ignores unrelated completion messages", () => {
        const service = CreateService();
        service.queueChannelMapRequests(1, [MakeRequest(2), MakeRequest(3)]);

        expect(service.backendService.setChannels).toHaveBeenCalledTimes(1);
        expect(service.backendService.setChannels).toHaveBeenLastCalledWith(1, 2, 0, {tiles: []}, true);

        service.handleChannelMapFlowControl(1, {fileId: 1, receivedChannel: 9});
        expect(service.backendService.setChannels).toHaveBeenCalledTimes(1);

        service.handleChannelMapFlowControl(99, {fileId: 1, receivedChannel: 2});
        expect(service.backendService.setChannels).toHaveBeenCalledTimes(1);

        service.handleChannelMapFlowControl(1, {fileId: 1, receivedChannel: 2});
        expect(service.backendService.setChannels).toHaveBeenCalledTimes(2);
        expect(service.backendService.setChannels).toHaveBeenLastCalledWith(1, 3, 0, {tiles: []}, true);
    });

    test("replaces unsent channels while allowing the active request to finish", () => {
        const service = CreateService();
        service.queueChannelMapRequests(1, [MakeRequest(1), MakeRequest(2)]);
        service.queueChannelMapRequests(1, [MakeRequest(7), MakeRequest(8)]);

        service.handleChannelMapFlowControl(1, {fileId: 1, receivedChannel: 1});

        expect(service.backendService.setChannels).toHaveBeenCalledTimes(2);
        expect(service.backendService.setChannels).toHaveBeenLastCalledWith(1, 7, 0, {tiles: []}, true);
    });

    test("does not request channels whose tiles are already cached", () => {
        const service = CreateService();
        service.clearQueueForChannelMap = jest.fn();
        service.getRequiredRequestTiles = jest.fn(() => []);
        const frame = {frameInfo: {fileId: 1}, stokes: 0, channel: 1};

        service.requestChannelMapTiles([], frame as never, {x: 0, y: 0}, 11, {min: 0, max: 2});

        expect(service.backendService.setChannels).not.toHaveBeenCalled();
    });

    test("requests only uncached channels and restores the selected channel", () => {
        const service = CreateService();
        service.clearQueueForChannelMap = jest.fn();
        const tile = {x: 0, y: 0, encode: () => 4};
        service.getRequiredRequestTiles = jest.fn((_tiles, _fileId, channel) => (channel === 2 ? [tile] : []));
        const frame = {frameInfo: {fileId: 1}, stokes: 0, channel: 1};

        service.requestChannelMapTiles([], frame as never, {x: 0, y: 0}, 11, {min: 0, max: 2});
        service.handleChannelMapFlowControl(1, {fileId: 1, receivedChannel: 2});

        expect(service.backendService.setChannels.mock.calls.map(call => call[1])).toEqual([2, 1]);
    });

    test("treats GPU-cached tiles as satisfied", () => {
        const service = CreateService();
        service.cachedTiles = {has: jest.fn(() => true)};
        service.getCompressedCache = jest.fn(() => new Map());
        const tile = {layer: 0, encode: () => 4};

        expect(service.getRequiredRequestTiles([tile], 1, 2, 0, false)).toEqual([]);
    });

    test("cancels queued work and clears pending tiles", () => {
        const service = CreateService();
        service.queueChannelMapRequests(1, [MakeRequest(1, [4]), MakeRequest(2, [5])]);

        service.cancelChannelMapRequests(1);
        service.handleChannelMapFlowControl(1, {fileId: 1, receivedChannel: 1});

        expect(service.backendService.setChannels).toHaveBeenCalledTimes(1);
        expect(service.pendingRequests.get("1_0_1")?.size).toBe(0);
    });

    test("abandons the sequence when sending fails", () => {
        const service = CreateService();
        service.backendService.setChannels.mockReturnValue(null);

        service.queueChannelMapRequests(1, [MakeRequest(1, [4]), MakeRequest(2, [5])]);
        service.handleChannelMapFlowControl(1, {fileId: 1, receivedChannel: 1});

        expect(service.backendService.setChannels).toHaveBeenCalledTimes(1);
        expect(service.pendingRequests.get("1_0_1")?.size).toBe(0);
    });
});
