import {makeObservable, observable} from "mobx";

export class FloatingObjzIndexManager {
    @observable private floatingObjs;

    constructor() {
        makeObservable(this);
        this.floatingObjs = new Map<string, number>();
    }

    public getFloatingObjs = () => {
        return this.floatingObjs;
    };

    public assignIndex = (id: string) => {
        const zIndex = this.floatingObjs.size + 1;
        this.floatingObjs.set(id, zIndex);
    };

    public findIndex = (id: string) => {
        return this.floatingObjs.has(id) ? this.floatingObjs.get(id) : 0;
    };

    public removeIndex = (id: string) => {
        this.floatingObjs.delete(id);
    };

    public updateIndexOnSelect = (id: string) => {
        const selectedObj = this.floatingObjs.has(id);
        if (selectedObj) {
            const selectedzIndex = this.floatingObjs.get(id);
            const NFloatingObj = this.floatingObjs.size;

            if (NFloatingObj > 1 && selectedzIndex < NFloatingObj) {
                for (let key of this.floatingObjs.keys()) {
                    let currentObjzIndex = this.floatingObjs.get(key);
                    if (currentObjzIndex >= selectedzIndex) {
                        this.floatingObjs.set(key, currentObjzIndex - 1);
                    }
                }
                this.floatingObjs.set(id, NFloatingObj);
            }
        }
    };

    public updateIndexOnRemove = (id: string) => {
        const selectedObj = this.floatingObjs.has(id);
        if (selectedObj) {
            const selectedzIndex = this.floatingObjs.get(id);
            const NFloatingObj = this.floatingObjs.size;

            if (selectedzIndex < NFloatingObj) {
                for (let key of this.floatingObjs.keys()) {
                    let currentObjzIndex = this.floatingObjs.get(key);
                    if (currentObjzIndex > selectedzIndex) {
                        this.floatingObjs.set(key, currentObjzIndex - 1);
                    }
                }
            }
        }
    };
}
