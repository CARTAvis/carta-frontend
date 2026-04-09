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

    @observable isAlertVisible: boolean = false;
    @observable alertText: string | React.ReactNode = "";
    @observable alertIcon: IconName | MaybeElement = undefined;
    @observable alertType: AlertType = AlertType.Info;
    @observable interactiveAlertText: string | React.ReactNode = "";
    @observable shouldShowDashboardLink: boolean = false;
    private interactionPromise: Deferred<boolean> | null;

    @action showAlert = (text: string | React.ReactNode, icon?: IconName | MaybeElement, shouldShowDashboard = false) => {
        this.alertText = text;
        this.alertIcon = icon;
        this.alertType = AlertType.Info;
        this.shouldShowDashboardLink = shouldShowDashboard;
        this.isAlertVisible = true;
    };

    @action dismissAlert = () => {
        this.isAlertVisible = false;
    };

    @action showInteractiveAlert = (text: string | React.ReactNode, icon?: IconName | MaybeElement, isShowDashboard = false) => {
        this.interactiveAlertText = text;
        this.alertIcon = icon;
        this.alertType = AlertType.Interactive;
        this.isAlertVisible = true;
        this.shouldShowDashboardLink = isShowDashboard;
        this.interactionPromise = new Deferred<boolean>();
        return this.interactionPromise.promise;
    };

    @action showRetryAlert = (text: string | React.ReactNode, icon?: IconName | MaybeElement, isShowDashboard = false) => {
        this.interactiveAlertText = text;
        this.alertIcon = icon;
        this.alertType = AlertType.Retry;
        this.isAlertVisible = true;
        this.shouldShowDashboardLink = isShowDashboard;
        this.interactionPromise = new Deferred<boolean>();
        return this.interactionPromise.promise;
    };

    @action handleInteractiveAlertClosed = (isConfirmed: boolean) => {
        this.isAlertVisible = false;
        if (this.interactionPromise) {
            this.interactionPromise.resolve(isConfirmed);
            this.interactionPromise = null;
        }
    };

    private constructor() {
        makeObservable(this);
    }
}
