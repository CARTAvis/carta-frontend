import {computed, flow, makeObservable, observable} from "mobx";

import {AppToaster, SuccessToast} from "components/Shared";
import {AppStore, DialogId, PreferenceKeys, PreferenceStore} from "stores";

export const INITIAL_LAYOUT_ITEM = "Initial Layout";

export class DynamicLayoutStore {
    private static staticInstance: DynamicLayoutStore;

    public static readonly ToasterTimeout = 1500;

    static get Instance() {
        if (!DynamicLayoutStore.staticInstance) {
            DynamicLayoutStore.staticInstance = new DynamicLayoutStore();
        }
        return DynamicLayoutStore.staticInstance;
    }

    @observable dynamicLayoutName: string | null;

    @computed get isMappingExisted(): boolean {
        const preferenceStore = PreferenceStore.Instance;
        return preferenceStore.existLayoutMapping ? Object.keys(preferenceStore.existLayoutMapping).length > 0 : false;
    }

    constructor() {
        makeObservable(this);

        this.dynamicLayoutName = null;
    }

    matchLayoutMapping(selectedFilesCtypes: any) {
        const FileBrowserStore = AppStore.Instance.fileBrowserStore;
        const preferenceStore = PreferenceStore.Instance;

        if (!FileBrowserStore.selectedFiles) {
            return;
        }

        if (!this.isMappingExisted) {
            console.log("no existing layout mapping");
            return;
        }

        // sort by dimension first. if the dimension is the same, then sort by rank (see CtypeDefinition.ts)
        let sortByDim = selectedFilesCtypes.ctype.map((item, index) => ({index: index, value: item.split(",").length, rank: selectedFilesCtypes.rank[index]}));
        if (PreferenceStore.Instance.isHighDimPriority) {
            sortByDim.sort((a, b) => (b.value === a.value ? b.rank - a.rank : b.value - a.value));
        }
        const index = sortByDim.map(item => item.index)[0];

        const ctype = selectedFilesCtypes.ctype[index];
        this.dynamicLayoutName = preferenceStore.existLayoutMapping[ctype] ? preferenceStore.existLayoutMapping[ctype].layoutName : null;

        if (this.dynamicLayoutName === null) {
            console.log("No matched layout. Use Initial Layout.");
            this.dynamicLayoutName = INITIAL_LAYOUT_ITEM;
        } else {
            console.log("matched layout name", this.dynamicLayoutName);
        }
    }

    @flow.bound *saveLayoutMapping(layoutName: string, layoutMappingCtype: string, ctypeName?: string) {
        const appStore = AppStore.Instance;
        const layoutStore = appStore.layoutStore;
        const preferenceStore = PreferenceStore.Instance;

        // set layoutName to INITIAL_LAYOUT_ITEM to delete layout mapping
        if (layoutName === INITIAL_LAYOUT_ITEM) {
            const confirmed = yield appStore.alertStore.showInteractiveAlert(`Do you want to set ${INITIAL_LAYOUT_ITEM} for data type (${layoutMappingCtype})?`);
            if (confirmed) {
                try {
                    yield this.modifyLayoutMapping(preferenceStore.existLayoutMapping[layoutMappingCtype].layoutName, "", layoutMappingCtype);
                    this.dynamicLayoutName = PreferenceStore.Instance.layout;

                    if (PreferenceStore.Instance.dynamicLayoutEnable && layoutStore.layoutExists(this.dynamicLayoutName) && appStore.activeFrame.dynamicLayout.ctype === layoutMappingCtype) {
                        appStore.dialogStore.hideDialog(DialogId.Layout);
                        layoutStore.applyLayout(this.dynamicLayoutName);
                    }
                } catch (err) {
                    console.log(err);
                    AppToaster.show(SuccessToast("layout-grid", `Fail to delete (${layoutMappingCtype}): ${layoutName}.`, DynamicLayoutStore.ToasterTimeout));
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
            Object.keys(preferenceStore.existLayoutMapping).forEach(ctype => {
                layoutMapping[ctype] = preferenceStore.existLayoutMapping[ctype];
            });
        }
        layoutMapping[layoutMappingCtype] = {layoutName: layoutName, ctypeName: ctypeName};

        preferenceStore.setPreference(PreferenceKeys.GLOBAL_DYNAMIC_LAYOUT, layoutMapping);
        if (PreferenceStore.Instance.dynamicLayoutEnable && layoutStore.layoutExists(layoutName) && appStore.activeFrame.dynamicLayout.ctype === layoutMappingCtype) {
            appStore.dialogStore.hideDialog(DialogId.Layout);
            layoutStore.applyLayout(layoutName);
        }
    }

    @flow.bound *modifyLayoutMapping(layoutName: string, newLayoutName: string = "", layoutMappingCtype?: string) {
        const preferenceStore = PreferenceStore.Instance;

        try {
            let layoutMapping = {};
            if (newLayoutName !== "") {
                Object.keys(preferenceStore.existLayoutMapping).forEach(ctype => {
                    layoutMapping[ctype] =
                        preferenceStore.existLayoutMapping[ctype].layoutName === layoutName
                            ? {layoutName: newLayoutName, ctypeName: preferenceStore.existLayoutMapping[ctype].ctypeName}
                            : {layoutName: preferenceStore.existLayoutMapping[ctype].layoutName, ctypeName: preferenceStore.existLayoutMapping[ctype].ctypeName};
                });
            } else if (layoutMappingCtype) {
                Object.keys(preferenceStore.existLayoutMapping).forEach(ctype => {
                    if (ctype !== layoutMappingCtype) {
                        layoutMapping[ctype] = preferenceStore.existLayoutMapping[ctype];
                    }
                });
            }

            preferenceStore.setPreference(PreferenceKeys.GLOBAL_DYNAMIC_LAYOUT, layoutMapping);
        } catch (err) {
            console.log(err);
        }
    }
}
