import * as React from "react";
import {Classes} from "@blueprintjs/core";
import classNames from "classnames";

export type FlexLayoutDomMarkerTarget = "tab" | "tab-content" | "tabset-toolbar" | "tabset-tabstrip";

export interface FlexLayoutDomMarkerProps {
    nodeId: string;
    target: FlexLayoutDomMarkerTarget;
}

export const FlexLayoutDomMarker = ({nodeId, target, children}: React.PropsWithChildren<FlexLayoutDomMarkerProps>) => {
    const markerRef = React.useRef<HTMLSpanElement>(null);

    React.useLayoutEffect(() => {
        let cleanup: (() => void) | undefined;

        if (target === "tab") {
            const tabButton = markerRef.current?.closest(".flexlayout__tab_button");
            const closeButton = tabButton?.querySelector<HTMLDivElement>(".flexlayout__tab_button_trailing");
            if (closeButton) {
                closeButton.setAttribute("data-testid", nodeId + "-header-close-button");
            }

            const headerTitle = tabButton?.querySelector<HTMLDivElement>(".flexlayout__tab_button_content");
            if (headerTitle) {
                headerTitle.setAttribute("data-testid", nodeId + "-header-title");
            }
        } else if (target === "tab-content") {
            const contentContainer = markerRef.current?.parentElement;
            if (contentContainer) {
                contentContainer.setAttribute("data-testid", nodeId + "-content");
            }
        } else if (target === "tabset-tabstrip") {
            const tabStrip = markerRef.current?.closest<HTMLElement>("[data-layout-path$='/tabstrip']");
            if (tabStrip) {
                const handleDoubleClick = (event: MouseEvent) => {
                    event.stopPropagation();
                };

                tabStrip.addEventListener("dblclick", handleDoubleClick, true);
                cleanup = () => {
                    tabStrip.removeEventListener("dblclick", handleDoubleClick, true);
                };
            }
        } else {
            const maximizeButton = markerRef.current?.parentElement?.querySelector<HTMLButtonElement>("button[data-layout-path$='/button/max']");
            if (maximizeButton) {
                maximizeButton.setAttribute("data-testid", nodeId + "-header-maximize-button");
                maximizeButton.setAttribute("title", "Maximise");
            }

            const popoutButton = markerRef.current?.parentElement?.querySelector<HTMLButtonElement>("button[data-layout-path$='/button/popout']");
            if (popoutButton) {
                popoutButton.setAttribute("data-testid", nodeId + "-header-popout-button");
                popoutButton.setAttribute("title", "Pop out to a new window");
            }
        }

        return cleanup;
    });

    return React.createElement("span", {ref: markerRef, style: children ? undefined : {display: "none"}}, children);
};

export interface WidgetButtonProps {
    buttonKey: string;
    iconClassName: string;
    isDarkTheme: boolean;
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
    testId: string;
    title: string;
    isDisabled?: boolean;
}

export const CreateWidgetButton = ({buttonKey, iconClassName, isDarkTheme, onClick, testId, title, isDisabled}: WidgetButtonProps): React.ReactElement => {
    return React.createElement(
        "button",
        {
            key: buttonKey,
            className: classNames("flexlayout__tab_toolbar_button", {[Classes.DARK]: isDarkTheme}),
            title,
            "data-testid": testId,
            disabled: isDisabled,
            onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
                event.stopPropagation();
                onClick(event);
            }
        },
        React.createElement("span", {className: classNames(Classes.ICON_STANDARD, iconClassName)})
    );
};
