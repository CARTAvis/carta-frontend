import {type WorkspaceImageViewSize} from "models";

/** The size of the area of an image view that images are drawn in, in CSS pixels. */
export interface ImageViewSize {
    width: number;
    height: number;
}

/** The aspect ratios of two views that differ by this fraction or less count as the same shape. */
export const VIEW_SHAPE_TOLERANCE = 0.02;

function isPositive(value: unknown): value is number {
    return typeof value === "number" && isFinite(value) && value > 0;
}

/** Returns whether a saved image view size can be used to scale the zoom. */
export function isValidImageViewSize(size: unknown): size is WorkspaceImageViewSize {
    const candidate = size as WorkspaceImageViewSize | undefined;
    return isPositive(candidate?.width) && isPositive(candidate?.height);
}

/**
 * Returns the factor that scales the zoom of an image, so that the area of the image that showed in
 * the saved view fits in the current view. The zoom counts screen pixels, so the sizes are compared
 * in screen pixels. The smaller of the two factors is used, so that nothing that showed is cut off.
 */
export function getFieldOfViewScale(saved: WorkspaceImageViewSize, current: ImageViewSize, pixelRatio: number): number {
    const savedPixelRatio = isPositive(saved.pixelRatio) ? saved.pixelRatio : 1;
    const currentPixelRatio = isPositive(pixelRatio) ? pixelRatio : 1;
    const scaleX = (current.width * currentPixelRatio) / (saved.width * savedPixelRatio);
    const scaleY = (current.height * currentPixelRatio) / (saved.height * savedPixelRatio);
    return Math.min(scaleX, scaleY);
}

/**
 * Returns a message for the restore report when the current view has another shape than the saved
 * view, or undefined when the shapes are the same. The message names the sides where more of each
 * image shows, so that the user can make the view the same shape again.
 */
export function describeViewShapeChange(saved: WorkspaceImageViewSize, current: ImageViewSize): string | undefined {
    const savedRatio = saved.width / saved.height;
    const currentRatio = current.width / current.height;
    if (Math.abs(currentRatio / savedRatio - 1) <= VIEW_SHAPE_TOLERANCE) {
        return undefined;
    }
    const sides = currentRatio > savedRatio ? "left and right" : "top and bottom";
    const format = (size: ImageViewSize) => `${Math.round(size.width)}×${Math.round(size.height)}`;
    return `The image view has another shape than when the workspace was saved (${format(saved)}, now ${format(current)}). More of each image shows at the ${sides}.`;
}

/**
 * Resolves when the size that `read` returns stays the same for two checks in a row, or after
 * `maxWait` milliseconds. The image view takes its new size a few frames after a layout is applied.
 */
export function waitForStableSize(read: () => ImageViewSize, interval = 50, maxWait = 1000): Promise<void> {
    return new Promise(resolve => {
        const start = Date.now();
        let last = read();
        let stableChecks = 0;
        const check = () => {
            const size = read();
            stableChecks = size.width === last.width && size.height === last.height ? stableChecks + 1 : 0;
            last = size;
            if (stableChecks >= 2 || Date.now() - start >= maxWait) {
                resolve();
            } else {
                setTimeout(check, interval);
            }
        };
        setTimeout(check, interval);
    });
}
