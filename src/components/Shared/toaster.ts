import { Position, Toaster } from "@blueprintjs/core";

export const AppToaster = Toaster.create({
    className: "app-toaster",
    position: Position.BOTTOM
});

export const LayoutToaster = Toaster.create({
    className: "app-toaster",
    position: Position.TOP
});