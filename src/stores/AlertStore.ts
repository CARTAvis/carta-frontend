import {action, observable, makeObservable} from "mobx";
import React from "react";
import {Deferred} from "services";

export enum AlertType {
    Info,
    Interactive,
    Retry,
    NewRelease
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
    private interactionPromise: Deferred<boolean>;

    @action showAlert = (text: string | React.ReactNode, icon?: any) => {
        this.alertText = text;
        this.alertIcon = icon;
        this.alertType = AlertType.Info;
        this.alertVisible = true;
    };

    @action dismissAlert = () => {
        this.alertVisible = false;
    };

    @action showInteractiveAlert = (text: string | React.ReactNode, icon?: any) => {
        this.interactiveAlertText = text;
        this.alertIcon = icon;
        this.alertType = AlertType.Interactive;
        this.alertVisible = true;
        this.interactionPromise = new Deferred<boolean>();
        return this.interactionPromise.promise;
    };

    @action showRetryAlert = (text: string | React.ReactNode, icon?: any) => {
        this.interactiveAlertText = text;
        this.alertIcon = icon;
        this.alertType = AlertType.Retry;
        this.alertVisible = true;
        this.interactionPromise = new Deferred<boolean>();
        return this.interactionPromise.promise;
    };

    @action showNewReleaseAlert = () => {
        this.alertType = AlertType.NewRelease;
        this.alertVisible = true;
    };

    @action handleInteractiveAlertClosed = (confirmed: boolean) => {
        this.alertVisible = false;
        if (this.interactionPromise) {
            this.interactionPromise.resolve(confirmed);
            this.interactionPromise = null;
        }
    };

    @action handleNewReleaseAlertCancelled = () => {
        this.alertVisible = false;
        // todo: update preference
    };

    private constructor() {
        makeObservable(this);
        this.alertVisible = false;
    }
}
