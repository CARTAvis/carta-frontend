jest.mock("models", () => ({TileCoordinate: {}}));
jest.mock("services", () => ({BackendService: {Instance: {}}, TileWebGLService: {Instance: {gl: null}}}));
jest.mock("stores", () => ({AppStore: {Instance: {}}, PREVIEW_PV_FILEID: -1}));
jest.mock("utilities", () => ({clamp: jest.fn(), copyToFP32Texture: jest.fn(), createFP32Texture: jest.fn(), GL2: {}}));
jest.mock("!worker-loader!zfp_wrapper", () => jest.fn());

import {CARTA} from "carta-protobuf";

import {TileService} from "./TileService";

type TestTileService = {
    activeChannelMapRequests: Map<number, unknown>;
    backendService: {setChannels: jest.Mock};
    cachedTiles: {has: jest.Mock};
    channelMapRequestQueues: Map<number, unknown[]>;
    channelMap: Map<number, {channel: number; stokes: number}>;
    clearCompressedCache: jest.Mock;
    clearGPUCache: jest.Mock;
    clearQueueForChannelMap: jest.Mock;
    completedChannels: Map<string, boolean>;
    getCompressedCache: jest.Mock;
    getRequiredRequestTiles: jest.Mock;
    handleChannelMapFlowControl: (eventId: number, message: {fileId: number; receivedChannel: number}) => void;
    pendingDecompressions: Map<string, Map<number, Map<number, boolean>>>;
    pendingRequests: Map<string, Map<number, boolean>>;
    pendingSynchronisedTiles: Map<string, Set<number>>;
    queueChannelMapRequests: (fileId: number, requests: unknown[]) => void;
    receivedSynchronisedTiles: Map<string, Map<number, Map<number, unknown>>>;
    requestChannelMapTiles: TileService["requestChannelMapTiles"];
    requestTiles: TileService["requestTiles"];
    cancelChannelMapRequests: TileService["cancelChannelMapRequests"];
    tileStream: {next: jest.Mock};
    updateChannelMapActiveChannel: TileService["updateChannelMapActiveChannel"];
    updateRemainingTileCount: jest.Mock;
};

