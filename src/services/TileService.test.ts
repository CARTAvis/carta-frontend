jest.mock("models", () => ({TileCoordinate: {}}));
jest.mock("components/Shared", () => ({AppToaster: {show: jest.fn()}, SuccessToast: jest.fn((_icon, message) => ({message}))}));
jest.mock("services", () => ({BackendService: {Instance: {}}, TileWebGLService: {Instance: {gl: null}}}));
jest.mock("stores", () => ({AppStore: {Instance: {alertStore: {dismissInteractiveAlert: jest.fn(), showInteractiveAlert: jest.fn()}}}, PREVIEW_PV_FILEID: -1}));
jest.mock("utilities", () => ({clamp: jest.fn(), copyToFP32Texture: jest.fn(), createFP32Texture: jest.fn(), GL2: {}}));
jest.mock("!worker-loader!zfp_wrapper", () => jest.fn());

import {CARTA} from "carta-protobuf";

import {AppToaster, SuccessToast} from "components/Shared";
import {AppStore} from "stores";

import {TileService} from "./TileService";

type TestTileService = {
    activeChannelMapRequests: Map<number, unknown>;
    backendService: {addRequiredTiles: jest.Mock; animationId: number; setChannels: jest.Mock};
    cachedTiles: {get?: jest.Mock; has: jest.Mock; peek?: jest.Mock; setpop?: jest.Mock};
    channelMapGenerations: Map<number, number>;
    channelMapRequestQueues: Map<number, unknown[]>;
    channelMapRequestProgressIntervals: Map<number, ReturnType<typeof setInterval>>;
    channelMapRequestTimeouts: Map<number, ReturnType<typeof setTimeout>>;
    channelMap: Map<number, {channel: number; stokes: number}>;
    clearCompressedCache: jest.Mock;
    clearGPUCache: jest.Mock;
    clearQueueForChannelMap: jest.Mock;
    completedChannels: Map<string, boolean>;
    confirmedChannelMapStokes: Map<number, number>;
    desiredChannelMapStokes: Map<number, number>;
    getCompressedCache: jest.Mock;
    getTile: TileService["getTile"];
    getRequiredRequestTiles: jest.Mock;
    handleChannelMapFlowControl: (eventId: number, message: {fileId: number; completedChannel: number; status: CARTA.ChannelMapFlowControl.Status}) => void;
    handleStreamSync: (message: CARTA.RasterTileSync.$Properties) => void;
    isAnimationEnabled: boolean;
    pendingDecompressions: Map<string, Map<number, Map<number, boolean>>>;
    pendingRequests: Map<string, Map<number, boolean>>;
    pendingSynchronisedTiles: Map<string, Set<number>>;
    queueChannelMapRequests: (fileId: number, requests: unknown[]) => void;
    receivedSynchronisedTiles: Map<string, Map<number, Map<number, unknown>>>;
    requestChannelMapTiles: TileService["requestChannelMapTiles"];
    requestTiles: TileService["requestTiles"];
    cancelChannelMapRequests: TileService["cancelChannelMapRequests"];
    resetForSessionResume: TileService["resetForSessionResume"];
    syncIdGenerationMap: Map<number, number>;
    syncIdMap: Map<number, boolean>;
    syncIdTileCountMap: Map<number, number>;
    tileStream: {next: jest.Mock};
    textureCoordinateQueue: number[];
    updateChannelMapActiveChannel: TileService["updateChannelMapActiveChannel"];
    updateHiddenFileChannels: TileService["updateHiddenFileChannels"];
    updateRemainingTileCount: jest.Mock;
    updateStream: (fileId: number, channel: number, stokes: number, data: Float32Array, width: number, height: number, layer: number, coordinate: number, syncId: number, generation: number) => void;
};

