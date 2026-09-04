import {runInAction} from "mobx";

import {ChannelMapStore} from "./ChannelMapStore";

jest.mock("services", () => ({
    TileService: {
        Instance: {
            cancelChannelMapRequests: jest.fn(),
            requestChannelMapTiles: jest.fn()
        }
    }
}));

jest.mock("stores", () => {
    const {observable} = jest.requireActual("mobx");
    const animatorStore = observable.object(
        {
            step: 1,
            maxStep: 50,
            stopAnimation: jest.fn(),
            setStep(step: number) {
                this.step = step;
            }
        },
        {},
        {deep: false}
    );
    return {
        AppStore: {
            Instance: {
                animatorStore,
                preferenceStore: {
                    imageCompressionQuality: 11
                },
                imageViewConfigStore: observable.object(
                    {
                        visibleImages: [
                            {
                                type: 0,
                                store: observable.object(
                                    {
                                        channel: 0,
                                        stokes: 0,
                                        requiredChannel: 0,
                                        frameInfo: {fileId: 1, fileInfoExtended: {depth: 12}},
                                        requiredFrameView: false,
                                        requiredTiles: [[], {x: 0, y: 0}],
                                        spectralSiblings: [],
                                        wcsInfo3D: {},
                                        setChannel: jest.fn()
                                    },
                                    {},
                                    {deep: false}
                                )
                            }
                        ],
                        visibleFrames: []
                    },
                    {},
                    {deep: false}
                ),
                spectralMatchingType: "CHANNEL",
                updateChannels: jest.fn()
            }
        }
    };
});

import {TileService} from "services";

