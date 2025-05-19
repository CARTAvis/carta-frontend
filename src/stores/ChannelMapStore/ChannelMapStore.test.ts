import {ChannelMapStore} from "./ChannelMapStore";

jest.mock("stores", () => ({
    AppStore: {
        Instance: {
            imageViewConfigStore: {
                visibleImages: [{type: 0, store: {frameInfo: {fileInfoExtended: {depth: 12}}}}]
            }
        }
    }
}));

describe("ChannelMapStore", () => {
    const store = ChannelMapStore.Instance;

    describe("setChannelMapEnabled", () => {
        it("updates the channel map mode correctly", () => {
            expect(store.channelMapEnabled).toBe(false);

            store.setChannelMapEnabled(true);
            expect(store.channelMapEnabled).toBe(true);
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

        it("skips when the channel is out of range", () => {
            store.setStartChannel(-1);
            expect(store.startChannel).toBe(1);

            store.setStartChannel(100);
            expect(store.startChannel).toBe(1);
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
});
