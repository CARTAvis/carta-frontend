import type React from "react";
import type {MaybeElement} from "@blueprintjs/core";
import type {IconName} from "@blueprintjs/icons";
import {action, makeObservable, observable} from "mobx";

import {AlertType} from "enums";
import {Deferred} from "services";

export class AlertStore {
    private static staticInstance: AlertStore;

    static get Instance() {
        if (!AlertStore.staticInstance) {
            AlertStore.staticInstance = new AlertStore();
        }
        return AlertStore.staticInstance;
    }

    @observable alertVisible: boolean = false;
    @observable alertText: string | React.ReactNode = "";
    @observable alertIcon: IconName | MaybeElement = undefined;
    @observable alertType: AlertType = AlertType.Info;
    @observable interactiveAlertText: string | React.ReactNode = "";
    @observable showDashboardLink: boolean = false;
    private interactionPromise: Deferred<boolean> | null;

    private keyDownHandler = (e: KeyboardEvent) => {
        // Only intercept Enter when interactive or retry alert is visible
        if (this.alertVisible && (this.alertType === AlertType.Interactive || this.alertType === AlertType.Retry) && e.key === "Enter" && !e.shiftKey && !e.altKey && !e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            e.stopPropagation();
            this.handleInteractiveAlertClosed(true);
        }
    };

    @action showAlert = (text: string | React.ReactNode, icon?: IconName | MaybeElement, showDashboard = false) => {
        this.alertText = text;
        this.alertIcon = icon;
        this.alertType = AlertType.Info;
        this.showDashboardLink = showDashboard;
        this.alertVisible = true;
    };

    @action dismissAlert = () => {
        this.alertVisible = false;
    };

    @action showInteractiveAlert = (text: string | React.ReactNode, icon?: IconName | MaybeElement, showDashboard = false) => {
        this.interactiveAlertText = text;
        this.alertIcon = icon;
        this.alertType = AlertType.Interactive;
        this.alertVisible = true;
        this.showDashboardLink = showDashboard;
        this.interactionPromise = new Deferred<boolean>();

        // Add keyboard event listener for Enter key confirmation
        document.addEventListener("keydown", this.keyDownHandler, true);

        return this.interactionPromise.promise;
    };

    @action showRetryAlert = (text: string | React.ReactNode, icon?: IconName | MaybeElement, showDashboard = false) => {
        this.interactiveAlertText = text;
        this.alertIcon = icon;
        this.alertType = AlertType.Retry;
        this.alertVisible = true;
        this.showDashboardLink = showDashboard;
        this.interactionPromise = new Deferred<boolean>();

        // Add keyboard event listener for Enter key confirmation (Retry alerts also support Enter)
        document.addEventListener("keydown", this.keyDownHandler, true);

        return this.interactionPromise.promise;
    };

    @action handleInteractiveAlertClosed = (confirmed: boolean) => {
        this.alertVisible = false;

        // Remove keyboard event listener when alert is closed
        document.removeEventListener("keydown", this.keyDownHandler, true);

        if (this.interactionPromise) {
            this.interactionPromise.resolve(confirmed);
            this.interactionPromise = null;
        }
    };

    private constructor() {
        makeObservable(this);
    }
}
