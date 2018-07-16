import {action, observable} from "mobx";

export class AlertStore {
    @observable alertVisible;
    @observable alertText;

    @action("show_alert") showAlert = (text: string) => {
        this.alertText = text;
        this.alertVisible = true;
    };

    @action("dismiss_alert") dismissAlert = () => {
        this.alertVisible = false;
    }
}