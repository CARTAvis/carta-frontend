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
    const mockSubscribe = appStore.backendService.channelMapFlowControlStream.subscribe as jest.Mock;
    const mockSetContourParameters = appStore.backendService.setContourParameters as jest.Mock;
    const mockHasPendingChannelMapRequests = appStore.tileService.hasPendingChannelMapRequests as jest.Mock;
    let store: ContourRequestStore;
    let onFlowControl: (event: unknown) => void;
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
        jest.clearAllMocks();
        mockHasPendingChannelMapRequests.mockReturnValue(false);
        mockSetContourParameters.mockReturnValueOnce(41).mockReturnValueOnce(42).mockReturnValueOnce(43);
        appStore.contourFrames = new Map([[frame, [frame]]]);
    });

    test("requests sparse channel-map contours one channel at a time", () => {
        store.requestContours(frame as any);

        expect(mockSetContourParameters).toHaveBeenCalledTimes(1);
        expect(mockSetContourParameters).toHaveBeenLastCalledWith(expect.objectContaining({channel: 3, stokes: 1}));

        onFlowControl({eventId: 41, flowControl: {fileId: 7, completedChannel: 3, status: CARTA.ChannelMapFlowControl.Status.COMPLETED}});
        expect(mockSetContourParameters).toHaveBeenCalledTimes(2);
        expect(mockSetContourParameters).toHaveBeenLastCalledWith(expect.objectContaining({channel: 1, stokes: 1}));

        onFlowControl({eventId: 42, flowControl: {fileId: 7, completedChannel: 1, status: CARTA.ChannelMapFlowControl.Status.COMPLETED}});
        expect(mockSetContourParameters).toHaveBeenCalledTimes(3);
        expect(mockSetContourParameters).toHaveBeenLastCalledWith(expect.objectContaining({channel: 5, stokes: 1}));
        expect(mockSetContourParameters.mock.calls.every(([parameters]) => !("channelRange" in parameters))).toBe(true);
        onFlowControl({eventId: 43, flowControl: {fileId: 7, completedChannel: 5, status: CARTA.ChannelMapFlowControl.Status.COMPLETED}});
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

        onFlowControl({eventId: 41, flowControl: {fileId: 8, completedChannel: 1, status: CARTA.ChannelMapFlowControl.Status.COMPLETED}});
        expect(mockSetContourParameters).toHaveBeenLastCalledWith(expect.objectContaining({fileId: 8, channel: 3, stokes: 1}));

        onFlowControl({eventId: 42, flowControl: {fileId: 8, completedChannel: 3, status: CARTA.ChannelMapFlowControl.Status.COMPLETED}});
        expect(mockSetContourParameters).toHaveBeenLastCalledWith(expect.objectContaining({fileId: 8, channel: 5, stokes: 1}));
        onFlowControl({eventId: 43, flowControl: {fileId: 8, completedChannel: 5, status: CARTA.ChannelMapFlowControl.Status.COMPLETED}});
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

        onFlowControl({eventId: 41, flowControl: {fileId: 9, completedChannel: 3, status: CARTA.ChannelMapFlowControl.Status.COMPLETED}});
        onFlowControl({eventId: 42, flowControl: {fileId: 9, completedChannel: 1, status: CARTA.ChannelMapFlowControl.Status.COMPLETED}});
        onFlowControl({eventId: 43, flowControl: {fileId: 9, completedChannel: 5, status: CARTA.ChannelMapFlowControl.Status.COMPLETED}});
    });

    test("ignores stale channels while channel-map mode is active", () => {
        store.requestContours(frame as any);

        expect(store.acceptsContourData({fileId: 7, channel: 3, stokes: 1})).toBe(true);
        expect(store.acceptsContourData({fileId: 7, channel: 2, stokes: 1})).toBe(false);
        expect(store.acceptsContourData({fileId: 7, channel: 3, stokes: 0})).toBe(false);
    });
});
