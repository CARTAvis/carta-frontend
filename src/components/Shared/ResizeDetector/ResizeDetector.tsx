import React from "react";
import * as _ from "lodash";

interface ResizeDetectorProps {
    onResize: (width: number, height: number) => void;
    throttleTime?: number; // optional throttle time in milliseconds
    targetRef?: React.RefObject<HTMLElement>; // if there is ref attached to children, the same ref must be set here
    forceResizeRef?: React.MutableRefObject<(() => void) | null>; // assign a ref to imperatively trigger a resize measurement
    children: React.ReactElement;
}

export const ResizeDetector = ({onResize, throttleTime, targetRef, forceResizeRef, children}: ResizeDetectorProps) => {
    const internalRef = React.useRef<HTMLElement>(null);
    const activeRef = targetRef ?? internalRef;

    const handleResize: ResizeObserverCallback = React.useMemo(() => {
        const cb: ResizeObserverCallback = (entries: ResizeObserverEntry[]) => {
            if (entries.length < 1) {
                return;
            }
            const {width, height} = entries[0].contentRect;
            onResize(width, height);
        };
        return throttleTime ? _.throttle(cb, throttleTime) : cb;
    }, [onResize, throttleTime]);

    React.useEffect(() => {
        const element = activeRef.current;
        if (!element) {
            return undefined;
        }
        // Use the element's own window's ResizeObserver so that this works correctly
        // when the element is in a cross-document React portal (e.g. FlexLayout popout window).
        // Using the global ResizeObserver (from the main window) may not observe elements
        // belonging to a different document.
        const win = element.ownerDocument?.defaultView ?? window;
        const observer = new (win as Window & typeof globalThis).ResizeObserver(handleResize);
        observer.observe(element);

        // IntersectionObserver catches visibility transitions (e.g. tab shown after a
        // sibling was popped out) where ResizeObserver won't fire because the element
        // size hasn't actually changed between hide and show.
        const intersectionObserver = new win.IntersectionObserver(entries => {
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    const el = activeRef.current;
                    if (el) {
                        const {width, height} = el.getBoundingClientRect();
                        onResize(width, height);
                    }
                }
            }
        });
        intersectionObserver.observe(element);

        if (forceResizeRef) {
            forceResizeRef.current = () => {
                const el = activeRef.current;
                if (el) {
                    const {width, height} = el.getBoundingClientRect();
                    onResize(width, height);
                }
            };
        }
        return () => {
            observer.disconnect();
            intersectionObserver.disconnect();
            if (forceResizeRef) {
                forceResizeRef.current = null;
            }
        };
    }, [activeRef, handleResize]);

    if (targetRef) {
        return children;
    }
    return React.cloneElement(children, {ref: internalRef});
};
