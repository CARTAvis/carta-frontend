export class TileCoordinate {
    private static readonly FileIdOffset = 2 ** 32;

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

    public static EncodeCoordinate(coordinate: {x: number; y: number; layer: number}): number {
        if (!coordinate) {
            return -1;
        }
        return TileCoordinate.Encode(coordinate.x, coordinate.y, coordinate.layer);
    }

    public static AddFileId(encodedCoordinate: number, fileId: number) {
        return encodedCoordinate + fileId * TileCoordinate.FileIdOffset;
    }

    public static RemoveFileId(encodedCoordinate: number) {
        return encodedCoordinate % TileCoordinate.FileIdOffset;
    }

    // Encoding a tile combines x, y and layer coordinates into a single number. This makes it more efficient
    // to transfer a list of tiles to the backend, but also simplifies using the coordinate as a map key.
    // 12 bits are used for each of the x and y coordinates (range of 0 - 4096), 7 bits for the layer.
    // The layer is limited to a range of 0 - 12, due to the range of the x and y coordinates
    public static Encode(x: number, y: number, layer: number): number {
        const layerWidth = 1 << layer;
        // check bounds
        if (x < 0 || y < 0 || layer < 0 || layer > 12 || x >= layerWidth || y >= layerWidth) {
            return -1;
        }

        // encode using bitwise operators
        return (layer << 24) | (y << 12) | x;
    }

    // Decode all three coordinates from an encoded coordinate using bitwise operators
    public static Decode(encodedCoordinate: number): TileCoordinate {
        const x = encodedCoordinate & 4095;
        const layer = (encodedCoordinate >> 24) & 127;
        const y = (encodedCoordinate >> 12) & 4095;
        return new TileCoordinate(x, y, layer);
    }

    // Shortcut to quickly decode just the layer from an encoded coordinate
    public static GetLayer(encodedCoordinate: number): number {
        return (encodedCoordinate >> 24) & 127;
    }

    public static GetFileId(encodedCoordinate: number): number {
        return Math.floor(encodedCoordinate / TileCoordinate.FileIdOffset);
    }
}
