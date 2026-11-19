type ColorbarPosition = "right" | "top" | "bottom";

interface ColorbarStagePositionOptions {
    position: ColorbarPosition;
    viewHeight: number;
    renderWidth: number;
    padding: {left: number; top: number};
    stageWidth: number;
    hoverInfoHeight: number;
    isTitleVisible: boolean;
}

export function getColorbarStagePosition({position, viewHeight, renderWidth, padding, stageWidth, hoverInfoHeight, isTitleVisible}: ColorbarStagePositionOptions) {
    if (position === "right") {
        return {left: padding.left + renderWidth, top: 0};
    }
    if (position === "bottom") {
        return {left: 0, top: viewHeight - hoverInfoHeight - stageWidth};
    }
    return {left: 0, top: isTitleVisible ? padding.top - stageWidth : 0};
}
