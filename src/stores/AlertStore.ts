import {action, observable} from "mobx";

export class AlertStore {
    @observable alertVisible;
    @observable alertText;
    @observable interactiveAlertVisible;
    @observable interactiveAlertText;

    @action("show_alert") showAlert = (text: string) => {
        this.alertText = text;
        this.alertVisible = true;
    };

    @action("dismiss_alert") dismissAlert = () => {
        this.alertVisible = false;
    }

    @action("show_alert") showInteractiveAlert = (text: string) => {
        this.interactiveAlertText = text;
        this.interactiveAlertVisible = true;
    };

    @action("dismiss_alert") dismissInteractiveAlert = () => {
        this.interactiveAlertVisible = false;
    }
}