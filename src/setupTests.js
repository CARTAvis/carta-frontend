import "@testing-library/jest-dom";
import "jest-canvas-mock";

window.URL.createObjectURL = () => {};
global.WebGL2RenderingContext = null;
global.ResizeObserver = require("resize-observer-polyfill");

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

jest.mock("ast_wrapper", () => {
    return {
        fonts: [],
        onReady: new Promise(() => {}),
        emptyFitsChan: () => {},
        getFrameFromFitsChan: () => {},
        initDummyFrame: () => {},
        putFits: () => {},
        setColor: () => {},
        geodesicDistance: () => {}
    };
});
