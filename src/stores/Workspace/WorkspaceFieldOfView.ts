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
 * The parameter of a CARTA address that asks the restore to check the size of the browser window.
 * The window that the Open Workspace dialog opens at the saved size has it.
 */
export const CHECK_WINDOW_SIZE_PARAM = "checkWindowSize";

/**
 * Returns the address of a new CARTA window that opens the workspace `workspaceName` when it starts,
 * and checks that the window has the saved size. The address keeps the parameters that connect to
 * the server, such as `socketUrl`, and drops the parameters that open other files or another
 * workspace.
 */
export function workspaceWindowUrl(href: string, workspaceName: string): string {
    const url = new URL(href);
    for (const name of ["key", "workspace", "file", "files", "folder", CHECK_WINDOW_SIZE_PARAM]) {
        url.searchParams.delete(name);
    }
    url.searchParams.set("workspace", workspaceName);
    url.searchParams.set(CHECK_WINDOW_SIZE_PARAM, "true");
    return url.toString();
}

/**
 * Resolves after the browser has drawn two frames, or after `timeout` milliseconds. This gives React
 * time to show a new layout. The image view may learn its new size a little later, because its size
 * reaches the store through a resize observer that is throttled. The checks in `waitForStableSize`
 * cover that time. The timeout ends the wait in a background tab, where the browser does not draw
 * frames. A background tab does not report a new size either, so the caller checks
 * `document.hidden` before it uses the size.
 */
function afterLayout(timeout = 200): Promise<void> {
    return new Promise(resolve => {
        let isDone = false;
        const finish = () => {
            if (!isDone) {
                isDone = true;
                clearTimeout(timer);
                resolve();
            }
        };
        const timer = setTimeout(finish, timeout);
        if (typeof window.requestAnimationFrame === "function") {
            window.requestAnimationFrame(() => window.requestAnimationFrame(finish));
        }
    });
}

/**
 * Resolves when the image view has its new size. First wait for two frames, and then wait until the
 * size that `read` returns stays the same for two checks in a row, or until `maxWait` milliseconds
 * pass. The two steps together cover the time that React takes to show a new layout and the time
 * that the image view takes to report its size. Without the first step, a layout that takes longer
 * than two checks to show would still report the size of the old layout, and that size would count
 * as the new one.
 */
export async function waitForStableSize(read: () => ImageViewSize, interval = 50, maxWait = 1000): Promise<void> {
    await afterLayout();
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
