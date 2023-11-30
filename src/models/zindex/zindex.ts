import {makeObservable, observable} from "mobx";

export interface ZIndexUpdate {
    id: string;
    zIndex: number;
}

export class FloatingObjzIndexManager {
    @observable private floatingObjs: ZIndexUpdate[];

    constructor() {
        makeObservable(this);
        this.floatingObjs = [];
    }

    public getFloatingObjs = () => {
        return this.floatingObjs;
    };

    public assignIndex = (id: string) => {
        const zIndex = this.floatingObjs.length + 1;
        const zIndexUpdate: ZIndexUpdate = {id: id, zIndex: zIndex};
        this.floatingObjs.push(zIndexUpdate);
    };

    public removeIndex = (id: string) => {
        this.floatingObjs = this.floatingObjs.filter(w => w.id !== id);
    };

    public updateIndexOnSelect = (id: string) => {
        const selectedObjIndex = this.floatingObjs.findIndex(w => w.id === id);
        const selectedObj = this.floatingObjs[selectedObjIndex];
        const NFloatingObj = this.floatingObjs.length;

        if (NFloatingObj > 1 && selectedObjIndex >= 0 && selectedObj.zIndex < NFloatingObj) {
            for (let i = 0; i < NFloatingObj; i++) {
                let currentObjzIndex = this.floatingObjs[i].zIndex;
                if (currentObjzIndex >= selectedObj.zIndex) {
                    this.floatingObjs[i].zIndex = currentObjzIndex - 1;
                }
            }
            this.floatingObjs[selectedObjIndex].zIndex = this.floatingObjs.length;
        }
    };

    public updateIndexOnRemove = (id: string) => {
        const NFloatingObj = this.floatingObjs.length;
        const selectedObj = this.floatingObjs.find(w => w.id === id);
        const selectedObjzIndex = selectedObj.zIndex;

        if (selectedObjzIndex < NFloatingObj) {
            for (let index = 0; index < NFloatingObj; index++) {
                let zIndex = this.floatingObjs[index].zIndex;
                if (zIndex > selectedObjzIndex) {
                    this.floatingObjs[index].zIndex = zIndex - 1;
                }
            }
        }
    };

    public findIndex = (id: string) => {
        const selectFloatingObj = this.floatingObjs.find(w => w.id === id);
        return selectFloatingObj ? selectFloatingObj.zIndex : 0;
    };
}
