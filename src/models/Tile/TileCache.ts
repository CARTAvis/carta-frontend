export class TileCache {
    public static readonly GPU_MIN = 1024;
    public static readonly GPU_MAX = 8192;
    public static readonly GPU_STEP = 256;
    public static readonly GPU_DEFAULT = 1024;

    public static readonly SYSTEM_MIN = 1024;
    public static readonly SYSTEM_MAX = 16384;
    public static readonly SYSTEM_STEP = 256;
    public static readonly SYSTEM_DEFAULT = 4096;

    public static IsGPUTileCacheValid = (value: number): boolean => {
        return isFinite(value) && value >= TileCache.GPU_MIN && value <= TileCache.GPU_MAX;
    };

    public static IsSystemTileCacheValid = (value: number): boolean => {
        return isFinite(value) && value >= TileCache.SYSTEM_MIN && value <= TileCache.SYSTEM_MAX;
    };
}
