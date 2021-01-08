import { action, observable, makeObservable } from "mobx";
import React from "react";

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
    @observable interactiveAlertVisible: boolean;
    @observable interactiveAlertText: string | React.ReactNode;
    interactiveAlertCallback: (confirmed: boolean) => void;

    @action("show_alert") showAlert = (text: string | React.ReactNode, icon?: any) => {
        this.alertText = text;
        this.alertIcon = icon;
        this.alertVisible = true;
    };

    @action("dismiss_alert") dismissAlert = () => {
        this.alertVisible = false;
    };

    @action("show_alert") showInteractiveAlert = (text: string | React.ReactNode, onClose: (confirmed: boolean) => void, icon?: any) => {
        this.interactiveAlertText = text;
        this.alertIcon = icon;
        this.interactiveAlertVisible = true;
        this.interactiveAlertCallback = onClose;
    };

    @action("dismiss_alert") dismissInteractiveAlert = () => {
        this.interactiveAlertVisible = false;
    };

    @action handleInteractiveAlertClosed = (confirmed: boolean) => {
        this.interactiveAlertVisible = false;
        if (this.interactiveAlertCallback) {
            this.interactiveAlertCallback(confirmed);
        }
    }

    private constructor() {
        makeObservable(this);
        this.alertVisible = false;
        this.interactiveAlertVisible = false;
    }
}