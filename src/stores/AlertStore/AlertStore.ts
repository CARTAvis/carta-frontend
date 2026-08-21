import type React from "react";
import type {MaybeElement} from "@blueprintjs/core";
import type {IconName} from "@blueprintjs/icons";
import {action, makeObservable, observable} from "mobx";

import {AlertType} from "enums";
import {Deferred} from "services";

interface InteractiveAlert {
    text: string | React.ReactNode;
    icon?: IconName | MaybeElement;
    shouldShowDashboard: boolean;
    alertType: AlertType;
    deferred: Deferred<boolean>;
}

export class AlertStore {
    private static staticInstance: AlertStore;

    public static get Instance() {
        if (!AlertStore.staticInstance) {
            AlertStore.staticInstance = new AlertStore();
        }
        return AlertStore.staticInstance;
    }

    @observable isAlertVisible: boolean = false;
    @observable alertText: string | React.ReactNode = "";
    @observable alertIcon: IconName | MaybeElement = undefined;
    @observable alertType: AlertType = AlertType.Info;
    @observable interactiveAlertText: string | React.ReactNode = "";
    @observable shouldShowDashboardLink: boolean = false;
    private interactionPromise: Deferred<boolean> | null = null;
    private interactionQueue: InteractiveAlert[] = [];

    private keyDownHandler = (ev: KeyboardEvent) => {
        const hasNoModifier = !ev.shiftKey && !ev.altKey && !ev.metaKey && !ev.ctrlKey;
        // Only intercept Enter when interactive or retry alert is visible
        if (this.isAlertVisible && (this.alertType === AlertType.Interactive || this.alertType === AlertType.Retry) && ev.key === "Enter" && hasNoModifier) {
            ev.preventDefault();
            ev.stopPropagation();
            this.handleInteractiveAlertClosed(true);
        }
        // ESC key dismisses all alerts
        if (this.isAlertVisible && ev.key === "Escape" && hasNoModifier) {
            ev.preventDefault();
            ev.stopPropagation();
            if (this.alertType === AlertType.Interactive || this.alertType === AlertType.Retry) {
                this.handleInteractiveAlertClosed(false);
            } else {
                this.dismissAlert();
            }
        }
    };

    @action showAlert = (text: string | React.ReactNode, icon?: IconName | MaybeElement, shouldShowDashboard = false) => {
        this.alertText = text;
        this.alertIcon = icon;
        this.alertType = AlertType.Info;
        this.shouldShowDashboardLink = shouldShowDashboard;
        this.isAlertVisible = true;

        document.addEventListener("keydown", this.keyDownHandler, true);
    };

    @action dismissAlert = () => {
        this.isAlertVisible = false;

        document.removeEventListener("keydown", this.keyDownHandler, true);
    };

    @action showInteractiveAlert = (text: string | React.ReactNode, icon?: IconName | MaybeElement, shouldShowDashboard = false) => {
        return this.queueInteractiveAlert(text, icon, shouldShowDashboard, AlertType.Interactive);
    };

    @action showRetryAlert = (text: string | React.ReactNode, icon?: IconName | MaybeElement, shouldShowDashboard = false) => {
        return this.queueInteractiveAlert(text, icon, shouldShowDashboard, AlertType.Retry);
    };

    private queueInteractiveAlert(text: string | React.ReactNode, icon: IconName | MaybeElement, shouldShowDashboard: boolean, alertType: AlertType) {
        const alert = {text, icon, shouldShowDashboard, alertType, deferred: new Deferred<boolean>()};
        if (this.interactionPromise) {
            this.interactionQueue.push(alert);
        } else {
            this.showNextInteractiveAlert(alert);
        }
        return alert.deferred.promise;
    }

    private showNextInteractiveAlert(alert: InteractiveAlert) {
        this.interactiveAlertText = alert.text;
        this.alertIcon = alert.icon;
        this.alertType = alert.alertType;
        this.isAlertVisible = true;
        this.shouldShowDashboardLink = alert.shouldShowDashboard;
        this.interactionPromise = alert.deferred;
        document.addEventListener("keydown", this.keyDownHandler, true);
    }

    @action handleInteractiveAlertClosed = (isConfirmed: boolean) => {
        this.isAlertVisible = false;

        document.removeEventListener("keydown", this.keyDownHandler, true);

        if (this.interactionPromise) {
            this.interactionPromise.resolve(isConfirmed);
            this.interactionPromise = null;
            const nextAlert = this.interactionQueue.shift();
            if (nextAlert) {
                this.showNextInteractiveAlert(nextAlert);
            }
        }
    };

    @action dismissInteractiveAlert = (promise: Promise<boolean>) => {
        if (this.interactionPromise?.promise === promise) {
            this.handleInteractiveAlertClosed(false);
        } else {
            const alertIndex = this.interactionQueue.findIndex(alert => alert.deferred.promise === promise);
            if (alertIndex >= 0) {
                this.interactionQueue.splice(alertIndex, 1)[0].deferred.resolve(false);
            }
        }
    };

    private constructor() {
        makeObservable(this);
    }
}
