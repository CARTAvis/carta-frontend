import "@testing-library/jest-dom";
import "jest-canvas-mock";

// Set up global mocks
window.URL.createObjectURL = () => {};
global.WebGL2RenderingContext = null;

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
