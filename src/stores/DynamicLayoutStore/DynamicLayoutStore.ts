import {action, autorun, computed, flow, makeObservable, observable} from "mobx";

import {AppToaster, SuccessToast} from "components/Shared";
import {ApiService} from "services";
import {AlertStore, AppStore, DialogId, LAYOUT_MAP_NAME, LayoutStore, PreferenceStore} from "stores";

const INITIAL_LAYOUT_ITEM = "Initial Layout";
export class DynamicLayoutStore {
    private static staticInstance: DynamicLayoutStore;

    static get Instance() {
        if (!DynamicLayoutStore.staticInstance) {
            DynamicLayoutStore.staticInstance = new DynamicLayoutStore();
        }
        return DynamicLayoutStore.staticInstance;
    }

    @observable isDynamicLayout: boolean;
    @observable isHighDimPriority: boolean;
    @observable existLayoutMap: any | null;
    @observable dynamicLayoutName: string | null;
    @observable currentLayoutMapCtype: any; // type needs to be changed
    @observable currentLayoutMapIndex: number | null;
    @observable selectedLayoutMapIndex: number | null; // for the dropdown selection

    @computed get isExistLayoutMap(): boolean {
        if (this.existLayoutMap && this.existLayoutMap.layoutMap) {
            return this.existLayoutMap.layoutMap.length > 0;
        } else {
            return false;
        }
    }

    @computed get dialogShowedCtype(): string {
        const index = this.selectedLayoutMapIndex;
        let output = "";
        if (this.isExistLayoutMap) {
            output = index === null ? (this.currentLayoutMapCtype.length > 0 ? this.currentLayoutMapCtype : this.existLayoutMap.layoutMap[0].ctype) : this.existLayoutMap.layoutMap[index].ctype;
        }
        return output;
    }

    @computed get dialogShowedLayoutName(): string {
        const index = this.selectedLayoutMapIndex;
        let output = "";
        if (this.isExistLayoutMap) {
            output = index === null ? (this.currentLayoutMapCtype.length > 0 ? LayoutStore.Instance.currentLayoutName : this.existLayoutMap.layoutMap[0].layoutName) : this.existLayoutMap.layoutMap[index].layoutName;
        }
        return output;
    }

    @computed get dialogShowedCtypeList(): string[] {
        let output: string[] = [this.currentLayoutMapCtype ?? []];
        if (this.isExistLayoutMap) {
            output =
                this.currentLayoutMapIndex === null && this.currentLayoutMapCtype.length > 0
                    ? [this.currentLayoutMapCtype, ...this.existLayoutMap.layoutMap.map(layout => layout.ctype)]
                    : this.existLayoutMap.layoutMap.map(layout => layout.ctype);
        }
        return output;
    }

    @computed get dialogShowedLayoutNameList(): string[] {
        return [INITIAL_LAYOUT_ITEM, ...LayoutStore.Instance.orderedLayoutNames];
    }

    @computed get priorityFileIndexes() {
        const fileBrowserStore = AppStore.Instance.fileBrowserStore;

        let sortWithIndex = fileBrowserStore.selectedFilesHeaderInfo.dim.map((value, index) => ({index: index, value: value}));
        if (this.isHighDimPriority) {
            sortWithIndex.sort((a, b) => b.value - a.value);
        }
        return sortWithIndex.map(item => item.index);
    }

    constructor() {
        makeObservable(this);

        this.dynamicLayoutName = null;
        this.currentLayoutMapCtype = [];
        this.currentLayoutMapIndex = null;
        this.existLayoutMap = null;

        autorun(() => {
            this.isDynamicLayout = PreferenceStore.Instance.isDynamicLayout;
            this.isHighDimPriority = PreferenceStore.Instance.isHighDimPriority;
            this.selectedLayoutMapIndex = this.currentLayoutMapIndex ? this.currentLayoutMapIndex : this.isExistLayoutMap ? 0 : null;
        });
    }

    @action toogleDynamicLayout = () => {
        this.isDynamicLayout = !this.isDynamicLayout;
    };

