export interface ZIndexUpdate {
    id: string;
    zIndex: number;
}

export class ZIndexManagement {
    private static staticInstance: ZIndexManagement;

    static get Instance() {
        return ZIndexManagement.staticInstance || new ZIndexManagement();
    }

    public assignFloatingObjzIndex = (id: string, floatingObjs: ZIndexUpdate[]) => {
        let zIndex = floatingObjs.length + 1;
        let zIndexUpdate: ZIndexUpdate = {id: id, zIndex: zIndex};
        floatingObjs.push(zIndexUpdate);
    };

    public removeFloatingObjzIndex = (id: string, floatingObjs: ZIndexUpdate[]) => { 
        return floatingObjs.filter(w => w.id !== id);
    }

    // update floating Object's zIndex
    public updateFloatingObjzIndexOnSelect = (id: string, floatingObjs: ZIndexUpdate[]) => {
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

    // update widget zIndex when removing a floating object
    public updateFloatingObjzIndexOnRemove = (id: string, floatingObjs: ZIndexUpdate[]) => {
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

    public findzIndex = (id: string, floatingObjs: ZIndexUpdate[]) => {
        const selectDialog = floatingObjs.find(w => w.id === id);
        let zIndex = selectDialog ? selectDialog.zIndex : 0;
        return zIndex;
    };
}
