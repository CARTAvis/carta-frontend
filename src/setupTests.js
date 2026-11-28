import {rs} from "@rstest/core";

import "@testing-library/jest-dom";
import "rstest-canvas-mock";

// Keep application singletons from reaching external services while unit tests load them.
// Tests for Axios error handling should supply their own mock or use the real implementation.
rs.mock("axios", () => {
    const response = () => Promise.resolve({data: []});
    const request = rs.fn(response);
    const instance = {
        defaults: {headers: {common: {}}},
        delete: rs.fn(response),
        get: rs.fn(response),
        post: rs.fn(response),
        put: rs.fn(response)
    };
    return {
        default: Object.assign(request, {
            CancelToken: {source: rs.fn(() => ({cancel: rs.fn(), token: {}}))},
            create: rs.fn(() => instance),
            delete: rs.fn(response),
            get: rs.fn(response),
            isAxiosError: () => false,
            isCancel: error => Boolean(error?.__CANCEL__),
            post: rs.fn(response),
            put: rs.fn(response)
        })
    };
});

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

// Prism must see manual mode before it loads so it skips scheduling a page-wide highlight.
window.Prism = {manual: true};

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
