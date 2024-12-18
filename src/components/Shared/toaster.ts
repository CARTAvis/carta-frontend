import {createRoot} from "react-dom/client";
import {IconName, OverlayToaster, Position, ToastProps} from "@blueprintjs/core";

import {copyToClipboard} from "utilities";

const toaster = OverlayToaster.createAsync(
    {
        className: "app-toaster",
        position: Position.BOTTOM
    },
    {
        domRenderer: (toaster, containerElement) => createRoot(containerElement).render(toaster)
    }
);

export const AppToaster = {
    show: async (toast: ToastProps) => {
        (await toaster).show(toast);
    },
    clear: async () => {
        (await toaster).clear();
    }
};

export function SuccessToast(icon: IconName, message: string, timeout?: number): ToastProps {
    return {
        icon: icon,
        intent: "success",
        message: message,
        timeout: timeout || timeout === 0 ? timeout : 3000
    };
}

export function ErrorToast(message: string): ToastProps {
    return {
        icon: "error",
        intent: "danger",
        message: message,
        timeout: 30000,
        action: {
            onClick: () => copyToClipboard(message),
            icon: "clipboard"
        }
    };
}

export function WarningToast(message: string): ToastProps {
    return {
        icon: "warning-sign",
        intent: "warning",
        message: message,
        timeout: 30000,
        action: {
            onClick: () => copyToClipboard(message),
            icon: "clipboard"
        }
    };
}
