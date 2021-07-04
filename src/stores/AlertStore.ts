import {action, observable, makeObservable} from "mobx";
import React from "react";

export enum AlertType {
    Info,
    Interactive,
    Retry
}

export class AlertStore {
    private static staticInstance: AlertStore;

    static get Instance() {
        if (!AlertStore.staticInstance) {
            AlertStore.staticInstance = new AlertStore();
        }
        return AlertStore.staticInstance;
    }

    @observable alertVisible: boolean;
    @observable alertText: string | React.ReactNode;
    @observable alertIcon: any;
    @observable alertType: AlertType;
    @observable interactiveAlertText: string | React.ReactNode;

    interactiveAlertCallback: (confirmed: boolean) => void;

    @action showAlert = (text: string | React.ReactNode, icon?: any) => {
        this.alertText = text;
        this.alertIcon = icon;
        this.alertType = AlertType.Info;
        this.alertVisible = true;
    };

    @action dismissAlert = () => {
        this.alertVisible = false;
    };

    @action showInteractiveAlert = (text: string | React.ReactNode, onClose: (confirmed: boolean) => void, icon?: any) => {
        this.interactiveAlertText = text;
        this.alertIcon = icon;
        this.alertType = AlertType.Interactive;
        this.alertVisible = true;
        this.interactiveAlertCallback = onClose;
    };

    @action showRetryAlert = (text: string | React.ReactNode, onClose: (confirmed: boolean) => void, icon?: any) => {
        this.interactiveAlertText = text;
        this.alertIcon = icon;
        this.alertType = AlertType.Retry;
        this.alertVisible = true;
        this.interactiveAlertCallback = onClose;
    };

    @action handleInteractiveAlertClosed = (confirmed: boolean) => {
        this.alertVisible = false;
        if (this.interactiveAlertCallback) {
            this.interactiveAlertCallback(confirmed);
        }
    };

    private constructor() {
        makeObservable(this);
        this.alertVisible = false;
    }
}
