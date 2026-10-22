export interface ChannelMapLayout {
    numColumns: number;
    outerPadding: {left: number; top: number};
    tileWidth: number;
    tileHeight: number;
    gapX: number;
    gapY: number;
}

export interface ChannelMapCell {
    column: number;
    row: number;
    left: number;
    top: number;
}

export function getChannelMapCell(index: number, layout: ChannelMapLayout): ChannelMapCell {
    const column = index % layout.numColumns;
    const row = Math.floor(index / layout.numColumns);

    return {
        column,
        row,
        left: layout.outerPadding.left + (layout.tileWidth + layout.gapX) * column,
        top: layout.outerPadding.top + (layout.tileHeight + layout.gapY) * row
    };
}
