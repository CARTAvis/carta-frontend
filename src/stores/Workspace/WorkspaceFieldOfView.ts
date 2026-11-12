import {type WorkspaceImageViewSize} from "models";

/** The size of the area of an image view that images are drawn in, in CSS pixels. */
export interface ImageViewSize {
    width: number;
    height: number;
}

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
export function getFieldOfViewScale(saved: WorkspaceImageViewSize, current: ImageViewSize, devicePixelRatio: number): number {
    const savedPixelRatio = isPositive(saved.devicePixelRatio) ? saved.devicePixelRatio : 1;
    const currentPixelRatio = isPositive(devicePixelRatio) ? devicePixelRatio : 1;
    const scaleX = (current.width * currentPixelRatio) / (saved.width * savedPixelRatio);
    const scaleY = (current.height * currentPixelRatio) / (saved.height * savedPixelRatio);
    return Math.min(scaleX, scaleY);
}

/** Returns a size as "1600×900", in whole pixels. */
export function formatSize(size: ImageViewSize): string {
    return `${Math.round(size.width)}×${Math.round(size.height)}`;
}

/** Returns whether two sizes are the same in whole pixels. */
export function isSameSize(a: ImageViewSize, b: ImageViewSize): boolean {
    return Math.round(a.width) === Math.round(b.width) && Math.round(a.height) === Math.round(b.height);
}

/**
 * Returns the address of a new CARTA window that opens the workspace `workspaceName` when it starts.
 * The address keeps the parameters that connect to the server, such as `socketUrl`, and drops the
 * parameters that open other files or another workspace.
 */
export function workspaceWindowUrl(href: string, workspaceName: string): string {
    const url = new URL(href);
    for (const name of ["key", "workspace", "file", "files", "folder"]) {
        url.searchParams.delete(name);
    }
    url.searchParams.set("workspace", workspaceName);
    return url.toString();
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
