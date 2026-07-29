import * as React from "react";
import {Classes, RangeSlider as BlueprintRangeSlider, type RangeSliderProps, Slider as BlueprintSlider, type SliderProps} from "@blueprintjs/core";

function useResizeKey(isVertical: boolean | undefined) {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [resizeKey, setResizeKey] = React.useState(0);

    React.useLayoutEffect(() => {
        const track = containerRef.current?.querySelector<HTMLElement>(`.${Classes.SLIDER_TRACK}`);
        const resizeObserverClass = track?.ownerDocument.defaultView?.ResizeObserver;
        if (!track || !resizeObserverClass) {
            return undefined;
        }

        const getTrackSize = () => (isVertical ? track.clientHeight : track.clientWidth);
        let trackSize = getTrackSize();
        const observer = new resizeObserverClass(() => {
            const nextTrackSize = getTrackSize();
            if (nextTrackSize !== trackSize) {
                trackSize = nextTrackSize;
                setResizeKey(key => key + 1);
            }
        });
        observer.observe(track);
        return () => observer.disconnect();
    }, [isVertical, resizeKey]);

    return {containerRef, resizeKey};
}

export const Slider = (props: SliderProps) => {
    const {containerRef, resizeKey} = useResizeKey(props.vertical);
    return (
        <div ref={containerRef} style={{display: "contents"}}>
            <BlueprintSlider key={resizeKey} {...props} />
        </div>
    );
};

export const RangeSlider = (props: RangeSliderProps) => {
    const {containerRef, resizeKey} = useResizeKey(props.vertical);
    return (
        <div ref={containerRef} style={{display: "contents"}}>
            <BlueprintRangeSlider key={resizeKey} {...props} />
        </div>
    );
};
