import {CARTA} from "carta-protobuf";

import {ContourRequestStore} from "./ContourRequestStore";

jest.mock("stores", () => ({
    AppStore: {
        Instance: {
            backendService: {
                channelMapFlowControlStream: {subscribe: jest.fn()},
                setContourParameters: jest.fn()
            },
            channelMapStore: {
                channelArray: [1, 3, 5],
                isChannelMapEnabled: true
            },
            contourFrames: new Map(),
            preferenceStore: {
                contourChunkSize: 100,
                contourCompressionLevel: 1,
                contourDecimation: 4
            },
            spectralMatchingType: 0,
            tileService: {
                hasPendingChannelMapRequests: jest.fn(() => false)
            }
        }
    }
}));

jest.mock("utilities", () => ({
    transformChannelToFrame: jest.fn((_base, _target, channel) => channel)
}));

describe("ContourRequestStore", () => {
    const appStore = jest.requireMock("stores").AppStore.Instance;
    const mockTransformChannelToFrame = jest.requireMock("utilities").transformChannelToFrame as jest.Mock;
    const mockSubscribe = appStore.backendService.channelMapFlowControlStream.subscribe as jest.Mock;
    const mockSetContourParameters = appStore.backendService.setContourParameters as jest.Mock;
    const mockHasPendingChannelMapRequests = appStore.tileService.hasPendingChannelMapRequests as jest.Mock;
    let store: ContourRequestStore;
    let onFlowControl: (event: unknown) => void;
    let firstRequestId = 31;
    const frame = {
        contourConfig: {isEnabled: true, levels: [1], smoothingFactor: 1, smoothingMode: 0},
        contourStores: new Map(),
        frameInfo: {fileId: 7, fileInfoExtended: {depth: 8, height: 10, width: 10}},
        numChannels: 8,
        requiredChannel: 3,
        requiredStokes: 1,
        spectralReference: null
    };

    beforeAll(() => {
        store = ContourRequestStore.Instance;
        onFlowControl = mockSubscribe.mock.calls[0][0];
    });

    beforeEach(() => {
        firstRequestId += 10;
        store.reset();
        jest.clearAllMocks();
        mockSetContourParameters.mockReset();
        mockTransformChannelToFrame.mockReset();
        mockHasPendingChannelMapRequests.mockReturnValue(false);
        mockTransformChannelToFrame.mockImplementation((_base, _target, channel) => channel);
        mockSetContourParameters
            .mockReturnValueOnce(firstRequestId)
            .mockReturnValueOnce(firstRequestId + 1)
            .mockReturnValueOnce(firstRequestId + 2);
        appStore.contourFrames = new Map([[frame, [frame]]]);
        appStore.channelMapStore.channelArray = [1, 3, 5];
        appStore.channelMapStore.isChannelMapEnabled = true;
    });

    test("requests sparse channel-map contours one channel at a time", () => {
        store.requestContours(frame as any);

        expect(mockSetContourParameters).toHaveBeenCalledTimes(1);
        expect(mockSetContourParameters).toHaveBeenLastCalledWith(expect.objectContaining({channel: 3, stokes: 1}));

        onFlowControl({eventId: firstRequestId, flowControl: {fileId: 7, completedChannel: 3, status: CARTA.ChannelMapFlowControl.Status.COMPLETED}});
        expect(mockSetContourParameters).toHaveBeenCalledTimes(2);
        expect(mockSetContourParameters).toHaveBeenLastCalledWith(expect.objectContaining({channel: 1, stokes: 1}));

        onFlowControl({eventId: firstRequestId + 1, flowControl: {fileId: 7, completedChannel: 1, status: CARTA.ChannelMapFlowControl.Status.COMPLETED}});
        expect(mockSetContourParameters).toHaveBeenCalledTimes(3);
        expect(mockSetContourParameters).toHaveBeenLastCalledWith(expect.objectContaining({channel: 5, stokes: 1}));
        expect(mockSetContourParameters.mock.calls.every(([parameters]) => !("channelRange" in parameters))).toBe(true);
        onFlowControl({eventId: firstRequestId + 2, flowControl: {fileId: 7, completedChannel: 5, status: CARTA.ChannelMapFlowControl.Status.COMPLETED}});
    });

    test("requests every displayed channel for a spatially matched contour frame", () => {
        const spatialFrame = {
            ...frame,
            frameInfo: {fileId: 8, fileInfoExtended: {depth: 8, height: 10, width: 10}},
            requiredChannel: 2
        };
        appStore.contourFrames = new Map([[frame, [spatialFrame]]]);

        store.requestContours(frame as any);

        expect(mockSetContourParameters).toHaveBeenCalledTimes(1);
        expect(mockSetContourParameters).toHaveBeenLastCalledWith(expect.objectContaining({fileId: 8, channel: 1, stokes: 1}));

        onFlowControl({eventId: firstRequestId, flowControl: {fileId: 8, completedChannel: 1, status: CARTA.ChannelMapFlowControl.Status.COMPLETED}});
        expect(mockSetContourParameters).toHaveBeenLastCalledWith(expect.objectContaining({fileId: 8, channel: 3, stokes: 1}));

        onFlowControl({eventId: firstRequestId + 1, flowControl: {fileId: 8, completedChannel: 3, status: CARTA.ChannelMapFlowControl.Status.COMPLETED}});
        expect(mockSetContourParameters).toHaveBeenLastCalledWith(expect.objectContaining({fileId: 8, channel: 5, stokes: 1}));
        onFlowControl({eventId: firstRequestId + 2, flowControl: {fileId: 8, completedChannel: 5, status: CARTA.ChannelMapFlowControl.Status.COMPLETED}});
    });

    test("waits for channel-map raster requests before generating contours", () => {
        const delayedFrame = {
            ...frame,
            frameInfo: {fileId: 9, fileInfoExtended: {depth: 8, height: 10, width: 10}}
        };
        appStore.contourFrames = new Map([[frame, [delayedFrame]]]);
        mockHasPendingChannelMapRequests.mockReturnValue(true);

        store.requestContours(frame as any);
        expect(mockSetContourParameters).not.toHaveBeenCalled();

        mockHasPendingChannelMapRequests.mockReturnValue(false);
        onFlowControl({eventId: 90, flowControl: {fileId: 99, completedChannel: 1, status: CARTA.ChannelMapFlowControl.Status.COMPLETED}});
        expect(mockSetContourParameters).toHaveBeenCalledTimes(1);
        expect(mockSetContourParameters).toHaveBeenLastCalledWith(expect.objectContaining({fileId: 9, channel: 3, stokes: 1}));

        onFlowControl({eventId: firstRequestId, flowControl: {fileId: 9, completedChannel: 3, status: CARTA.ChannelMapFlowControl.Status.COMPLETED}});
        onFlowControl({eventId: firstRequestId + 1, flowControl: {fileId: 9, completedChannel: 1, status: CARTA.ChannelMapFlowControl.Status.COMPLETED}});
        onFlowControl({eventId: firstRequestId + 2, flowControl: {fileId: 9, completedChannel: 5, status: CARTA.ChannelMapFlowControl.Status.COMPLETED}});
    });

    test("ignores stale channels while channel-map mode is active", () => {
        store.requestContours(frame as any);

        expect(store.acceptsContourData(firstRequestId, {fileId: 7, channel: 3, stokes: 1})).toBe(true);
        expect(store.acceptsContourData(firstRequestId, {fileId: 7, channel: 2, stokes: 1})).toBe(false);
        expect(store.acceptsContourData(firstRequestId, {fileId: 7, channel: 3, stokes: 0})).toBe(false);
        expect(store.acceptsContourData(999, {fileId: 7, channel: 3, stokes: 1})).toBe(false);
    });

    test("requests one selected channel for a spatial-only matched frame", () => {
        const spatialFrame = {
            ...frame,
            frameInfo: {fileId: 8, fileInfoExtended: {depth: 8, height: 10, width: 10}},
            requiredChannel: 6
        };
        appStore.contourFrames = new Map([[frame, [spatialFrame]]]);
        mockTransformChannelToFrame.mockImplementation((_base, target) => target.requiredChannel);

        store.requestContours(frame as any);

        expect(mockSetContourParameters).toHaveBeenCalledTimes(1);
        expect(mockSetContourParameters).toHaveBeenCalledWith(expect.objectContaining({fileId: 8, channel: 6, stokes: 1}));
    });

    test("rejects an active response after its request generation is superseded", () => {
        store.requestContours(frame as any);
        appStore.channelMapStore.channelArray = [2, 4, 6];

        store.requestContours(frame as any);

        expect(store.acceptsContourData(firstRequestId, {fileId: 7, channel: 3, stokes: 1})).toBe(false);
        onFlowControl({eventId: firstRequestId, flowControl: {fileId: 7, completedChannel: 3, status: CARTA.ChannelMapFlowControl.Status.COMPLETED}});
        expect(mockSetContourParameters).toHaveBeenCalledTimes(2);
        expect(store.acceptsContourData(firstRequestId + 1, {fileId: 7, channel: 2, stokes: 1})).toBe(true);
    });

    test("resets obsolete requests and rejects their late data outside channel-map mode", () => {
        store.requestContours(frame as any);

        store.reset(7);
        appStore.channelMapStore.isChannelMapEnabled = false;

        expect(store.acceptsContourData(firstRequestId, {fileId: 7, channel: 3, stokes: 1})).toBe(false);
        expect(store.acceptsContourData(99, {fileId: 7, channel: 3, stokes: 1})).toBe(true);
        onFlowControl({eventId: firstRequestId, flowControl: {fileId: 7, completedChannel: 3, status: CARTA.ChannelMapFlowControl.Status.COMPLETED}});
        expect(mockSetContourParameters).toHaveBeenCalledTimes(1);
    });

    test("prunes requests for contours that are no longer visible", () => {
        store.requestContours(frame as any);
        appStore.contourFrames = new Map([[frame, []]]);

        store.requestContours(frame as any);
        onFlowControl({eventId: firstRequestId, flowControl: {fileId: 7, completedChannel: 3, status: CARTA.ChannelMapFlowControl.Status.COMPLETED}});

        expect(mockSetContourParameters).toHaveBeenCalledTimes(1);
    });

    test("stops the queue when a contour request is rejected", () => {
        const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
        store.requestContours(frame as any);

        onFlowControl({eventId: firstRequestId, flowControl: {fileId: 7, completedChannel: 3, status: CARTA.ChannelMapFlowControl.Status.REJECTED}});

        expect(mockSetContourParameters).toHaveBeenCalledTimes(1);
        warn.mockRestore();
    });

    test("releases a request queue after a flow-control timeout", () => {
        const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
        jest.useFakeTimers();
        store.requestContours(frame as any);

        jest.advanceTimersByTime(10_000);
        store.requestContours(frame as any);

        expect(mockSetContourParameters).toHaveBeenCalledTimes(2);
        jest.useRealTimers();
        warn.mockRestore();
    });
});
