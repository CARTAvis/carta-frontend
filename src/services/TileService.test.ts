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

import {CARTA} from "carta-protobuf";

import {AppStore} from "stores";

import {TileService} from "./TileService";

type TestTileService = {
    backendService: {addRequiredTiles: jest.Mock; animationId: number; setChannels: jest.Mock};
    cachedTiles: {get?: jest.Mock; has: jest.Mock; peek?: jest.Mock; setpop?: jest.Mock};
    channelMapPendingTileCount: number;
    channelMapPendingTiles: Set<string>;
    channelMapStates: Map<
        number,
        {
            queue: unknown[];
            activeRequest?: {channel: number; requestId: number};
            timeout?: ReturnType<typeof setTimeout>;
            desiredStokes?: number;
            confirmedStokes?: number;
            generation: number;
        }
    >;
    fileStateMap: Map<number, {channel: number; stokes: number}>;
    clearCompressedCache: jest.Mock;
    clearGPUCache: jest.Mock;
    clearQueueForChannelMap: jest.Mock;
    getCompressedCache: jest.Mock;
    getTile: TileService["getTile"];
    getRequiredRequestTiles: jest.Mock;
    handleChannelMapFlowControl: (eventId: number, message: {fileId: number; completedChannel: number; status: CARTA.ChannelMapFlowControl.Status}) => void;
    handleStreamSync: (message: CARTA.RasterTileSync.$Properties, requestId?: number) => void;
    isAnimationEnabled: boolean;
    isChannelMapLoading: boolean;
    pendingDecompressions: Map<string, Map<number, Map<number, boolean>>>;
    pendingRasterRequests: Map<number, RasterRequestState>;
    pendingRequests: Map<string, Map<number, boolean>>;
    queueChannelMapRequests: (fileId: number, requests: unknown[]) => void;
    queueRasterRequest: (requestId: number, request: RasterRequestState) => void;
    rasterSyncStates: Map<number, RasterSyncState>;
    rasterViewGenerations: Map<string, number>;
    resolveChannelMapTile: (fileId: number, stokes: number, channel: number, encodedCoordinate: number) => void;
    requestChannelMapTiles: TileService["requestChannelMapTiles"];
    requestTiles: TileService["requestTiles"];
    cancelChannelMapRequests: TileService["cancelChannelMapRequests"];
    resetForSessionResume: TileService["resetForSessionResume"];
    setChannelMapTargetTiles: (tiles: Array<{layer: number; encode: () => number}>, fileId: number, stokes: number, channelRange: {min: number; max: number}) => void;
    tileStream: {next: jest.Mock};
    trackPendingRequests: (fileId: number, channel: number, stokes: number, tiles: number[]) => void;
    textureCoordinateQueue: number[];
    updateChannelMapActiveChannel: TileService["updateChannelMapActiveChannel"];
    updateHiddenFileChannels: TileService["updateHiddenFileChannels"];
    updateRemainingTileCount: jest.Mock;
    updateStream: (result: {fileId: number; channel: number; stokes: number; data: Float32Array; width: number; height: number; encodedCoordinate: number; syncId: number; generation: number}) => void;
    completeSynchronisedTiles: (location: {fileId: number; channel: number; stokes: number; syncId: number}) => void;
};

type RasterRequestState = {
    key: string;
    requestedTiles: Set<number>;
    viewGeneration: number;
    shouldSynchronize: boolean;
};

type RasterSyncState = RasterRequestState & {
    generation: number;
    pendingRequestTiles: Set<number>;
    pendingDecompressions: Map<number, boolean>;
    receivedTiles: Map<number, {width: number; height: number; textureCoordinate: number; data: Float32Array}>;
    isComplete: boolean;
    expectedTileCount: number;
};

