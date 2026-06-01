module.exports = {
    Model: {
        fromJson: jest.fn()
    },
    Layout: jest.fn(),
    Actions: {
        moveNode: jest.fn(),
        deleteTab: jest.fn(),
        renameTab: jest.fn(),
        updateNodeAttributes: jest.fn()
    },
    DockLocation: {
        CENTER: "center",
        LEFT: "left",
        RIGHT: "right",
        TOP: "top",
        BOTTOM: "bottom"
    },
    Orientation: {
        HORZ: {getName: () => "horz"},
        VERT: {getName: () => "vert"}
    }
};
