import React from "react";
import {ResizeEntry, ResizeSensor} from "@blueprintjs/core";
import * as _ from "lodash";

interface ResizeDetectorProps {
    onResize: (width: number, height: number) => void;
    throttleTime?: number; // optional throttle time in milliseconds
    targetRef?: React.RefObject<HTMLElement>; // if there is ref attached to children, the same ref must be set here
    children: React.ReactElement;
}

export const ResizeDetector = ({onResize, throttleTime, targetRef, children}: ResizeDetectorProps) => {
    const handleResize = React.useMemo(() => {
        const resize = (entries: ResizeEntry[]) => {
            if (entries.length < 1) {
                return;
            }

            const {width, height} = entries[0].contentRect;
            onResize(width, height);
        };
        return throttleTime ? _.throttle(resize, throttleTime) : resize;
    }, [onResize, throttleTime]);

    return (
        <ResizeSensor onResize={handleResize} targetRef={targetRef}>
            {children}
        </ResizeSensor>
    );
};
