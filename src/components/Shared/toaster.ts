import {createRoot} from "react-dom/client";
import {type IconName, OverlayToaster, Position, type ToastProps} from "@blueprintjs/core";

import {copyToClipboard} from "utilities";

// eslint-disable-next-line @typescript-eslint/naming-convention
const Toaster = OverlayToaster.create(
    {
        className: "app-toaster",
        position: Position.BOTTOM
    },
    {
        domRenderer: (toaster, containerElement) => createRoot(containerElement).render(toaster)
    }
);

// eslint-disable-next-line @typescript-eslint/naming-convention
export const AppToaster = {
    show: async (toast: ToastProps) => {
        (await Toaster).show(toast);
    },
    clear: async () => {
        (await Toaster).clear();
    }
};

const CLIPBOARD_COPY_FAILED_MESSAGE = "Failed to copy to clipboard.";

export const SuccessToast = (icon: IconName, message: string, timeout?: number): ToastProps => {
    return {
        icon: icon,
        intent: "success",
        message: message,
        timeout: timeout || timeout === 0 ? timeout : 3000
    };
};

export async function copyToClipboardWithToast(value: string, successMessage?: string) {
    try {
        const didCopy = await copyToClipboard(value);
        if (!didCopy) {
            AppToaster.show(WarningToast(CLIPBOARD_COPY_FAILED_MESSAGE));
        } else if (successMessage) {
            AppToaster.show(SuccessToast("clipboard", successMessage));
        }
        return didCopy;
    } catch (err) {
        console.error(err);
    }
    return false;
}

export const ErrorToast = (message: string): ToastProps => {
    return {
        icon: "error",
        intent: "danger",
        message: message,
        timeout: 30000,
        action: {
            onClick: () => copyToClipboardWithToast(message),
            icon: "clipboard"
        }
    };
};

export const WarningToast = (message: string): ToastProps => {
    return {
        icon: "warning-sign",
        intent: "warning",
        message: message,
        timeout: 30000,
        action: {
            onClick: () => copyToClipboardWithToast(message),
            icon: "clipboard"
        }
    };
};