describe("ChannelMapStore", () => {
    const store = ChannelMapStore.Instance;

    afterEach(() => {
        jest.useRealTimers();
        store.setChannelStep(1);
    });

    describe("setChannelMapEnabled", () => {
        it("updates the channel map mode correctly", () => {
            expect(store.isChannelMapEnabled).toBe(false);

            store.setChannelMapEnabled(true);
            expect(store.isChannelMapEnabled).toBe(true);
        });

        it("stops animation before enabling channel-map mode", () => {
            const stopAnimation = jest.requireMock("stores").AppStore.Instance.animatorStore.stopAnimation as jest.Mock;
            store.setChannelMapEnabled(false);
            stopAnimation.mockClear();

            store.setChannelMapEnabled(true);

            expect(stopAnimation).toHaveBeenCalledTimes(1);
        });

        it("starts from a newly selected channel before its raster response arrives", () => {
            const frame = store.displayedFrame as unknown as {channel: number; requiredChannel: number};
            store.setStartChannel(0);

            runInAction(() => {
                frame.channel = 0;
                frame.requiredChannel = 4;
            });

            expect(store.startChannel).toBe(4);
            expect(store.channelArray[0]).toBe(4);

            runInAction(() => {
                frame.requiredChannel = 0;
            });
        });

        it("cancels delayed tile requests when disabled", () => {
            jest.useFakeTimers();
            const testStore = store as unknown as {
                throttledRequestChannels: (frame: unknown) => void;
            };
            const requestChannelMapTiles = TileService.Instance.requestChannelMapTiles as jest.Mock;
            const frame = store.displayedFrame;

            testStore.throttledRequestChannels(frame);
            requestChannelMapTiles.mockClear();
            testStore.throttledRequestChannels(frame);
            store.setChannelMapEnabled(false);
            jest.runOnlyPendingTimers();

            expect(requestChannelMapTiles).not.toHaveBeenCalled();
            jest.useRealTimers();
        });

        it("cancels delayed active-channel changes when disabled", () => {
            jest.useFakeTimers();
            const testStore = store as unknown as {
                debouncedSetActiveChannel: (channel: number) => void;
            };
            const setChannel = store.displayedFrame?.setChannel as jest.Mock;
            setChannel.mockClear();

            store.setChannelMapEnabled(true);
            testStore.debouncedSetActiveChannel(4);
            store.setChannelMapEnabled(false);
            jest.runOnlyPendingTimers();

            expect(setChannel).not.toHaveBeenCalled();
            jest.useRealTimers();
        });

        it("does not request tiles while disabled", () => {
            const testStore = store as unknown as {
                requestChannels: (frame: unknown) => void;
            };
            const requestChannelMapTiles = TileService.Instance.requestChannelMapTiles as jest.Mock;
            requestChannelMapTiles.mockClear();

            testStore.requestChannels(store.displayedFrame);

            expect(requestChannelMapTiles).not.toHaveBeenCalled();
        });

        it("synchronizes tile delivery after a polarization change", () => {
            const requestChannelMapTiles = TileService.Instance.requestChannelMapTiles as jest.Mock;
            store.setChannelMapEnabled(true);
            requestChannelMapTiles.mockClear();

            store.handlePolarizationChanged(store.displayedFrame);

            expect(requestChannelMapTiles.mock.lastCall?.[5]).toBe(true);
            store.setChannelMapEnabled(false);
        });

        it("requests tiles after session resume", () => {
            const requestChannelMapTiles = TileService.Instance.requestChannelMapTiles as jest.Mock;
            requestChannelMapTiles.mockClear();
            store.setChannelMapEnabled(true);

            store.requestTilesAfterSessionResume();

            expect(requestChannelMapTiles).toHaveBeenCalled();
            store.setChannelMapEnabled(false);
        });

        it("synchronizes visible frames when disabled", () => {
            const appStore = jest.requireMock("stores").AppStore.Instance;
            const frame = {...store.displayedFrame, channel: 2, stokes: 1};
            appStore.imageViewConfigStore.visibleFrames = [frame];
            appStore.updateChannels.mockClear();

            store.setChannelMapEnabled(true);
            store.setChannelMapEnabled(false);

            expect(appStore.updateChannels).toHaveBeenCalledWith([{frame, channel: 2, stokes: 1}]);
        });
    });

    describe("setStartChannel", () => {
        it("sets the displayed channels correctly", () => {
            expect(store.startChannel).toBe(0);
            expect(store.endChannel).toBe(3);
            expect(store.channelArray).toEqual([0, 1, 2, 3]);

            store.setStartChannel(1);
            expect(store.startChannel).toBe(1);
            expect(store.endChannel).toBe(4);
            expect(store.channelArray).toEqual([1, 2, 3, 4]);
        });

        it("promotes the start channel before requesting channel-map tiles", () => {
            const frame = store.displayedFrame as unknown as {channel: number; setChannel: jest.Mock};
            frame.channel = 0;
            frame.setChannel.mockClear();

            store.setChannelMapEnabled(true);
            store.setStartChannel(2);

            expect(frame.setChannel).toHaveBeenCalledWith(2);
            expect(frame.channel).toBe(2);

            store.setStartChannel(1);
            store.setChannelMapEnabled(false);
        });

        it("skips when the channel is out of range", () => {
            store.setStartChannel(-1);
            expect(store.startChannel).toBe(1);

            store.setStartChannel(100);
            expect(store.startChannel).toBe(1);
        });
    });

    describe("setChannelStep", () => {
        it("shares the channel step with the animator and requests sparse channels", () => {
            store.setStartChannel(1);
            store.setChannelStep(2);

            expect(store.channelStep).toBe(2);
            expect(store.endChannel).toBe(7);
            expect(store.channelArray).toEqual([1, 3, 5, 7]);

            store.setChannelStep(3);
            expect(store.channelArray).toEqual([1, 4, 7, 10]);

            store.setChannelStep(1);
            store.setStartChannel(0);
        });

        it("rejects invalid channel steps", () => {
            store.setChannelStep(0);
            expect(store.channelStep).toBe(1);

            store.setChannelStep(1.5);
            expect(store.channelStep).toBe(1);

            store.setChannelStep(13);
            expect(store.channelStep).toBe(1);
        });
    });

    describe("setPrevChannel", () => {
        it("sets the displayed channels correctly", () => {
            store.setPrevChannel();
            expect(store.startChannel).toBe(0);
            expect(store.endChannel).toBe(3);
            expect(store.channelArray).toEqual([0, 1, 2, 3]);
        });
    });

    describe("setNextChannel", () => {
        it("sets the displayed channels correctly", () => {
            store.setNextChannel();
            expect(store.startChannel).toBe(1);
            expect(store.endChannel).toBe(4);
            expect(store.channelArray).toEqual([1, 2, 3, 4]);
        });
    });

    describe("setPrevPage", () => {
        it("sets the displayed channels correctly", () => {
            store.setStartChannel(5);
            store.setPrevPage();
            expect(store.startChannel).toBe(1);
            expect(store.endChannel).toBe(4);
            expect(store.channelArray).toEqual([1, 2, 3, 4]);
        });

        it("skips when the new start is out of range", () => {
            store.setPrevPage();
            expect(store.startChannel).toBe(1);
        });
    });

    describe("setNextPage", () => {
        it("sets the displayed channels correctly", () => {
            store.setNextPage();
            expect(store.startChannel).toBe(5);
            expect(store.endChannel).toBe(8);
            expect(store.channelArray).toEqual([5, 6, 7, 8]);

            store.setNextPage();
            expect(store.startChannel).toBe(9);
            expect(store.endChannel).toBe(11);
            expect(store.channelArray).toEqual([9, 10, 11]);
        });

        it("skips when the new start is out of range", () => {
            store.setNextPage();
            expect(store.startChannel).toBe(9);
        });
    });

    describe("setNumColumns", () => {
        it("sets the image view panel config correctly", () => {
            store.setNumColumns(3);
            expect(store.numColumns).toBe(3);
            expect(store.numChannels).toBe(6);
        });

        it("skips when the number is invalid", () => {
            store.setNumColumns(NaN);
            expect(store.numColumns).toBe(3);

            store.setNumColumns(0);
            expect(store.numColumns).toBe(3);
        });
    });

    describe("setNumRows", () => {
        it("sets the image view panel config correctly", () => {
            store.setNumRows(3);
            expect(store.numRows).toBe(3);
            expect(store.numChannels).toBe(9);
        });

        it("skips when the number is invalid", () => {
            store.setNumRows(NaN);
            expect(store.numRows).toBe(3);

            store.setNumRows(0);
            expect(store.numRows).toBe(3);
        });
    });

    describe("totalChannelNum", () => {
        it("returns number of channels of the active image", () => {
            expect(store.totalChannelNum).toBe(12);
        });
    });

    describe("color blending", () => {
        const setDisplayedImage = image => {
            runInAction(() => {
                jest.requireMock("stores").AppStore.Instance.imageViewConfigStore.visibleImages = [image];
            });
        };

        it("maps matched layers and leaves cells outside their spectral range empty", () => {
            const frameImage = jest.requireMock("stores").AppStore.Instance.imageViewConfigStore.visibleImages[0];
            const baseFrame = frameImage.store;
            store.setNumColumns(2);
            store.setNumRows(2);
            store.setStartChannel(0);
            const matchedFrame = {...baseFrame, channel: 1, frameInfo: {fileId: 2, fileInfoExtended: {depth: 3}}, spectralSiblings: [baseFrame]};
            baseFrame.spectralSiblings = [matchedFrame];
            setDisplayedImage({type: 1, store: {frames: [baseFrame, matchedFrame]}});

            expect(store.getChannelsForFrame(matchedFrame)).toEqual([0, 1, 2, null]);

            baseFrame.spectralSiblings = [];
            setDisplayedImage(frameImage);
        });

        it("repeats an unmatched layer channel and requests it only once", () => {
            const frameImage = jest.requireMock("stores").AppStore.Instance.imageViewConfigStore.visibleImages[0];
            const baseFrame = frameImage.store;
            store.setNumColumns(2);
            store.setNumRows(2);
            store.setStartChannel(0);
            const unmatchedFrame = {...baseFrame, channel: 7, frameInfo: {fileId: 2, fileInfoExtended: {depth: 12}}, spectralSiblings: []};
            const requestChannelMapTiles = TileService.Instance.requestChannelMapTiles as jest.Mock;
            const testStore = store as unknown as {requestDisplayedChannels: () => void};
            setDisplayedImage({type: 1, store: {frames: [baseFrame, unmatchedFrame]}});
            store.setChannelMapEnabled(true);
            requestChannelMapTiles.mockClear();

            expect(store.getChannelsForFrame(unmatchedFrame)).toEqual([7, 7, 7, 7]);
            testStore.requestDisplayedChannels();

            expect(requestChannelMapTiles).toHaveBeenCalledTimes(2);
            expect(requestChannelMapTiles.mock.calls[0][4]).toEqual([0, 1, 2, 3]);
            expect(requestChannelMapTiles.mock.calls[1][4]).toEqual([7]);

            store.setChannelMapEnabled(false);
            setDisplayedImage(frameImage);
        });
    });
});
