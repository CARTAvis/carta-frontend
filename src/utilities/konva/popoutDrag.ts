import type Konva from "konva";
import {DD} from "konva/lib/DragAndDrop";

interface PopoutDragListenerConfig {
    type: keyof WindowEventMap;
    listener: EventListener;
    useCapture?: boolean;
}

const PopoutDragListeners: PopoutDragListenerConfig[] = [
    {type: "mouseup", listener: DD._endDragBefore as EventListener, useCapture: true},
    {type: "touchend", listener: DD._endDragBefore as EventListener, useCapture: true},
    {type: "mousemove", listener: DD._drag as EventListener},
    {type: "touchmove", listener: DD._drag as EventListener},
    {type: "mouseup", listener: DD._endDragAfter as EventListener, useCapture: false},
    {type: "touchend", listener: DD._endDragAfter as EventListener, useCapture: false}
];

export function setupKonvaPopoutDragListeners(stage: Konva.Stage | null): (() => void) | null {
    if (!stage) {
        return null;
    }

    const container = stage.container();
    const popoutWindow = container?.ownerDocument?.defaultView;
    if (!popoutWindow || popoutWindow === window) {
        return null;
    }

    const updateListeners = (addListeners: boolean) => {
        PopoutDragListeners.forEach(({type, listener, useCapture}) => {
            if (addListeners) {
                popoutWindow.addEventListener(type, listener, useCapture);
            } else {
                popoutWindow.removeEventListener(type, listener, useCapture);
            }
        });
    };

    updateListeners(true);
    return () => updateListeners(false);
}
