import * as React from "react";

/**
 * Forwards mouse, pointer, and touch tracking events from a popout window's document
 * to the main window's document. This allows third-party libraries (Blueprint.js Slider,
 * react-split-pane, react-color, etc.) that attach their drag-tracking listeners to the
 * main `document` to work correctly when a widget is in a FlexLayout popout window.
 *
 * Only move/end events are forwarded. Down events reach the correct listeners through
 * React's synthetic event system without any forwarding.
 */
export function PopoutEventForwarder({popoutWindow}: {popoutWindow: Window}) {
    React.useEffect(() => {
        if (popoutWindow === window) {
            return () => {};
        }
        const popoutDoc = popoutWindow.document;

        const forwardMouseEvent = (event: MouseEvent) => {
            document.dispatchEvent(
                new MouseEvent(event.type, {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    detail: event.detail,
                    screenX: event.screenX,
                    screenY: event.screenY,
                    clientX: event.clientX,
                    clientY: event.clientY,
                    ctrlKey: event.ctrlKey,
                    altKey: event.altKey,
                    shiftKey: event.shiftKey,
                    metaKey: event.metaKey,
                    button: event.button,
                    buttons: event.buttons,
                    relatedTarget: null
                })
            );
        };

        const forwardPointerEvent = (event: PointerEvent) => {
            document.dispatchEvent(
                new PointerEvent(event.type, {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    detail: event.detail,
                    screenX: event.screenX,
                    screenY: event.screenY,
                    clientX: event.clientX,
                    clientY: event.clientY,
                    ctrlKey: event.ctrlKey,
                    altKey: event.altKey,
                    shiftKey: event.shiftKey,
                    metaKey: event.metaKey,
                    button: event.button,
                    buttons: event.buttons,
                    relatedTarget: null,
                    pointerId: event.pointerId,
                    width: event.width,
                    height: event.height,
                    pressure: event.pressure,
                    tangentialPressure: event.tangentialPressure,
                    tiltX: event.tiltX,
                    tiltY: event.tiltY,
                    twist: event.twist,
                    pointerType: event.pointerType,
                    isPrimary: event.isPrimary
                })
            );
        };

        const forwardTouchEvent = (event: TouchEvent) => {
            try {
                document.dispatchEvent(
                    new TouchEvent(event.type, {
                        bubbles: true,
                        cancelable: true,
                        view: window,
                        ctrlKey: event.ctrlKey,
                        altKey: event.altKey,
                        shiftKey: event.shiftKey,
                        metaKey: event.metaKey,
                        touches: Array.from(event.touches),
                        targetTouches: Array.from(event.targetTouches),
                        changedTouches: Array.from(event.changedTouches)
                    })
                );
            } catch {
                // TouchEvent constructor not supported on all platforms (e.g. desktop Firefox)
            }
        };

        popoutDoc.addEventListener("mousemove", forwardMouseEvent);
        popoutDoc.addEventListener("mouseup", forwardMouseEvent);
        popoutDoc.addEventListener("pointermove", forwardPointerEvent);
        popoutDoc.addEventListener("pointerup", forwardPointerEvent);
        popoutDoc.addEventListener("pointercancel", forwardPointerEvent);
        popoutDoc.addEventListener("touchmove", forwardTouchEvent);
        popoutDoc.addEventListener("touchend", forwardTouchEvent);
        popoutDoc.addEventListener("touchcancel", forwardTouchEvent);

        return () => {
            popoutDoc.removeEventListener("mousemove", forwardMouseEvent);
            popoutDoc.removeEventListener("mouseup", forwardMouseEvent);
            popoutDoc.removeEventListener("pointermove", forwardPointerEvent);
            popoutDoc.removeEventListener("pointerup", forwardPointerEvent);
            popoutDoc.removeEventListener("pointercancel", forwardPointerEvent);
            popoutDoc.removeEventListener("touchmove", forwardTouchEvent);
            popoutDoc.removeEventListener("touchend", forwardTouchEvent);
            popoutDoc.removeEventListener("touchcancel", forwardTouchEvent);
        };
    }, [popoutWindow]);

    return null;
}
