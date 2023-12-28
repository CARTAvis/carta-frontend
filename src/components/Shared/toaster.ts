import {IconName, Position, Toaster, ToastProps} from "@blueprintjs/core";

import {copyToClipboard} from "utilities";

export const AppToaster = Toaster.create({
    className: "app-toaster",
    position: Position.BOTTOM
});

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