    @action toggleHighDimPriority = () => {
        this.isHighDimPriority = !this.isHighDimPriority;
    };

    @action matchLayoutMap() {
        const fileBrowserStore = AppStore.Instance.fileBrowserStore;

        if (fileBrowserStore.selectedFiles.length > 0) {
            for (let k = 0; k < this.priorityFileIndexes.length; k++) {
                const index = this.priorityFileIndexes[k];
                const ctypes = fileBrowserStore.selectedFilesHeaderInfo.ctype[index];

                this.currentLayoutMapCtype = ctypes;
                this.currentLayoutMapIndex = null;

                if (typeof this.existLayoutMap.layoutMap !== "undefined" && this.existLayoutMap.layoutMap.length > 0) {
                    for (let i = 0; i < this.existLayoutMap.layoutMap.length; i++) {
                        let first2Dim: boolean[] = [];
                        let first2DimR: boolean[] = []; // for swapped first two dimensions
                        let RestDim: boolean[] = [];

                        let layoutMap = this.existLayoutMap.layoutMap[i];

                        const restCtypelayoutMap = [...layoutMap.ctype];
                        const restCtypeData = [...ctypes];

                        if (layoutMap.ctype.length === ctypes.length) {
                            // separate the first two dimensions and the rest
                            const first2CtypeLayoutMap = restCtypelayoutMap.splice(0, 2);
                            const first2CtypeLayoutMapR = first2CtypeLayoutMap.reverse();
                            const first2CtypeData = restCtypeData.splice(0, 2);

                            // first two dimensions match
                            for (let j = 0; j < 2; j++) {
                                first2Dim.push(first2CtypeLayoutMap[j] === first2CtypeData[j]);
                                first2DimR.push(first2CtypeLayoutMapR[j] === first2CtypeData[j]);
                            }
                            const isFirst2DimMatch = first2Dim.every((c: any) => c === true);
                            const isFirst2DimMatchR = first2DimR.every((c: any) => c === true);

                            if (isFirst2DimMatch || isFirst2DimMatchR) {
                                // the rest of dimensions match
                                for (let j = 0; j < restCtypeData.length; j++) {
                                    RestDim.push(restCtypelayoutMap.includes(restCtypeData[j]));
                                }
                                const isRestDimMatch = RestDim.every((c: any) => c === true);

                                if (isRestDimMatch) {
                                    console.log("matched layout name", layoutMap.layoutName);
                                    // save matched layoutName and index
                                    this.dynamicLayoutName = layoutMap.layoutName;
                                    this.currentLayoutMapIndex = i;
                                    break;
                                }
                            }
                        }
                    }
                }

                // matching next data type if no matched layout
                if (this.currentLayoutMapIndex !== null) {
                    break;
                }
            }

            // no matched layout
            if (this.currentLayoutMapIndex === null) {
                console.log("no matched layout");
            }
        }
    }

    @action selectLayoutMap = (index: number) => {
        this.selectedLayoutMapIndex = this.currentLayoutMapIndex === null && this.currentLayoutMapCtype.length > 0 ? (index - 1 < 0 ? null : index - 1) : index;
    };

    @flow.bound *fetchLayoutMap() {
        try {
            this.existLayoutMap = yield ApiService.Instance.getLayoutMaps();
        } catch (err) {
            AlertStore.Instance.showAlert("Loading layout map failed!");
            console.log(err);
        }
    }

