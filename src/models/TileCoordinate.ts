export class TileCoordinate {
    layer: number;
    x: number;
    y: number;

    constructor(x: number, y: number, layer: number) {
        this.x = x;
        this.y = y;
        this.layer = layer;
    }

    public encode(): number {
        return TileCoordinate.EncodeCoordinate(this);
    }

    public static EncodeCoordinate(coordinate: TileCoordinate): number {
        if (!coordinate) {
            return -1;
        }
        return TileCoordinate.Encode(coordinate.x, coordinate.y, coordinate.layer);
    }

    public static Encode(x: number, y: number, layer: number): number {
        const layerWidth = 1 << layer;
        if (x < 0 || y < 0 || layer < 0 || layer > 12 || x >= layerWidth || y >= layerWidth) {
            return -1;
        }

        return ((layer << 24) | (y << 12) | x);
    }

    public static Decode(encodedCoordinate: number): TileCoordinate {
        const x = (((encodedCoordinate << 19) >> 19) + 4096) % 4096;
        const layer = ((encodedCoordinate >> 24) + 128) % 128;
        const y = (((encodedCoordinate << 7) >> 19) + 4096) % 4096;
        return new TileCoordinate(x, y, layer);
    }
}