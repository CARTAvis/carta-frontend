import {action, observable} from "mobx";

export class AppState {
    @observable astReady = false;

    @action setAstReady(isReady: boolean) {
        this.astReady = isReady;
    }
}