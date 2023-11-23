export interface ZIndexUpdate {
    id: string;
    zIndex: number;
}

export class FloatingObjzIndexManager {
    private static staticInstance: FloatingObjzIndexManager;

    static get Instance() {
        return FloatingObjzIndexManager.staticInstance || new FloatingObjzIndexManager();
    }

    public assignIndex = (id: string, floatingObjs: ZIndexUpdate[]) => {
        let zIndex = floatingObjs.length + 1;
        let zIndexUpdate: ZIndexUpdate = {id: id, zIndex: zIndex};
        floatingObjs.push(zIndexUpdate);
    };

    public removeIndex = (id: string, floatingObjs: ZIndexUpdate[]) => {
        return floatingObjs.filter(w => w.id !== id);
    };

    // update floating Object's zIndex
    public updateIndexOnSelect = (id: string, floatingObjs: ZIndexUpdate[]) => {
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
    };

    // update zIndex when removing a floating object
    public updateIndexOnRemove = (id: string, floatingObjs: ZIndexUpdate[]) => {
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
    };

    public findIndex = (id: string, floatingObjs: ZIndexUpdate[]) => {
        const selectDialog = floatingObjs.find(w => w.id === id);
        let zIndex = selectDialog ? selectDialog.zIndex : 0;
        return zIndex;
    };
}