    @flow.bound *saveLayoutMap(layoutName: string, layoutMapIndex: number) {
        const appStore = AppStore.Instance;
        const layoutStore = appStore.layoutStore;
        const layoutMapCtype = layoutMapIndex !== null ? this.existLayoutMap.layoutMap[layoutMapIndex].ctype : this.currentLayoutMapCtype;

        if (!layoutName || layoutMapCtype.length === 0) {
            appStore.alertStore.showAlert("Save layout map failed! Empty layouts or name.");
            return;
        }

        if (layoutName === INITIAL_LAYOUT_ITEM) {
            yield this.deleteLayoutMap(this.existLayoutMap.layoutMap[layoutMapIndex].layoutName);
            return;
        }

        const confirmed = yield appStore.alertStore.showInteractiveAlert(`Associate data type (${layoutMapCtype}) to layout: ${layoutName}`);
        if (confirmed) {
            try {
                const success = yield appStore.apiService.setLayoutMap(
                    LAYOUT_MAP_NAME,
                    {
                        layoutMap: [{ctype: layoutMapCtype, layoutName: layoutName}]
                    },
                    layoutMapIndex
                );

                if (success) {
                    AppToaster.show(SuccessToast("layout-grid", `Data type (${layoutMapCtype}) is associated with layout ${layoutName}`, LayoutStore.ToasterTimeout));

                    this.dynamicLayoutName = layoutName;
                    appStore.dialogStore.hideDialog(DialogId.Layout);

                    yield this.fetchLayoutMap(); // update LayoutMap.json
                    if (this.isDynamicLayout) {
                        this.matchLayoutMap();
                        if (this.isDynamicLayout && layoutMapIndex !== null && layoutStore.layoutExists(this.dynamicLayoutName) && this.currentLayoutMapIndex === layoutMapIndex) {
                            layoutStore.applyLayout(this.dynamicLayoutName);
                        }
                    }
                }
            } catch (err) {
                console.log(err);
                AppToaster.show(SuccessToast("layout-grid", `Data type (${layoutMapCtype}) fails to associated with layout ${layoutName}`, LayoutStore.ToasterTimeout));
            }
        }
    }

    @flow.bound *renameLayoutMap(oldName: string, newName: string) {
        try {
            const appStore = AppStore.Instance;
            let successArr: any[] = [];

            for (let i = 0; i < this.existLayoutMap.layoutMap.length; i++) {
                if (this.existLayoutMap.layoutMap[i].layoutName === oldName) {
                    const success = yield appStore.apiService.setLayoutMap(
                        LAYOUT_MAP_NAME,
                        {
                            layoutMap: [{ctype: this.existLayoutMap.layoutMap[i].ctype, layoutName: newName}]
                        },
                        i
                    );
                    successArr.push(success);
                }
            }

            const success = successArr.every((s: boolean) => s === true);
            if (success) {
                yield this.fetchLayoutMap();
                this.matchLayoutMap();
            } else {
                AlertStore.Instance.showAlert("Updating layout name in LayoutMap failed!");
            }
        } catch (err) {
            console.log(err);
        }
    }

    @flow.bound *deleteLayoutMap(layoutName: string) {
        try {
            const appStore = AppStore.Instance;
            let successArr: any[] = [];

            for (let i = this.existLayoutMap.layoutMap.length - 1; i >= 0; i--) {
                if (this.existLayoutMap.layoutMap[i].layoutName === layoutName) {
                    const success = yield appStore.apiService.clearLayoutMap(LAYOUT_MAP_NAME, i);
                    successArr.push(success);
                }
            }

            const success = successArr.every((s: boolean) => s === true);
            if (success) {
                yield this.fetchLayoutMap();
                this.matchLayoutMap();
            } else {
                AlertStore.Instance.showAlert("Deleting layout in LayoutMap failed!");
            }
        } catch (err) {
            console.log(err);
        }
    }

    @flow.bound *setAllLayoutMapDefault() {
        try {
            const appStore = AppStore.Instance;
            let successArr: any[] = [];

            for (let i = 0; i < this.existLayoutMap.layoutMap.length; i++) {
                const success = yield appStore.apiService.setLayoutMap(
                    LAYOUT_MAP_NAME,
                    {
                        layoutMap: [{ctype: this.existLayoutMap.layoutMap[i].ctype, layoutName: PreferenceStore.Instance.layout}]
                    },
                    i
                );
                successArr.push(success);
            }

            const success = successArr.every((s: boolean) => s === true);
            if (success) {
                yield this.fetchLayoutMap();
                this.matchLayoutMap();
            } else {
                AlertStore.Instance.showAlert("Reset all LayoutMap to default failed!");
            }
        } catch (err) {
            console.log(err);
        }
    }
}
