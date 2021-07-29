import {action, observable, makeObservable} from "mobx";

export class CatalogOnlineQueryConfigStore {
    private static staticInstance: CatalogOnlineQueryConfigStore;

    @observable isQuerying: boolean;

    constructor() {
        makeObservable(this);
        this.isQuerying = false;
    }

    static get Instance() {
        if (!CatalogOnlineQueryConfigStore.staticInstance) {
            CatalogOnlineQueryConfigStore.staticInstance = new CatalogOnlineQueryConfigStore();
        }
        return CatalogOnlineQueryConfigStore.staticInstance;
    }

    @action setQueryStatus(isQuerying: boolean) {
        this.isQuerying = isQuerying;
    }
}