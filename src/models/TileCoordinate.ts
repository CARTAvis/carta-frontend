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
        if (!isFinite(x * y * layer)) {
            return -1;
        }
        if (layer < 0 || x < 0 || y < 0) {
            return -1;
        }

        const layerWidth = 2 ** layer;

        if (x >= layerWidth || y >= layerWidth) {
            return -1;
        }

        return layerWidth * (layerWidth + y) + x;
    }

    public static Decode(encodedCoordinate: number): TileCoordinate {
        const layer = Math.floor(0.5 * Math.log2(encodedCoordinate));

        if (layer < 0 || !isFinite(layer)) {
            return null;
        }

        const layerWidth = 2 ** layer;
        encodedCoordinate -= layerWidth * layerWidth;
        const x = encodedCoordinate % layerWidth;
        const y = (encodedCoordinate - x) / layerWidth;
        if (x < 0 || y < 0 || x >= layerWidth || y >= layerWidth) {
            return null;
        }
        return new TileCoordinate(x, y, layer);
    }
}