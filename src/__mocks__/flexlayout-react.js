module.exports = {
    Model: {
        fromJson: jest.fn()
    },
    Layout: jest.fn(),
    Actions: {
        // Action type constants, mirroring flexlayout-react, so that tests dispatching one
        // action are not matched by the handler for another.
        ADD_TAB: "FlexLayout_AddTab",
        DELETE_TAB: "FlexLayout_DeleteTab",
        RENAME_TAB: "FlexLayout_RenameTab",
        SELECT_TAB: "FlexLayout_SelectTab",
        MOVE_NODE: "FlexLayout_MoveNode",
        DELETE_TABSET: "FlexLayout_DeleteTabset",
        SET_ACTIVE_TABSET: "FlexLayout_SetActiveTabset",
        ADJUST_WEIGHTS: "FlexLayout_AdjustWeights",
        ADJUST_BORDER_SPLIT: "FlexLayout_AdjustBorderSplit",
        MAXIMIZE_TOGGLE: "FlexLayout_MaximizeToggle",
        UPDATE_MODEL_ATTRIBUTES: "FlexLayout_UpdateModelAttributes",
        UPDATE_NODE_ATTRIBUTES: "FlexLayout_UpdateNodeAttributes",
        POPOUT_TAB: "FlexLayout_PopoutTab",
        POPOUT_TABSET: "FlexLayout_PopoutTabset",
        CLOSE_POPOUT: "FlexLayout_ClosePopout",
        MOVE_POPOUT_TO_FRONT: "FlexLayout_MoveFloatToFront",
        CREATE_SUBLAYOUT: "FlexLayout_CreateSubLayout",
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
