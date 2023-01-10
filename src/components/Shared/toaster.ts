import {Position, Toaster, IToastProps, IconName} from "@blueprintjs/core";

export const AppToaster = Toaster.create({
    className: "app-toaster",
    position: Position.BOTTOM
});

export function SuccessToast(icon: IconName, message: string, timeout?: number): IToastProps {
    return {
        icon: icon,
        intent: "success",
        message: message,
        timeout: timeout || timeout === 0 ? timeout : 3000
    };
}

export function ErrorToast(message: string): IToastProps {
    return {
        icon: "error",
        intent: "danger",
        message: message,
        timeout: 30000,
        action: {
            onClick: () => navigator.clipboard?.writeText(message),
            icon: "clipboard"
        }
    };
}

export function WarningToast(message: string): IToastProps {
    return {
        icon: "warning-sign",
        intent: "warning",
        message: message,
        timeout: 30000,
        action: {
            onClick: () => navigator.clipboard?.writeText(message),
            icon: "clipboard"
        }
    };
}

export function InfoToast(message: string): IToastProps {
    return {
        intent: "success",
        message: message,
        timeout: 3000
    };
}
