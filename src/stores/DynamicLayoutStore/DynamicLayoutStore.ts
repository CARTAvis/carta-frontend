import {action, autorun, computed, flow, makeObservable, observable} from "mobx";

import {AppToaster, SuccessToast} from "components/Shared";
import {ApiService} from "services";
import {AlertStore, AppStore, DialogId, LayoutStore, PreferenceStore} from "stores";

const INITIAL_LAYOUT_ITEM = "Initial Layout";
const LAYOUT_MAPPING_FILE_NAME = "LayoutMapping";

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
    @observable existLayoutMapping: any | null;
    @observable dynamicLayoutName: string | null;
    @observable currentLayoutMappingCtype: any; // type needs to be changed
    @observable currentLayoutMappingIndex: number | null;
    @observable selectedLayoutMappingIndex: number | null; // for the dropdown selection

    @computed get isMappingExisted(): boolean {
        return this.existLayoutMapping ? Object.keys(this.existLayoutMapping).length > 0 : false;
    }

    // @computed get dialogShowedCtype(): string {
    //     const index = this.selectedLayoutMappingIndex;
    //     let output = "";
    //     if (this.isMappingExisted) {
    //         output = index === null ? (this.currentLayoutMappingCtype.length > 0 ? this.currentLayoutMappingCtype : this.existLayoutMapping.layoutMap[0].ctype) : this.existLayoutMapping.layoutMap[index].ctype;
    //     }
    //     return output;
    // }

    // @computed get dialogShowedLayoutName(): string {
    //     const index = this.selectedLayoutMappingIndex;
    //     let output = "";
    //     if (this.isMappingExisted) {
    //         output = index === null ? (this.currentLayoutMappingCtype.length > 0 ? LayoutStore.Instance.currentLayoutName : this.existLayoutMapping.layoutMap[0].layoutName) : this.existLayoutMapping.layoutMap[index].layoutName;
    //     }
    //     return output;
    // }

    @computed get dialogIndexShift(): number {
        return this.currentLayoutMappingIndex === null && this.currentLayoutMappingCtype.length > 0 ? 0 : -1;
    }

    @computed get dialogShowedCtypeList(): string[] {
        let output: string[] = [this.currentLayoutMappingCtype ?? []];
        if (this.isMappingExisted) {
            output = this.currentLayoutMappingIndex === null && this.currentLayoutMappingCtype.length > 0 ? [this.currentLayoutMappingCtype, ...Object.keys(this.existLayoutMapping).slice(1)] : Object.keys(this.existLayoutMapping).slice(1);
        }
        return output;
    }

    @computed get dialogShowedLayoutNameList(): string[] {
        const layoutStore = AppStore.Instance.layoutStore;
        let output: string[] | any[] = [layoutStore.currentLayoutName ?? []];
        if (this.isMappingExisted) {
            output =
                this.currentLayoutMappingIndex === null && this.currentLayoutMappingCtype.length > 0 ? [layoutStore.currentLayoutName, ...Object.values(this.existLayoutMapping).slice(1)] : Object.values(this.existLayoutMapping).slice(1);
        }
        return output;
    }

    @computed get dialogLayoutOptions(): string[] {
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
        this.currentLayoutMappingCtype = [];
        this.currentLayoutMappingIndex = null;
        this.existLayoutMapping = null;

        autorun(() => {
            this.isDynamicLayout = PreferenceStore.Instance.isDynamicLayout;
            this.isHighDimPriority = PreferenceStore.Instance.isHighDimPriority;
            this.selectedLayoutMappingIndex = this.currentLayoutMappingIndex ? this.currentLayoutMappingIndex : this.isMappingExisted ? 0 : null;
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

        if (fileBrowserStore.selectedFiles.length <= 0) {
            console.log("no selected files");
            return;
        }

        // if (typeof this.existLayoutMapping.layoutMap === "undefined" || this.existLayoutMapping.layoutMap.length <= 0) {
        //     console.log("no exist layout mapping");
        //     return;
        // }

        const index = this.priorityFileIndexes[0]; // always use the first priority index
        const ctypes = fileBrowserStore.selectedFilesHeaderInfo.ctype[index];

        this.currentLayoutMappingCtype = [...fileBrowserStore.selectedFilesHeaderInfo.ctype[index]].join(",");
        this.currentLayoutMappingIndex = null;

        if (typeof this.existLayoutMapping !== "undefined" && Object.keys(this.existLayoutMapping).length > 0) {
            for (let i = 0; i < Object.keys(this.existLayoutMapping).length; i++) {
                let first2Dim: boolean[] = [];
                let first2DimR: boolean[] = []; // for swapped first two dimensions
                let RestDim: boolean[] = [];

                // let layoutMap = this.existLayoutMapping.layoutMap[i];

                // const restCtypelayoutMap = [...layoutMap.ctype];
                const restCtypelayoutMap = Object.keys(this.existLayoutMapping)[i].split(",");
                const restCtypeData = [...ctypes];

                // if (layoutMap.ctype.length === ctypes.length) {
                if (Object.keys(this.existLayoutMapping)[i].split(",").length === ctypes.length) {
                    // separate the first two dimensions and the rest
                    const first2CtypeLayoutMap = restCtypelayoutMap.splice(0, 2);
                    // const first2CtypeLayoutMapR = first2CtypeLayoutMap.reverse();
                    const first2CtypeData = restCtypeData.splice(0, 2);

                    // first two dimensions match
                    for (let j = 0; j < 2; j++) {
                        first2Dim.push(first2CtypeLayoutMap[j] === first2CtypeData[j]);
                        // first2DimR.push(first2CtypeLayoutMapR[j] === first2CtypeData[j]);
                        first2DimR.push(first2CtypeLayoutMap[2 - j] === first2CtypeData[j]);
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
                            // console.log("matched layout name", layoutMap.layoutName);
                            console.log("matched layout name", Object.values(this.existLayoutMapping)[i]);
                            // save matched layoutName and index
                            this.dynamicLayoutName = Object.values(this.existLayoutMapping)[i] as string;
                            this.currentLayoutMappingIndex = i;
                            break;
                        }
                    }
                }
            }
        }

        // no matched layout
        if (this.currentLayoutMappingIndex === null) {
            console.log("no matched layout");
        }
    }

    @action selectLayoutMap = (index: number) => {
        this.selectedLayoutMappingIndex = this.currentLayoutMappingIndex === null && this.currentLayoutMappingCtype.length > 0 ? (index - 1 < 0 ? null : index - 1) : index;
    };

    @flow.bound *fetchLayoutMapping() {
        try {
            this.existLayoutMapping = yield ApiService.Instance.getLayoutMaps();
        } catch (err) {
            AlertStore.Instance.showAlert("Loading layout map failed!");
            console.log(err);
        }
    }

    @flow.bound *saveLayoutMapping(layoutName: string, layoutMappingCtype: string) {
        const appStore = AppStore.Instance;
        const layoutStore = appStore.layoutStore;

        // set layoutName to INITIAL_LAYOUT_ITEM to delete layout mapping
        if (layoutName === INITIAL_LAYOUT_ITEM) {
            const confirmed = yield appStore.alertStore.showInteractiveAlert(`Do you want to delete dynamic Layout for data type (${layoutMappingCtype})?`);
            if (confirmed) {
                try {
                    yield this.modifyLayoutMapping(this.existLayoutMapping[layoutMappingCtype]);
                    this.dynamicLayoutName = PreferenceStore.Instance.layout;

                    if (this.isDynamicLayout && layoutStore.layoutExists(this.dynamicLayoutName) && this.currentLayoutMappingCtype === layoutMappingCtype) {
                        appStore.dialogStore.hideDialog(DialogId.Layout);
                        layoutStore.applyLayout(this.dynamicLayoutName);
                    }
                } catch (err) {
                    console.log(err);
                    AppToaster.show(SuccessToast("layout-grid", `Fail to delete (${layoutMappingCtype}): ${layoutName}.`, LayoutStore.ToasterTimeout));
                }
            }
            return;
        }

        if (!layoutStore.layoutExists(layoutName)) {
            appStore.alertStore.showAlert(`Save layout map failed! No ${layoutName} layout existed.`);
            return;
        }

        // temporary solution to prevent saving layout mapping as Layout
        if (layoutName === LAYOUT_MAPPING_FILE_NAME) {
            appStore.alertStore.showAlert(`Layout name ${LAYOUT_MAPPING_FILE_NAME} is preserved. Please use another name.`);
            return;
        }

        let layoutMapping = {};
        Object.keys(this.existLayoutMapping).forEach(ctype => {
            layoutMapping[ctype] = this.existLayoutMapping[ctype];
        });
        layoutMapping[layoutMappingCtype] = layoutName;

        const success = yield appStore.apiService.setLayoutMap(LAYOUT_MAPPING_FILE_NAME, layoutMapping);
        if (success) {
            AppToaster.show(SuccessToast("layout-grid", `Apply layout ${layoutName} to data type (${layoutMappingCtype}).`, LayoutStore.ToasterTimeout));
            yield this.fetchLayoutMapping();
            this.matchLayoutMap();

            if (this.isDynamicLayout && layoutStore.layoutExists(this.dynamicLayoutName) && this.currentLayoutMappingCtype === layoutMappingCtype) {
                appStore.dialogStore.hideDialog(DialogId.Layout);
                layoutStore.applyLayout(this.dynamicLayoutName);
            }
        }
    }

    @flow.bound *modifyLayoutMapping(layoutName: string, newLayoutName: string = "") {
        try {
            const appStore = AppStore.Instance;

            let layoutMapping = {};
            if (newLayoutName !== "") {
                Object.keys(this.existLayoutMapping).forEach(ctype => {
                    layoutMapping[ctype] = this.existLayoutMapping[ctype] === layoutName ? newLayoutName : this.existLayoutMapping[ctype];
                });
            } else {
                Object.keys(this.existLayoutMapping).forEach(ctype => {
                    if (this.existLayoutMapping[ctype] !== layoutName) {
                        layoutMapping[ctype] = this.existLayoutMapping[ctype];
                    }
                });
            }

            const success = yield appStore.apiService.setLayoutMap(LAYOUT_MAPPING_FILE_NAME, layoutMapping);
            if (success) {
                yield this.fetchLayoutMapping();
                this.matchLayoutMap();
            } else {
                AlertStore.Instance.showAlert("Updating layout name in LayoutMap failed!");
            }
        } catch (err) {
            console.log(err);
        }
    }

    deleteAllLayoutMapping() {
        Object.keys(this.existLayoutMapping).forEach(ctype => {
            this.modifyLayoutMapping(this.existLayoutMapping[ctype]);
        });
    }
}
