import {AppStore} from "stores";

export interface ZIndexUpdate {
    id: string;
    zIndex: number;
}

export function addFloatingObjzIndex(id: string) {
    const appStore = AppStore.Instance;
    let zIndex = appStore.floatingObjs.length + 1;
    let zIndexUpdate: ZIndexUpdate = {id: id, zIndex: zIndex};
    appStore.floatingObjs.push(zIndexUpdate);
}

export function removeFloatingObjzIndex(id: string) {
    const appStore = AppStore.Instance;
    appStore.floatingObjs = appStore.floatingObjs.filter(w => w.id !== id);
}

// update floating Object's zIndex
export function updateSelectFloatingObjzIndex(id: string) {
    const appStore = AppStore.Instance;
    const selectedObjIndex = appStore.floatingObjs.findIndex(w => w.id === id);
    const selectedObj = appStore.floatingObjs[selectedObjIndex];
    const NFloatingObj = appStore.floatingObjs.length;
    if (NFloatingObj > 1 && selectedObjIndex >= 0 && selectedObj.zIndex < NFloatingObj) {
        for (let i = 0; i < NFloatingObj; i++) {
            let currentObjzIndex = appStore.floatingObjs[i].zIndex;
            if (currentObjzIndex >= selectedObj.zIndex) {
                appStore.floatingObjs[i].zIndex = currentObjzIndex - 1;
            }
        }
        appStore.floatingObjs[selectedObjIndex].zIndex = appStore.floatingObjs.length;
    }
    appStore.floatingObjs.map(w => console.log(w.id, w.zIndex));
}

// update widget zIndex when removing a floating object
export function updateFloatingObjzIndexOnRemove(zIndexOri: number) {
    const appStore = AppStore.Instance;
    const NFloatingObj = appStore.floatingObjs.length;
    if (zIndexOri < NFloatingObj) {
        for (let index = 0; index < NFloatingObj; index++) {
            const zIndex = appStore.floatingObjs[index].zIndex;
            if (zIndex > zIndexOri) {
                appStore.floatingObjs[index].zIndex = zIndex - 1;
            }
        }
    }
}

export function findzIndex(id: string) {
    const appStore = AppStore.Instance;
    const selectDialog = appStore.floatingObjs.find(w => w.id === id);
    let zIndex = selectDialog ? selectDialog.zIndex : 0;
    return zIndex;
}
