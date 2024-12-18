import React from "react";
import {ResizeEntry, ResizeSensor} from "@blueprintjs/core";

interface ResizeDetectorProps {
    onResize: (width: number, height: number) => void;
    targetRef?: React.RefObject<HTMLElement>; // if there is ref attached to children, the same ref must be set here
    children: React.ReactElement;
}

export const ResizeDetector = ({onResize, targetRef, children}: ResizeDetectorProps) => {
    const handleResize = React.useCallback(
        (entries: ResizeEntry[]) => {
            if (entries.length < 1) {
                return;
            }

            const {width, height} = entries[0].contentRect;
            onResize(width, height);
        },
        [onResize]
    );

    return (
        <ResizeSensor onResize={handleResize} targetRef={targetRef}>
            {children}
        </ResizeSensor>
    );
};
