export class CompressionQuality {
    public static readonly IMAGE_MIN = 1;
    public static readonly IMAGE_MAX = 32;
    public static readonly IMAGE_STEP = 1;
    public static readonly IMAGE_DEFAULT = 11;

    public static readonly ANIMATION_MIN = 1;
    public static readonly ANIMATION_MAX = 32;
    public static readonly ANIMATION_STEP = 1;
    public static readonly ANIMATION_DEFAULT = 9;

    public static isImageCompressionQualityValid = (value: number): boolean => {
        return isFinite(value) && value >= CompressionQuality.IMAGE_MIN && value <= CompressionQuality.IMAGE_MAX;
    };

    public static isAnimationCompressionQualityValid = (value: number): boolean => {
        return isFinite(value) && value >= CompressionQuality.ANIMATION_MIN && value <= CompressionQuality.ANIMATION_MAX;
    };
}