const CreateService = () => {
    const service = Object.create(TileService.prototype) as TestTileService;
    let requestId = 0;
    service.backendService = {setChannels: jest.fn(() => ++requestId)};
    service.channelMapRequestQueues = new Map();
    service.activeChannelMapRequests = new Map();
    service.channelMap = new Map();
    service.clearCompressedCache = jest.fn();
    service.clearGPUCache = jest.fn();
    service.completedChannels = new Map();
    service.pendingRequests = new Map();
    service.pendingDecompressions = new Map();
    service.pendingSynchronisedTiles = new Map();
    service.receivedSynchronisedTiles = new Map();
    service.tileStream = {next: jest.fn()};
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

    test("tracks the requested channel-map Stokes", () => {
        const service = CreateService();
        service.clearQueueForChannelMap = jest.fn();
        service.getRequiredRequestTiles = jest.fn(() => []);
        const frame = {frameInfo: {fileId: 1}, stokes: 1, channel: 1};
        service.channelMap.set(1, {channel: 1, stokes: 0});

        service.requestChannelMapTiles([], frame as never, {x: 0, y: 0}, 11, {min: 0, max: 2}, true);

        expect(service.clearCompressedCache).toHaveBeenCalledWith(1);
        expect(service.clearGPUCache).toHaveBeenCalledWith(1);
        expect(service.channelMap.get(1)).toEqual({channel: 1, stokes: 1});
        expect(service.backendService.setChannels).toHaveBeenCalledWith(1, 1, 1, {}, true);
    });

    test("switches Stokes before requesting channel-map tiles while another request is active", () => {
        const service = CreateService();
        service.clearQueueForChannelMap = jest.fn();
        const tile = {x: 0, y: 0, encode: () => 4};
        service.getRequiredRequestTiles = jest.fn((_tiles, _fileId, channel) => (channel === 2 ? [tile] : []));
        const frame = {frameInfo: {fileId: 1}, stokes: 1, channel: 1};

        service.queueChannelMapRequests(1, [MakeRequest(0, [4])]);
        service.updateChannelMapActiveChannel(1, 1, 1);
        service.requestChannelMapTiles([], frame as never, {x: 0, y: 0}, 11, {min: 0, max: 2}, true);
        service.handleChannelMapFlowControl(1, {fileId: 1, receivedChannel: 0});

        expect(service.backendService.setChannels).toHaveBeenNthCalledWith(2, 1, 1, 1, {}, true);

        service.handleChannelMapFlowControl(2, {fileId: 1, receivedChannel: 1});
        expect(service.backendService.setChannels).toHaveBeenNthCalledWith(3, 1, 2, 1, {fileId: 1, compressionQuality: 11, compressionType: CARTA.CompressionType.ZFP, tiles: [4]}, true);
    });

    test("treats GPU-cached tiles as satisfied", () => {
        const service = CreateService();
        service.cachedTiles = {has: jest.fn(() => true)};
        service.getCompressedCache = jest.fn(() => new Map());
        const tile = {layer: 0, encode: () => 4};

        expect(service.getRequiredRequestTiles([tile], 1, 32768, 0, false)).toEqual([]);
        expect(service.cachedTiles.has).toHaveBeenCalledWith("1_32768_4");
    });

    test("updates the backend channel when all normal-view tiles are cached", () => {
        const service = CreateService();
        service.getRequiredRequestTiles = jest.fn(() => []);

        service.requestTiles([], 1, 2, 0, {x: 0, y: 0}, 11, true);

        expect(service.backendService.setChannels).toHaveBeenCalledWith(1, 2, 0, {fileId: 1, compressionQuality: 11, compressionType: CARTA.CompressionType.ZFP, tiles: []});
        expect(service.tileStream.next).toHaveBeenCalledWith({tileCount: 0, fileId: 1, channel: 2, stokes: 0, flush: false});
    });

    test("clears normal-view GPU tiles when Stokes changes", () => {
        const service = CreateService();
        service.channelMap.set(1, {channel: 2, stokes: 0});
        service.getRequiredRequestTiles = jest.fn(() => []);

        service.requestTiles([], 1, 2, 1, {x: 0, y: 0}, 11, true);

        expect(service.clearGPUCache).toHaveBeenCalledWith(1);
    });

    test("keeps normal-view GPU tiles when only the channel changes", () => {
        const service = CreateService();
        service.channelMap.set(1, {channel: 2, stokes: 0});
        service.getRequiredRequestTiles = jest.fn(() => []);

        service.requestTiles([], 1, 3, 0, {x: 0, y: 0}, 11, true);

        expect(service.clearGPUCache).not.toHaveBeenCalled();
    });

    test("cancels queued work and clears pending tiles", () => {
        const service = CreateService();
        service.queueChannelMapRequests(1, [MakeRequest(1, [4]), MakeRequest(2, [5])]);

        service.cancelChannelMapRequests(1);
        service.handleChannelMapFlowControl(1, {fileId: 1, receivedChannel: 1});

        expect(service.backendService.setChannels).toHaveBeenCalledTimes(1);
        expect(service.pendingRequests.get("1_0_1")?.size).toBe(0);
    });

    test("cancels pending tiles only for the exact file ID", () => {
        const service = CreateService();
        service.pendingRequests.set("1_0_1", new Map([[4, true]]));
        service.pendingRequests.set("10_0_1", new Map([[5, true]]));

        service.cancelChannelMapRequests(1);

        expect(service.pendingRequests.get("1_0_1")?.size).toBe(0);
        expect(service.pendingRequests.get("10_0_1")?.size).toBe(1);
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
