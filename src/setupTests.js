import "@testing-library/jest-dom";
import "rstest-canvas-mock";

// Polyfill TextEncoder and TextDecoder for jsdom environment
/* eslint-disable @typescript-eslint/naming-convention */
if (typeof global.TextEncoder === "undefined") {
    const {TextEncoder, TextDecoder} = require("util");
    global.TextEncoder = TextEncoder;
    global.TextDecoder = TextDecoder;
}
/* eslint-enable @typescript-eslint/naming-convention */

window.URL.createObjectURL = () => {};
global.WebGL2RenderingContext = null;

if (typeof global.Worker === "undefined") {
    global.Worker = class {
        postMessage() {}
        terminate() {}
        addEventListener() {}
        removeEventListener() {}
    };
}

// jsdom doesn't implement WebGL contexts; avoid noisy console.error logs when
// app code probes for WebGL2 support during unit tests.
if (typeof HTMLCanvasElement !== "undefined" && HTMLCanvasElement.prototype?.getContext) {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        if (type === "webgl2" || type === "experimental-webgl2") {
            return null;
        }
        return originalGetContext.call(this, type, ...args);
    };
}

Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => {}
    })
});

// jsdom does not implement top-layer elements, and nwsapi recursively evaluates
// these selectors when Floating UI checks whether a popover is in the top layer.
const OriginalMatches = Element.prototype.matches;
Element.prototype.matches = function (selector) {
    if (selector === ":modal" || selector === ":popover-open" || selector === ":fullscreen") {
        return false;
    }
    return OriginalMatches.call(this, selector);
};
