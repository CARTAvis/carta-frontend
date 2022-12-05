import {action, observable, makeObservable} from "mobx";
import React from "react";
import {IconName} from "@blueprintjs/icons";
import {MaybeElement} from "@blueprintjs/core";
import {Deferred} from "services";

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
    @observable alertIcon: IconName | MaybeElement;
    @observable alertType: AlertType;
    @observable interactiveAlertText: string | React.ReactNode;
    @observable showDashboardLink: boolean;
    private interactionPromise: Deferred<boolean>;

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
        return this.interactionPromise.promise;
    };

    @action showRetryAlert = (text: string | React.ReactNode, icon?: IconName | MaybeElement, showDashboard = false) => {
        this.interactiveAlertText = text;
        this.alertIcon = icon;
        this.alertType = AlertType.Retry;
        this.alertVisible = true;
        this.showDashboardLink = showDashboard;
        this.interactionPromise = new Deferred<boolean>();
        return this.interactionPromise.promise;
    };

    @action handleInteractiveAlertClosed = (confirmed: boolean) => {
        this.alertVisible = false;
        if (this.interactionPromise) {
            this.interactionPromise.resolve(confirmed);
            this.interactionPromise = null;
        }
    };

    private constructor() {
        makeObservable(this);
        this.alertVisible = false;
        this.showDashboardLink = false;
    }
}
