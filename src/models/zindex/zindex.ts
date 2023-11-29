import {AppStore} from "stores";

export interface ZIndexUpdate {
    id: string;
    zIndex: number;
}

export class FloatingObjzIndexManager {
    private static staticInstance: FloatingObjzIndexManager;

    static get Instance() {
        return FloatingObjzIndexManager.staticInstance || new FloatingObjzIndexManager();
    }

    public assignIndex = (id: string) => {
        const appStore = AppStore.Instance;
        let floatingObjs = appStore.getFloatingObjs();
        let zIndex = floatingObjs.length + 1;
        let zIndexUpdate: ZIndexUpdate = {id: id, zIndex: zIndex};
        floatingObjs.push(zIndexUpdate);
        appStore.setFloatingObjs(floatingObjs);
    };

    public removeIndex = (id: string) => {
        const appStore = AppStore.Instance;
        let floatingObjs = appStore.getFloatingObjs();
        let newFloatingObjs = floatingObjs.filter(w => w.id !== id);
        appStore.setFloatingObjs(newFloatingObjs);
    };

    public updateIndexOnSelect = (id: string) => {
        const appStore = AppStore.Instance;
        let floatingObjs = appStore.getFloatingObjs();
        const selectedObjIndex = floatingObjs.findIndex(w => w.id === id);
        const selectedObj = floatingObjs[selectedObjIndex];
        const NFloatingObj = floatingObjs.length;

        if (NFloatingObj > 1 && selectedObjIndex >= 0 && selectedObj.zIndex < NFloatingObj) {
            for (let i = 0; i < NFloatingObj; i++) {
                let currentObjzIndex = floatingObjs[i].zIndex;
                if (currentObjzIndex >= selectedObj.zIndex) {
                    floatingObjs[i].zIndex = currentObjzIndex - 1;
                }
            }
            floatingObjs[selectedObjIndex].zIndex = floatingObjs.length;
        }
        appStore.setFloatingObjs(floatingObjs);
    };

    public updateIndexOnRemove = (id: string) => {
        const appStore = AppStore.Instance;
        let floatingObjs = appStore.getFloatingObjs();
        const NFloatingObj = floatingObjs.length;
        const selectedObj = floatingObjs.find(w => w.id === id);
        const selectedObjzIndex = selectedObj.zIndex;

        if (selectedObjzIndex < NFloatingObj) {
            for (let index = 0; index < NFloatingObj; index++) {
                const zIndex = floatingObjs[index].zIndex;
                if (zIndex > selectedObjzIndex) {
                    floatingObjs[index].zIndex = zIndex - 1;
                }
            }
        }
        appStore.setFloatingObjs(floatingObjs);
    };

    public findIndex = (id: string) => {
        const appStore = AppStore.Instance;
        let floatingObjs = appStore.getFloatingObjs();
        const selectDialog = floatingObjs.find(w => w.id === id);
        let zIndex = selectDialog ? selectDialog.zIndex : 0;
        return zIndex;
    };
}
