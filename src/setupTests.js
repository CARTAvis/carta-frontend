window.URL.createObjectURL = () => {};
global.WebGL2RenderingContext = null;

Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {}, // deprecated
        removeListener: () => {}, // deprecated
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => {},
    }),
});