import {computed, flow, makeObservable, observable} from "mobx";

import {AppToaster, SuccessToast} from "components/Shared";
import {ApiService} from "services";
import {AlertStore, AppStore, DialogId, ISelectedFile, LayoutStore, PreferenceStore} from "stores";

export const INITIAL_LAYOUT_ITEM = "Initial Layout";
const DYNAMIC_LAYOUT = "dynamicLayout";

export class DynamicLayoutStore {
    private static staticInstance: DynamicLayoutStore;

    static get Instance() {
        if (!DynamicLayoutStore.staticInstance) {
            DynamicLayoutStore.staticInstance = new DynamicLayoutStore();
        }
        return DynamicLayoutStore.staticInstance;
    }

    @observable selectedFiles: ISelectedFile[];
    @observable existLayoutMapping: any | null;
    @observable dynamicLayoutName: string;
    @observable dynamicLayoutCtype: string | null;

    @computed get isMappingExisted(): boolean {
        return this.existLayoutMapping ? Object.keys(this.existLayoutMapping).length > 0 : false;
    }

    private priorityFileIndexes(selectedFilesCtypes: {ctype: string[]; name: string[]; rank: number[]}): number[] {
        let sortByDim = selectedFilesCtypes.ctype.map((item, index) => ({index: index, value: item.split(",").length, rank: selectedFilesCtypes.rank[index]}));

        // sort by dimension first. if the dimension is the same, then sort by rank (see CtypeDefinition.ts)
        if (PreferenceStore.Instance.isHighDimPriority) {
            sortByDim.sort((a, b) => (b.value === a.value ? b.rank - a.rank : b.value - a.value));
        }

        return sortByDim.map(item => item.index);
    }

    constructor() {
        makeObservable(this);

        this.selectedFiles = [];
        this.dynamicLayoutName = null;
        this.dynamicLayoutCtype = null;
        this.existLayoutMapping = {};
    }

    @flow.bound *matchLayoutMapping() {
        const FileBrowserStore = AppStore.Instance.fileBrowserStore;

        if (this.selectedFiles.length <= 0) {
            return;
        }

        if (!this.isMappingExisted) {
            console.log("no existing layout mapping");
            return;
        }

        const selectedFilesCtypes = yield FileBrowserStore.selectedFilesCtypeInfo();
        const index = this.priorityFileIndexes(selectedFilesCtypes)[0]; // always use the first priority index

        this.dynamicLayoutCtype = selectedFilesCtypes.ctype[index];
        this.dynamicLayoutName = this.existLayoutMapping[this.dynamicLayoutCtype] ?? null;

        if (this.dynamicLayoutName === null) {
            console.log("No matched layout. Use Initial Layout.");
            this.dynamicLayoutName = INITIAL_LAYOUT_ITEM;
        } else {
            console.log("matched layout name", this.dynamicLayoutName);
        }
    }

    @flow.bound *fetchLayoutMapping() {
        const preferences = yield ApiService.Instance.getPreferences();
        if (preferences) {
            this.existLayoutMapping = preferences[DYNAMIC_LAYOUT];
        }
    }

    @flow.bound *saveLayoutMapping(layoutName: string, layoutMappingCtype: string) {
        const appStore = AppStore.Instance;
        const layoutStore = appStore.layoutStore;

        // set layoutName to INITIAL_LAYOUT_ITEM to delete layout mapping
        if (layoutName === INITIAL_LAYOUT_ITEM) {
            const confirmed = yield appStore.alertStore.showInteractiveAlert(`Do you want to set ${INITIAL_LAYOUT_ITEM} for data type (${layoutMappingCtype})?`);
            if (confirmed) {
                try {
                    yield this.modifyLayoutMapping(this.existLayoutMapping[layoutMappingCtype], "", layoutMappingCtype);
                    this.dynamicLayoutName = PreferenceStore.Instance.layout;

                    if (PreferenceStore.Instance.dynamicLayoutEnable && layoutStore.layoutExists(this.dynamicLayoutName) && this.dynamicLayoutCtype === layoutMappingCtype) {
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

        let layoutMapping = {};
        if (this.isMappingExisted) {
            Object.keys(this.existLayoutMapping).forEach(ctype => {
                layoutMapping[ctype] = this.existLayoutMapping[ctype];
            });
        }
        layoutMapping[layoutMappingCtype] = layoutName;

        const success = yield appStore.apiService.setPreference(DYNAMIC_LAYOUT, layoutMapping);
        if (success) {
            AppToaster.show(SuccessToast("layout-grid", `Apply layout ${layoutName} to data type (${layoutMappingCtype}).`, LayoutStore.ToasterTimeout));
            this.existLayoutMapping = layoutMapping;
            yield this.matchLayoutMapping();

            if (PreferenceStore.Instance.dynamicLayoutEnable && layoutStore.layoutExists(this.dynamicLayoutName) && this.dynamicLayoutCtype === layoutMappingCtype) {
                appStore.dialogStore.hideDialog(DialogId.Layout);
                layoutStore.applyLayout(this.dynamicLayoutName);
            }
        }
    }

    @flow.bound *modifyLayoutMapping(layoutName: string, newLayoutName: string = "", layoutMappingCtype?: string) {
        try {
            const appStore = AppStore.Instance;

            let layoutMapping = {};
            if (newLayoutName !== "") {
                Object.keys(this.existLayoutMapping).forEach(ctype => {
                    layoutMapping[ctype] = this.existLayoutMapping[ctype] === layoutName ? newLayoutName : this.existLayoutMapping[ctype];
                });
            } else if (layoutMappingCtype) {
                Object.keys(this.existLayoutMapping).forEach(ctype => {
                    if (ctype !== layoutMappingCtype) {
                        layoutMapping[ctype] = this.existLayoutMapping[ctype];
                    }
                });
            }

            const success = yield appStore.apiService.setPreference(DYNAMIC_LAYOUT, layoutMapping);
            if (success) {
                this.existLayoutMapping = layoutMapping;
                this.matchLayoutMapping();
            } else {
                AlertStore.Instance.showAlert("Updating layout name in LayoutMap failed!");
            }
        } catch (err) {
            console.log(err);
        }
    }

    deleteAllLayoutMapping() {
        this.existLayoutMapping = {};
    }
}