const CreateService = () => {
    const service = Object.create(TileService.prototype) as TestTileService;
    let requestId = 0;
    service.backendService = {addRequiredTiles: jest.fn(), animationId: 0, setChannels: jest.fn(() => ++requestId)};
    service.channelMapRequestQueues = new Map();
    service.channelMapRequestProgressIntervals = new Map();
    service.activeChannelMapRequests = new Map();
    service.channelMapRequestTimeouts = new Map();
    service.channelMapGenerations = new Map();
    service.channelMap = new Map();
    service.clearCompressedCache = jest.fn();
    service.clearGPUCache = jest.fn();
    service.completedChannels = new Map();
    service.confirmedChannelMapStokes = new Map();
    service.desiredChannelMapStokes = new Map();
    service.pendingRequests = new Map();
    service.pendingDecompressions = new Map();
    service.pendingSynchronisedTiles = new Map();
    service.receivedSynchronisedTiles = new Map();
    service.syncIdGenerationMap = new Map();
    service.syncIdMap = new Map();
    service.syncIdTileCountMap = new Map();
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
const MockShowToast = AppToaster.show as jest.Mock;
const MockSuccessToast = SuccessToast as jest.Mock;

describe("TileService channel map request queue", () => {
    beforeEach(() => {
        jest.useFakeTimers();
        MockDismissInteractiveAlert.mockReset();
        MockShowInteractiveAlert.mockReset();
        MockShowToast.mockReset();
        MockSuccessToast.mockClear();
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
        service.channelMap.set(1, {channel: 1, stokes: 0});

        service.requestChannelMapTiles([], frame as never, {x: 0, y: 0}, 11, {min: 0, max: 2}, true);

        expect(service.clearCompressedCache).not.toHaveBeenCalled();
        expect(service.clearGPUCache).not.toHaveBeenCalled();
        expect(service.channelMap.get(1)).toEqual({channel: 1, stokes: 1});
        expect(service.backendService.setChannels).toHaveBeenCalledWith(1, 1, 1, {}, true);
    });

    test("preserves a Stokes transition when a refresh replaces the queue", () => {
        const service = CreateService();
        service.clearQueueForChannelMap = jest.fn();
        const tile = {x: 0, y: 0, encode: () => 4};
        service.getRequiredRequestTiles = jest.fn((_tiles, _fileId, channel) => (channel === 2 ? [tile] : []));
        const frame = {frameInfo: {fileId: 1}, stokes: 1, channel: 1};
        service.channelMap.set(1, {channel: 0, stokes: 0});

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

        service.handleChannelMapFlowControl(1, {
            fileId: 1,
            completedChannel: 1,
            status
        });

        expect(service.backendService.setChannels).toHaveBeenCalledTimes(1);
        expect(service.channelMapRequestQueues.has(1)).toBe(false);
        expect(service.pendingRequests.get("1_0_1")?.size).toBe(0);
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

        service.getTile(4, 1, 2, 0);
        service.getTile(4, 1, 2, 1, true);

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
        service.channelMap.set(1, {channel: 2, stokes: 0});
        service.getRequiredRequestTiles = jest.fn(() => []);

        service.requestTiles([], 1, 2, 1, {x: 0, y: 0}, 11, true);

        expect(service.clearCompressedCache).not.toHaveBeenCalled();
        expect(service.clearGPUCache).not.toHaveBeenCalled();
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
        service.handleChannelMapFlowControl(1, Complete(1));

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

    test("resets in-flight tile state for session resume", () => {
        const service = CreateService();
        service.channelMap.set(1, {channel: 1, stokes: 0});
        service.channelMapGenerations.set(1, 3);
        service.pendingRequests.set("1_0_1", new Map([[4, true]]));
        service.pendingDecompressions.set("1_0_1", new Map([[7, new Map([[4, true]])]]));
        service.pendingSynchronisedTiles.set("1_0_1", new Set([4]));
        service.receivedSynchronisedTiles.set("1_0_1", new Map([[7, new Map()]]));
        service.completedChannels.set("1_0_1", true);
        service.syncIdMap.set(7, false);
        service.syncIdTileCountMap.set(7, 1);
        service.syncIdGenerationMap.set(7, 3);

        service.resetForSessionResume();

        expect(service.pendingRequests.size).toBe(0);
        expect(service.pendingDecompressions.size).toBe(0);
        expect(service.pendingSynchronisedTiles.size).toBe(0);
        expect(service.receivedSynchronisedTiles.size).toBe(0);
        expect(service.completedChannels.size).toBe(0);
        expect(service.syncIdMap.size).toBe(0);
        expect(service.syncIdTileCountMap.size).toBe(0);
        expect(service.syncIdGenerationMap.size).toBe(0);
        expect(service.channelMapGenerations.get(1)).toBe(4);
    });

    test("reports received channel-map tiles every 5 seconds", () => {
        const service = CreateService();
        service.queueChannelMapRequests(1, [MakeRequest(1, [4, 5]), MakeRequest(2, [6]), MakeRequest(3, [7])]);

        jest.advanceTimersByTime(5_000);
        expect(MockSuccessToast).toHaveBeenLastCalledWith("download", "Loading channel 1: received 0 / 2 requested tiles.", 5_000);

        service.pendingRequests.get("1_0_1")?.delete(4);
        jest.advanceTimersByTime(5_000);
        expect(MockSuccessToast).toHaveBeenLastCalledWith("download", "Loading channel 1: received 1 / 2 requested tiles.", 5_000);
        expect(MockShowToast).toHaveBeenCalledTimes(2);

        service.cancelChannelMapRequests(1);
        jest.advanceTimersByTime(5_000);
        expect(MockShowToast).toHaveBeenCalledTimes(2);
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
        expect(service.activeChannelMapRequests.has(1)).toBe(true);
        expect(service.channelMapRequestQueues.has(1)).toBe(true);
        expect(service.channelMapRequestTimeouts.has(1)).toBe(true);

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

        expect(service.activeChannelMapRequests.has(1)).toBe(false);
        expect(service.channelMapRequestQueues.has(1)).toBe(false);
        expect(service.pendingRequests.get("1_0_1")?.size).toBe(0);
    });

    test("ignores a timeout decision after the request completes", async () => {
        const service = CreateService();
        let resolveDecision: (shouldKeepWaiting: boolean) => void;
        MockShowInteractiveAlert.mockReturnValue(new Promise(resolve => (resolveDecision = resolve)));
        service.queueChannelMapRequests(1, [MakeRequest(1), MakeRequest(2)]);

        jest.advanceTimersByTime(40_000);
        service.handleChannelMapFlowControl(1, Complete(1));
        resolveDecision!(false);
        await Promise.resolve();

        expect(service.backendService.setChannels).toHaveBeenCalledTimes(2);
        expect(service.activeChannelMapRequests.get(1)).toEqual(expect.objectContaining({channel: 2, requestId: 2}));
    });

    test("retires synchronization state when cancelled", () => {
        const service = CreateService();
        service.channelMap.set(1, {channel: 1, stokes: 0});
        service.completedChannels.set("1_0_1", true);
        service.pendingSynchronisedTiles.set("1_0_1", new Set([4]));
        service.receivedSynchronisedTiles.set("1_0_1", new Map([[7, new Map()]]));
        service.pendingDecompressions.set("1_0_1", new Map([[7, new Map()]]));
        service.syncIdMap.set(7, true);
        service.syncIdTileCountMap.set(7, 1);
        service.syncIdGenerationMap.set(7, 0);

        service.cancelChannelMapRequests(1);

        expect(service.channelMapGenerations.get(1)).toBe(1);
        expect(service.completedChannels.has("1_0_1")).toBe(false);
        expect(service.pendingSynchronisedTiles.has("1_0_1")).toBe(false);
        expect(service.receivedSynchronisedTiles.has("1_0_1")).toBe(false);
        expect(service.pendingDecompressions.has("1_0_1")).toBe(false);
        expect(service.syncIdMap.has(7)).toBe(false);
        expect(service.syncIdTileCountMap.has(7)).toBe(false);
        expect(service.syncIdGenerationMap.has(7)).toBe(false);
    });

    test("discards decompression results from a cancelled generation", () => {
        const service = CreateService();
        service.channelMap.set(1, {channel: 1, stokes: 0});
        service.channelMapGenerations.set(1, 1);
        service.pendingDecompressions.set("1_0_1", new Map([[-1, new Map([[4, true]])]]));

        service.updateStream(1, 1, 0, new Float32Array([1]), 1, 1, 0, 4, -1, 0);

        expect(service.pendingDecompressions.get("1_0_1")?.get(-1)?.has(4)).toBe(true);
        expect(service.tileStream.next).not.toHaveBeenCalled();
    });

    test("caches a completed decompression from a previously selected Stokes value", () => {
        const service = CreateService();
        service.channelMap.set(1, {channel: 1, stokes: 1});
        service.channelMapGenerations.set(1, 0);
        service.pendingDecompressions.set("1_0_1", new Map([[-1, new Map([[4, true]])]]));
        service.cachedTiles = {has: jest.fn(), setpop: jest.fn()};
        service.textureCoordinateQueue = [3];

        service.updateStream(1, 1, 0, new Float32Array([1]), 1, 1, 0, 4, -1, 0);

        expect(service.cachedTiles.setpop).toHaveBeenCalledWith("1_0_1_4", expect.objectContaining({data: new Float32Array([1])}));
        expect(service.tileStream.next).toHaveBeenCalledWith({tileCount: 1, fileId: 1, channel: 1, stokes: 0, flush: false});
    });

    test("completes a synchronized stream when no requested tiles succeed", () => {
        const service = CreateService();
        service.channelMap.set(1, {channel: 1, stokes: 0});
        service.pendingSynchronisedTiles.set("1_0_1", new Set([4]));

        service.handleStreamSync({fileId: 1, channel: 1, stokes: 0, syncId: 7, animationId: 0, tileCount: 1, endSync: false});
        service.handleStreamSync({fileId: 1, channel: 1, stokes: 0, syncId: 7, animationId: 0, tileCount: 0, endSync: true});

        expect(service.pendingSynchronisedTiles.has("1_0_1")).toBe(false);
        expect(service.pendingDecompressions.has("1_0_1")).toBe(false);
        expect(service.tileStream.next).toHaveBeenCalledWith({tileCount: 0, fileId: 1, channel: 1, stokes: 0, flush: true});
    });

    test("keeps hidden-file caches when only the channel changes", () => {
        const service = CreateService();
        service.channelMap.set(1, {channel: 1, stokes: 0});

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
