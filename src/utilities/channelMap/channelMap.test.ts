import {getChannelMapCell} from "./channelMap";

describe("getChannelMapCell", () => {
    const layout = {
        numColumns: 2,
        outerPadding: {left: 5, top: 7},
        tileWidth: 50,
        tileHeight: 40,
        gapX: 10,
        gapY: 10
    };

    test("returns the cell position for a complete row", () => {
        expect(getChannelMapCell(2, layout)).toEqual({column: 0, row: 1, left: 5, top: 57});
    });

    test("returns the cell position for an incomplete final row", () => {
        expect(getChannelMapCell(4, layout)).toEqual({column: 0, row: 2, left: 5, top: 107});
    });
});