const CreateService = () => {
    const service = Object.create(TileService.prototype) as TestTileService;
    let requestId = 0;
    service.backendService = {addRequiredTiles: jest.fn(() => ++requestId), animationId: 0, setChannels: jest.fn(() => ++requestId)};
    service.channelMapStates = new Map();
    service.channelMapPendingTileCount = 0;
    service.channelMapPendingTiles = new Set();
    service.cachedTiles = {has: jest.fn(() => false), setpop: jest.fn()};
    service.fileStateMap = new Map();
    service.clearCompressedCache = jest.fn();
    service.clearGPUCache = jest.fn();
    service.pendingRequests = new Map();
    service.pendingDecompressions = new Map();
    service.pendingRasterRequests = new Map();
    service.rasterSyncStates = new Map();
    service.rasterViewGenerations = new Map();
    service.isAnimationEnabled = false;
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

const Complete = (channel: number) => ({
    fileId: 1,
    completedChannel: channel,
    status: CARTA.ChannelMapFlowControl.Status.COMPLETED
});

const MockShowInteractiveAlert = AppStore.Instance.alertStore.showInteractiveAlert as jest.Mock;
const MockDismissInteractiveAlert = AppStore.Instance.alertStore.dismissInteractiveAlert as jest.Mock;
const GetChannelMapState = (service: TestTileService, fileId: number = 1) => service.channelMapStates.get(fileId);
const MakeRasterRequest = (tiles: number[], viewGeneration: number = 1, shouldSynchronize: boolean = true): RasterRequestState => ({
    key: "1_0_1",
    requestedTiles: new Set(tiles),
    viewGeneration,
    shouldSynchronize
});
const MakeRasterSync = (tiles: number[], viewGeneration: number = 1, shouldSynchronize: boolean = true): RasterSyncState => ({
    ...MakeRasterRequest(tiles, viewGeneration, shouldSynchronize),
    generation: 0,
    pendingRequestTiles: new Set(tiles),
    pendingDecompressions: new Map(),
    receivedTiles: new Map(),
    isComplete: false,
    expectedTileCount: tiles.length
});

describe("TileService channel map request queue", () => {
    beforeEach(() => {
        jest.useFakeTimers();
        MockDismissInteractiveAlert.mockReset();
        MockShowInteractiveAlert.mockReset();
    });

    afterEach(() => {
        jest.restoreAllMocks();
        jest.useRealTimers();
    });

    test("sends one channel at a time and ignores unrelated completion messages", () => {
        const service = CreateService();
        jest.spyOn(console, "warn").mockImplementation();
        service.queueChannelMapRequests(1, [MakeRequest(2), MakeRequest(3)]);

        expect(service.backendService.setChannels).toHaveBeenCalledTimes(1);
        expect(service.backendService.setChannels).toHaveBeenLastCalledWith(1, 2, 0, {tiles: []}, true);

        service.handleChannelMapFlowControl(1, Complete(9));
        expect(service.backendService.setChannels).toHaveBeenCalledTimes(1);

        service.handleChannelMapFlowControl(99, Complete(2));
        expect(service.backendService.setChannels).toHaveBeenCalledTimes(1);

        service.handleChannelMapFlowControl(1, Complete(2));
        expect(service.backendService.setChannels).toHaveBeenCalledTimes(2);
        expect(service.backendService.setChannels).toHaveBeenLastCalledWith(1, 3, 0, {tiles: []}, true);
    });

    test("replaces unsent channels while allowing the active request to finish", () => {
        const service = CreateService();
        service.queueChannelMapRequests(1, [MakeRequest(1), MakeRequest(2)]);
        service.queueChannelMapRequests(1, [MakeRequest(7), MakeRequest(8)]);

        service.handleChannelMapFlowControl(1, Complete(1));

        expect(service.backendService.setChannels).toHaveBeenCalledTimes(2);
        expect(service.backendService.setChannels).toHaveBeenLastCalledWith(1, 7, 0, {tiles: []}, true);
    });

    test("requests the active channel histogram when all tiles are cached", () => {
        const service = CreateService();
        service.clearQueueForChannelMap = jest.fn();
        service.getRequiredRequestTiles = jest.fn(() => []);
        const frame = {frameInfo: {fileId: 1}, stokes: 0, channel: 1};

        service.requestChannelMapTiles([], frame as never, {x: 0, y: 0}, 11, {min: 0, max: 2});

        expect(service.backendService.setChannels).toHaveBeenCalledTimes(1);
        expect(service.backendService.setChannels).toHaveBeenCalledWith(1, 1, 0, {}, true);
    });

    test("queues the active channel histogram when its tile request is already in flight", () => {
        const service = CreateService();
        service.clearQueueForChannelMap = jest.fn();
        service.getRequiredRequestTiles = jest.fn(() => []);
        const frame = {frameInfo: {fileId: 1}, stokes: 0, channel: 1};
        service.queueChannelMapRequests(1, [MakeRequest(1, [4])]);

        service.requestChannelMapTiles([], frame as never, {x: 0, y: 0}, 11, {min: 0, max: 2});
        service.handleChannelMapFlowControl(1, Complete(1));

        expect(service.backendService.setChannels).toHaveBeenCalledTimes(2);
        expect(service.backendService.setChannels).toHaveBeenLastCalledWith(1, 1, 0, {}, true);
    });

    test("requests only uncached channels and restores the selected channel", () => {
        const service = CreateService();
        service.clearQueueForChannelMap = jest.fn();
        const tile = {x: 0, y: 0, encode: () => 4};
        service.getRequiredRequestTiles = jest.fn((_tiles, _fileId, channel) => (channel === 2 ? [tile] : []));
        const frame = {frameInfo: {fileId: 1}, stokes: 0, channel: 1};

        service.requestChannelMapTiles([], frame as never, {x: 0, y: 0}, 11, {min: 0, max: 2});
        service.handleChannelMapFlowControl(1, Complete(1));
        service.handleChannelMapFlowControl(2, Complete(2));

        expect(service.backendService.setChannels.mock.calls.map(call => call[1])).toEqual([1, 2, 1]);
    });

    test("requests uncached active-channel tiles first and restores the selected channel", () => {
        const service = CreateService();
        service.clearQueueForChannelMap = jest.fn();
        const tile = {x: 0, y: 0, encode: () => 4};
        service.getRequiredRequestTiles = jest.fn(() => [tile]);
        const frame = {frameInfo: {fileId: 1}, stokes: 0, channel: 1};

        service.requestChannelMapTiles([], frame as never, {x: 0, y: 0}, 11, {min: 0, max: 2});
        service.handleChannelMapFlowControl(1, Complete(1));
        service.handleChannelMapFlowControl(2, Complete(1));
        service.handleChannelMapFlowControl(3, Complete(0));
        service.handleChannelMapFlowControl(4, Complete(2));
        service.handleChannelMapFlowControl(5, Complete(1));

        expect(service.backendService.setChannels.mock.calls.map(call => call[1])).toEqual([1, 1, 0, 2, 1]);
    });

    test("tracks the requested channel-map Stokes", () => {
        const service = CreateService();
        service.clearQueueForChannelMap = jest.fn();
        service.getRequiredRequestTiles = jest.fn(() => []);
        const frame = {frameInfo: {fileId: 1}, stokes: 1, channel: 1};
        service.fileStateMap.set(1, {channel: 1, stokes: 0});

        service.requestChannelMapTiles([], frame as never, {x: 0, y: 0}, 11, {min: 0, max: 2}, true);

        expect(service.clearCompressedCache).not.toHaveBeenCalled();
        expect(service.clearGPUCache).not.toHaveBeenCalled();
        expect(service.fileStateMap.get(1)).toEqual({channel: 1, stokes: 1});
        expect(service.backendService.setChannels).toHaveBeenCalledWith(1, 1, 1, {}, true);
    });

    test("does not retain synchronization state for cached Stokes channels", () => {
        const service = CreateService();
        service.clearQueueForChannelMap = jest.fn();
        const tile = {x: 0, y: 0, encode: () => 4};
        service.getRequiredRequestTiles = jest.fn((_tiles, _fileId, channel) => (channel === 1 ? [tile] : []));
        const frame = {frameInfo: {fileId: 1}, stokes: 1, channel: 1};
        service.fileStateMap.set(1, {channel: 1, stokes: 0});

        service.requestChannelMapTiles([tile] as never, frame as never, {x: 0, y: 0}, 11, {min: 0, max: 2}, true);

        const queuedRasterRequests = (GetChannelMapState(service)?.queue as Array<{rasterRequest?: RasterRequestState}>).flatMap(request => (request.rasterRequest ? [request.rasterRequest.key] : []));
        expect(queuedRasterRequests).toEqual(["1_1_1"]);
    });

    test("preserves a Stokes transition when a refresh replaces the queue", () => {
        const service = CreateService();
        service.clearQueueForChannelMap = jest.fn();
        const tile = {x: 0, y: 0, encode: () => 4};
        service.getRequiredRequestTiles = jest.fn((_tiles, _fileId, channel) => (channel === 2 ? [tile] : []));
        const frame = {frameInfo: {fileId: 1}, stokes: 1, channel: 1};
        service.fileStateMap.set(1, {channel: 0, stokes: 0});

        service.queueChannelMapRequests(1, [MakeRequest(0, [4])]);
        service.requestChannelMapTiles([], frame as never, {x: 0, y: 0}, 11, {min: 0, max: 2}, true);
        service.requestChannelMapTiles([], frame as never, {x: 0, y: 0}, 11, {min: 0, max: 2});
        service.handleChannelMapFlowControl(1, Complete(0));

        expect(service.backendService.setChannels).toHaveBeenNthCalledWith(2, 1, 1, 1, {}, true);

        service.handleChannelMapFlowControl(2, Complete(1));
        expect(service.backendService.setChannels).toHaveBeenNthCalledWith(3, 1, 2, 1, {fileId: 1, compressionQuality: 11, compressionType: CARTA.CompressionType.ZFP, tiles: [4]}, true);
    });

    test.each([CARTA.ChannelMapFlowControl.Status.REJECTED, CARTA.ChannelMapFlowControl.Status.CANCELLED])("stops the sequence when the backend returns status %s", status => {
        const service = CreateService();
        service.queueChannelMapRequests(1, [MakeRequest(1, [4]), MakeRequest(2, [5])]);
        service.handleStreamSync({fileId: 1, channel: 1, stokes: 0, syncId: 7, animationId: 0, tileCount: 1, endSync: false});

        service.handleChannelMapFlowControl(1, {
            fileId: 1,
            completedChannel: 1,
            status
        });

        expect(service.backendService.setChannels).toHaveBeenCalledTimes(1);
        expect(GetChannelMapState(service)?.queue).toEqual([]);
        expect(service.pendingRequests.get("1_0_1")?.size).toBe(0);
        expect(service.pendingDecompressions.has("1_0_1")).toBe(false);
        expect(service.rasterSyncStates.has(7)).toBe(false);
        expect(GetChannelMapState(service)?.generation).toBe(1);
    });

    test("treats GPU-cached tiles as satisfied", () => {
        const service = CreateService();
        service.cachedTiles = {has: jest.fn(() => true)};
        service.getCompressedCache = jest.fn(() => new Map());
        const tile = {layer: 0, encode: () => 4};

        expect(service.getRequiredRequestTiles([tile], 1, 32768, 0, false)).toEqual([]);
        expect(service.cachedTiles.has).toHaveBeenCalledWith("1_0_32768_4");
    });

    test("uses separate GPU cache entries for each Stokes value", () => {
        const service = CreateService();
        service.cachedTiles = {get: jest.fn(), has: jest.fn(), peek: jest.fn()};

        service.getTile(1, 0, 2, 4);
        service.getTile(1, 1, 2, 4, true);

        expect(service.cachedTiles.get).toHaveBeenCalledWith("1_0_2_4");
        expect(service.cachedTiles.peek).toHaveBeenCalledWith("1_1_2_4");
    });

    test("does not reuse a compressed tile from another Stokes value", () => {
        const service = CreateService();
        service.cachedTiles = {has: jest.fn(() => false)};
        service.getCompressedCache = jest.fn(() => new Map([["1_0_2_4", {}]]));
        const tile = {layer: 0, encode: () => 4};

        expect(service.getRequiredRequestTiles([tile], 1, 2, 1, false)).toEqual([tile]);
        expect(service.getCompressedCache).toHaveBeenCalledWith(1);
    });

    test("updates the backend channel when all normal-view tiles are cached", () => {
        const service = CreateService();
        service.getRequiredRequestTiles = jest.fn(() => []);

        service.requestTiles([], 1, 2, 0, {x: 0, y: 0}, 11, true);

        expect(service.backendService.setChannels).toHaveBeenCalledWith(1, 2, 0, {fileId: 1, compressionQuality: 11, compressionType: CARTA.CompressionType.ZFP, tiles: []});
        expect(service.tileStream.next).toHaveBeenCalledWith({tileCount: 0, fileId: 1, channel: 2, stokes: 0, flush: false});
    });

    test("uses SetImageChannels only for the first normal-view synchronization", () => {
        const service = CreateService();
        const tile = {x: 0, y: 0, encode: () => 4};
        service.getRequiredRequestTiles = jest.fn(() => [tile]);

        service.requestTiles([tile] as never, 1, 2, 0, {x: 0, y: 0}, 11, true);
        service.requestTiles([tile] as never, 1, 2, 0, {x: 0, y: 0}, 11);

        expect(service.backendService.setChannels).toHaveBeenCalledTimes(1);
        expect(service.backendService.addRequiredTiles).toHaveBeenCalledTimes(1);
    });

    test("keeps normal-view tile caches when Stokes changes", () => {
        const service = CreateService();
        service.fileStateMap.set(1, {channel: 2, stokes: 0});
        service.getRequiredRequestTiles = jest.fn(() => []);

        service.requestTiles([], 1, 2, 1, {x: 0, y: 0}, 11, true);

        expect(service.clearCompressedCache).not.toHaveBeenCalled();
        expect(service.clearGPUCache).not.toHaveBeenCalled();
    });

    test("keeps normal-view GPU tiles when only the channel changes", () => {
        const service = CreateService();
        service.fileStateMap.set(1, {channel: 2, stokes: 0});
        service.getRequiredRequestTiles = jest.fn(() => []);

        service.requestTiles([], 1, 3, 0, {x: 0, y: 0}, 11, true);

        expect(service.clearGPUCache).not.toHaveBeenCalled();
    });

    test("cancels queued work and clears pending tiles", () => {
        const service = CreateService();
        service.queueChannelMapRequests(1, [MakeRequest(1, [4]), MakeRequest(2, [5])]);

        service.cancelChannelMapRequests(1);
        service.handleChannelMapFlowControl(1, Complete(1));

        expect(service.backendService.setChannels).toHaveBeenCalledTimes(1);
        expect(service.pendingRequests.get("1_0_1")?.size).toBe(0);
    });

    test("cancels channel-map state for every file", () => {
        const service = CreateService();
        service.queueChannelMapRequests(1, [MakeRequest(1, [4])]);
        service.queueChannelMapRequests(2, [{fileId: 2, channel: 2, stokes: 0, requiredTiles: {tiles: [5]}}]);

        service.cancelChannelMapRequests();

        expect(GetChannelMapState(service, 1)).toEqual(expect.objectContaining({queue: [], activeRequest: undefined, generation: 1}));
        expect(GetChannelMapState(service, 2)).toEqual(expect.objectContaining({queue: [], activeRequest: undefined, generation: 1}));
    });

    test("cancels pending tiles only for the exact file ID", () => {
        const service = CreateService();
        service.pendingRequests.set("1_0_1", new Map([[4, true]]));
        service.pendingRequests.set("10_0_1", new Map([[5, true]]));

        service.cancelChannelMapRequests(1);

        expect(service.pendingRequests.get("1_0_1")?.size).toBe(0);
        expect(service.pendingRequests.get("10_0_1")?.size).toBe(1);
    });

    test("resets in-flight tile state for session resume", () => {
        const service = CreateService();
        service.fileStateMap.set(1, {channel: 1, stokes: 0});
        service.channelMapStates.set(1, {queue: [], generation: 3});
        service.pendingRequests.set("1_0_1", new Map([[4, true]]));
        service.pendingDecompressions.set("1_0_1", new Map([[7, new Map([[4, true]])]]));
        service.pendingRasterRequests.set(7, MakeRasterRequest([4]));
        service.rasterSyncStates.set(7, {...MakeRasterSync([4]), generation: 3});
        service.rasterViewGenerations.set("1_0_1", 1);

        service.resetForSessionResume();

        expect(service.pendingRequests.size).toBe(0);
        expect(service.pendingDecompressions.size).toBe(0);
        expect(service.pendingRasterRequests.size).toBe(0);
        expect(service.rasterSyncStates.size).toBe(0);
        expect(service.rasterViewGenerations.size).toBe(0);
        expect(GetChannelMapState(service)?.generation).toBe(4);
    });

    test("restarts the timeout when the user chooses to keep waiting", async () => {
        const service = CreateService();
        MockShowInteractiveAlert.mockResolvedValue(true);
        service.queueChannelMapRequests(1, [MakeRequest(1, [4]), MakeRequest(2, [5])]);

        jest.advanceTimersByTime(39_999);
        expect(MockShowInteractiveAlert).not.toHaveBeenCalled();
        jest.advanceTimersByTime(1);
        await Promise.resolve();

        expect(MockShowInteractiveAlert).toHaveBeenCalledWith(expect.stringContaining("Updating channel map takes longer than 40 seconds"), "warning-sign");
        expect(GetChannelMapState(service)?.activeRequest).toBeDefined();
        expect(GetChannelMapState(service)?.queue.length).toBeGreaterThan(0);
        expect(GetChannelMapState(service)?.timeout).toBeDefined();

        jest.advanceTimersByTime(10_000);
        service.handleChannelMapFlowControl(1, Complete(1));
        jest.advanceTimersByTime(29_999);
        expect(MockShowInteractiveAlert).toHaveBeenCalledTimes(1);
        jest.advanceTimersByTime(1);
        await Promise.resolve();
        expect(MockShowInteractiveAlert).toHaveBeenCalledTimes(2);
    });

    test("shares one timeout across all channels in a request", async () => {
        const service = CreateService();
        MockShowInteractiveAlert.mockResolvedValue(false);
        service.queueChannelMapRequests(1, [MakeRequest(1), MakeRequest(2), MakeRequest(3), MakeRequest(4)]);

        jest.advanceTimersByTime(50_000);
        service.handleChannelMapFlowControl(1, Complete(1));
        jest.advanceTimersByTime(29_999);
        expect(MockShowInteractiveAlert).not.toHaveBeenCalled();

        jest.advanceTimersByTime(1);
        await Promise.resolve();

        expect(MockShowInteractiveAlert).toHaveBeenCalledWith(expect.stringContaining("Updating channel map takes longer than 80 seconds"), "warning-sign");
    });

    test("dismisses its timeout alert when all requested channels finish", async () => {
        const service = CreateService();
        let resolveDecision: (shouldKeepWaiting: boolean) => void;
        const timeoutAlert = new Promise<boolean>(resolve => (resolveDecision = resolve));
        MockShowInteractiveAlert.mockReturnValue(timeoutAlert);
        service.queueChannelMapRequests(1, [MakeRequest(1), MakeRequest(2)]);

        jest.advanceTimersByTime(40_000);
        service.handleChannelMapFlowControl(1, Complete(1));
        jest.advanceTimersByTime(100_000);
        expect(MockShowInteractiveAlert).toHaveBeenCalledTimes(1);
        expect(MockDismissInteractiveAlert).not.toHaveBeenCalled();

        service.handleChannelMapFlowControl(2, Complete(2));
        expect(MockDismissInteractiveAlert).toHaveBeenCalledWith(timeoutAlert);

        resolveDecision!(false);
        await Promise.resolve();
    });

    test("clears the stalled request when the user stops waiting", async () => {
        const service = CreateService();
        MockShowInteractiveAlert.mockResolvedValue(false);
        service.queueChannelMapRequests(1, [MakeRequest(1, [4]), MakeRequest(2, [5])]);

        jest.advanceTimersByTime(40_000);
        await Promise.resolve();

        expect(GetChannelMapState(service)?.activeRequest).toBeUndefined();
        expect(GetChannelMapState(service)?.queue).toEqual([]);
        expect(service.pendingRequests.get("1_0_1")?.size).toBe(0);
        expect(GetChannelMapState(service)?.generation).toBe(1);
    });

    test("applies a timeout decision to the current request in the same batch", async () => {
        const service = CreateService();
        let resolveDecision: (shouldKeepWaiting: boolean) => void;
        MockShowInteractiveAlert.mockReturnValue(new Promise(resolve => (resolveDecision = resolve)));
        service.queueChannelMapRequests(1, [MakeRequest(1), MakeRequest(2)]);

        jest.advanceTimersByTime(40_000);
        service.handleChannelMapFlowControl(1, Complete(1));
        resolveDecision!(false);
        await Promise.resolve();

        expect(service.backendService.setChannels).toHaveBeenCalledTimes(2);
        expect(GetChannelMapState(service)?.activeRequest).toBeUndefined();
        expect(GetChannelMapState(service)?.queue).toEqual([]);
    });

    test("retires synchronization state when cancelled", () => {
        const service = CreateService();
        service.fileStateMap.set(1, {channel: 1, stokes: 0});
        service.pendingDecompressions.set("1_0_1", new Map([[7, new Map()]]));
        service.pendingRasterRequests.set(7, MakeRasterRequest([4]));
        service.rasterSyncStates.set(7, {...MakeRasterSync([4]), isComplete: true});
        service.rasterViewGenerations.set("1_0_1", 1);

        service.cancelChannelMapRequests(1);

        expect(GetChannelMapState(service)?.generation).toBe(1);
        expect(service.pendingRasterRequests.has(7)).toBe(false);
        expect(service.pendingDecompressions.has("1_0_1")).toBe(false);
        expect(service.rasterSyncStates.has(7)).toBe(false);
        expect(service.rasterViewGenerations.has("1_0_1")).toBe(false);
    });

    test("discards decompression results from a cancelled generation", () => {
        const service = CreateService();
        service.fileStateMap.set(1, {channel: 1, stokes: 0});
        service.channelMapStates.set(1, {queue: [], generation: 1});
        service.pendingDecompressions.set("1_0_1", new Map([[-1, new Map([[4, true]])]]));

        service.updateStream({fileId: 1, channel: 1, stokes: 0, data: new Float32Array([1]), width: 1, height: 1, encodedCoordinate: 4, syncId: -1, generation: 0});

        expect(service.pendingDecompressions.get("1_0_1")?.get(-1)?.has(4)).toBe(true);
        expect(service.tileStream.next).not.toHaveBeenCalled();
    });

    test("caches a completed decompression from a previously selected Stokes value", () => {
        const service = CreateService();
        service.fileStateMap.set(1, {channel: 1, stokes: 1});
        service.channelMapStates.set(1, {queue: [], generation: 0});
        service.pendingDecompressions.set("1_0_1", new Map([[-1, new Map([[4, true]])]]));
        service.cachedTiles = {has: jest.fn(), setpop: jest.fn()};
        service.textureCoordinateQueue = [3];

        service.updateStream({fileId: 1, channel: 1, stokes: 0, data: new Float32Array([1]), width: 1, height: 1, encodedCoordinate: 4, syncId: -1, generation: 0});

        expect(service.cachedTiles.setpop).toHaveBeenCalledWith("1_0_1_4", expect.objectContaining({data: new Float32Array([1])}));
        expect(service.tileStream.next).toHaveBeenCalledWith({tileCount: 1, fileId: 1, channel: 1, stokes: 0, flush: false});
    });

    test("tracks unique uncached tiles in the current channel-map viewport", () => {
        const service = CreateService();
        const tile = {layer: 0, encode: () => 4};
        service.cachedTiles.has.mockImplementation(key => key === "1_0_0_4");

        service.setChannelMapTargetTiles([tile], 1, 0, {min: 0, max: 2});

        expect(service.channelMapPendingTiles).toEqual(new Set(["1_0_1_4", "1_0_2_4"]));
        expect(service.isChannelMapLoading).toBe(true);

        service.resolveChannelMapTile(1, 0, 1, 4);
        service.resolveChannelMapTile(1, 0, 1, 4);
        service.resolveChannelMapTile(1, 0, 3, 4);
        expect(service.channelMapPendingTileCount).toBe(1);

        service.resolveChannelMapTile(1, 0, 2, 4);
        expect(service.isChannelMapLoading).toBe(false);
    });

    test("completes a synchronized stream when no requested tiles succeed", () => {
        const service = CreateService();
        const tile = {layer: 0, encode: () => 4};
        service.fileStateMap.set(1, {channel: 1, stokes: 0});
        service.setChannelMapTargetTiles([tile], 1, 0, {min: 1, max: 1});
        service.pendingRasterRequests.set(101, MakeRasterRequest([4]));
        service.rasterViewGenerations.set("1_0_1", 1);

        service.handleStreamSync({fileId: 1, channel: 1, stokes: 0, syncId: 7, animationId: 0, tileCount: 1, endSync: false}, 101);
        service.handleStreamSync({fileId: 1, channel: 1, stokes: 0, syncId: 7, animationId: 0, tileCount: 0, endSync: true});

        expect(service.pendingDecompressions.has("1_0_1")).toBe(false);
        expect(service.rasterSyncStates.has(7)).toBe(false);
        expect(service.isChannelMapLoading).toBe(false);
        expect(service.tileStream.next).toHaveBeenCalledWith({tileCount: 0, fileId: 1, channel: 1, stokes: 0, flush: true});
    });

    test("keeps a newer overlapping request pending when an older sync completes", () => {
        const service = CreateService();
        service.fileStateMap.set(1, {channel: 1, stokes: 0});
        service.trackPendingRequests(1, 1, 0, [4]);
        service.queueRasterRequest(101, MakeRasterRequest([4], 1));
        service.handleStreamSync({fileId: 1, channel: 1, stokes: 0, syncId: 7, animationId: 0, tileCount: 1, endSync: false}, 101);

        service.trackPendingRequests(1, 1, 0, [4, 5]);
        service.queueRasterRequest(102, MakeRasterRequest([4, 5], 2));
        service.handleStreamSync({fileId: 1, channel: 1, stokes: 0, syncId: 8, animationId: 0, tileCount: 2, endSync: false}, 102);
        service.handleStreamSync({fileId: 1, channel: 1, stokes: 0, syncId: 7, animationId: 0, tileCount: 0, endSync: true});

        expect(Array.from(service.pendingRequests.get("1_0_1")?.keys() ?? [])).toEqual([4, 5]);
        expect(service.rasterSyncStates.get(8)?.pendingRequestTiles).toEqual(new Set([4, 5]));
    });

    test("binds a raster sync to the exact outbound request after pending tiles change", () => {
        const service = CreateService();
        service.trackPendingRequests(1, 1, 0, [4]);
        service.queueRasterRequest(102, MakeRasterRequest([4]));
        service.pendingRequests.set("1_0_1", new Map([[9, true]]));

        service.handleStreamSync({fileId: 1, channel: 1, stokes: 0, syncId: 7, animationId: 0, tileCount: 1, endSync: false}, 102);

        expect(service.rasterSyncStates.get(7)?.requestedTiles).toEqual(new Set([4]));
        expect(service.rasterSyncStates.get(7)?.pendingRequestTiles).toEqual(new Set([4]));
    });

    test("consumes the matching pending request for a legacy sync event ID", () => {
        const service = CreateService();
        service.trackPendingRequests(1, 1, 0, [4]);
        service.queueRasterRequest(102, MakeRasterRequest([4]));

        service.handleStreamSync({fileId: 1, channel: 1, stokes: 0, syncId: 7, animationId: 0, tileCount: 1, endSync: false}, 0);

        expect(service.pendingRasterRequests.has(102)).toBe(false);
        expect(service.rasterSyncStates.get(7)?.requestedTiles).toEqual(new Set([4]));
    });

    test("keeps a newer synchronized viewport when an older sync completes", () => {
        const service = CreateService();
        service.fileStateMap.set(1, {channel: 1, stokes: 0});
        service.cachedTiles = {has: jest.fn(), setpop: jest.fn()};
        service.textureCoordinateQueue = [1, 2];
        service.rasterViewGenerations.set("1_0_1", 2);

        const oldSync = {...MakeRasterSync([4], 1), isComplete: true};
        oldSync.receivedTiles.set(4, {width: 1, height: 1, textureCoordinate: -1, data: new Float32Array([4])});
        const newSync = {...MakeRasterSync([5], 2), isComplete: true};
        newSync.receivedTiles.set(5, {width: 1, height: 1, textureCoordinate: -1, data: new Float32Array([5])});
        service.rasterSyncStates.set(7, oldSync);
        service.rasterSyncStates.set(8, newSync);
        service.pendingDecompressions.set(
            "1_0_1",
            new Map([
                [7, oldSync.pendingDecompressions],
                [8, newSync.pendingDecompressions]
            ])
        );

        service.completeSynchronisedTiles({fileId: 1, channel: 1, stokes: 0, syncId: 7});

        expect(service.rasterSyncStates.has(7)).toBe(false);
        expect(service.rasterSyncStates.has(8)).toBe(true);
        expect(service.tileStream.next).toHaveBeenLastCalledWith({tileCount: 1, fileId: 1, channel: 1, stokes: 0, flush: false});

        service.completeSynchronisedTiles({fileId: 1, channel: 1, stokes: 0, syncId: 8});

        expect(service.rasterSyncStates.has(8)).toBe(false);
        expect(service.cachedTiles.setpop).toHaveBeenCalledTimes(2);
        expect(service.tileStream.next).toHaveBeenLastCalledWith({tileCount: 1, fileId: 1, channel: 1, stokes: 0, flush: true});
    });

    test("keeps hidden-file caches when only the channel changes", () => {
        const service = CreateService();
        service.fileStateMap.set(1, {channel: 1, stokes: 0});

        service.updateHiddenFileChannels(1, 2, 0);

        expect(service.clearCompressedCache).not.toHaveBeenCalled();
        expect(service.clearGPUCache).not.toHaveBeenCalled();
        expect(service.backendService.setChannels).toHaveBeenCalledWith(1, 2, 0, {});
    });

    test("abandons the sequence when sending fails", () => {
        const service = CreateService();
        service.backendService.setChannels.mockReturnValue(null);

        service.queueChannelMapRequests(1, [MakeRequest(1, [4]), MakeRequest(2, [5])]);
        service.handleChannelMapFlowControl(1, Complete(1));

        expect(service.backendService.setChannels).toHaveBeenCalledTimes(1);
        expect(service.pendingRequests.get("1_0_1")?.size).toBe(0);
    });
});
