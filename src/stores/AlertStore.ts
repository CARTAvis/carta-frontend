import { action, observable, makeObservable } from "mobx";

export class AlertStore {
    private static staticInstance: AlertStore;

    static get Instance() {
        if (!AlertStore.staticInstance) {
            AlertStore.staticInstance = new AlertStore();
        }
        return AlertStore.staticInstance;
    }

    @observable alertVisible: boolean;
    @observable alertText: string;
    @observable interactiveAlertVisible: boolean;
    @observable interactiveAlertText: string;
    interactiveAlertCallback: (confirmed: boolean) => void;

    @action("show_alert") showAlert = (text: string) => {
        this.alertText = text;
        this.alertVisible = true;
    };

    @action("dismiss_alert") dismissAlert = () => {
        this.alertVisible = false;
    };

    @action("show_alert") showInteractiveAlert = (text: string, onClose: (confirmed: boolean) => void) => {
        this.interactiveAlertText = text;
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