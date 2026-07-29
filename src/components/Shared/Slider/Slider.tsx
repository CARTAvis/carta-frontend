import * as React from "react";
import {Classes, type MultiSlider, RangeSlider as BlueprintRangeSlider, type RangeSliderProps, Slider as BlueprintSlider, type SliderProps} from "@blueprintjs/core";

interface ResizableSlider {
    refreshTrackSize(): void;
}

function refreshMultiSlider(ref: React.RefObject<MultiSlider | null>) {
    (ref.current as unknown as {updateTickSize(): void} | null)?.updateTickSize();
}

class ResizableBlueprintSlider extends BlueprintSlider implements ResizableSlider {
    private readonly multiSliderRef = React.createRef<MultiSlider>();

    public render() {
        return React.cloneElement(super.render(), {ref: this.multiSliderRef});
    }

    public refreshTrackSize() {
        refreshMultiSlider(this.multiSliderRef);
    }
}

class ResizableBlueprintRangeSlider extends BlueprintRangeSlider implements ResizableSlider {
    private readonly multiSliderRef = React.createRef<MultiSlider>();

    public render() {
        return React.cloneElement(super.render(), {ref: this.multiSliderRef});
    }

    public refreshTrackSize() {
        refreshMultiSlider(this.multiSliderRef);
    }
}

function useResizeObserver<T extends ResizableSlider>(isVertical: boolean | undefined, sliderRef: React.RefObject<T | null>) {
    const containerRef = React.useRef<HTMLDivElement>(null);

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
                sliderRef.current?.refreshTrackSize();
            }
        });
        observer.observe(track);
        return () => observer.disconnect();
    }, [isVertical, sliderRef]);

    return containerRef;
}

export const Slider = (props: SliderProps) => {
    const sliderRef = React.useRef<ResizableBlueprintSlider>(null);
    const containerRef = useResizeObserver(props.vertical, sliderRef);
    return (
        <div ref={containerRef} style={{display: "contents"}}>
            <ResizableBlueprintSlider ref={sliderRef} {...props} />
        </div>
    );
};

export const RangeSlider = (props: RangeSliderProps) => {
    const sliderRef = React.useRef<ResizableBlueprintRangeSlider>(null);
    const containerRef = useResizeObserver(props.vertical, sliderRef);
    return (
        <div ref={containerRef} style={{display: "contents"}}>
            <ResizableBlueprintRangeSlider ref={sliderRef} {...props} />
        </div>
    );
};
