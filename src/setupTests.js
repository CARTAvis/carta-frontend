import "@testing-library/jest-dom";
import "jest-canvas-mock";

// Set up global mocks
window.URL.createObjectURL = () => {};
global.WebGL2RenderingContext = null;

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

// Mock matchMedia for Blueprint.js components
Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {}, // deprecated
        removeListener: () => {}, // deprecated
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => {}
    })
});
