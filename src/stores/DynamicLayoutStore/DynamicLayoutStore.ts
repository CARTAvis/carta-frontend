import {action, computed, flow, makeObservable, observable} from "mobx";

import {AppToaster, ErrorToast} from "components/Shared";
import {AppStore, PreferenceKeys, PreferenceStore} from "stores";

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
        return Object.keys(preferenceStore.existLayoutMapping).length > 0;
    }

    constructor() {
        makeObservable(this);

        this.dynamicLayoutName = null;
    }

    matchLayoutMapping(selectedFilesCtypes: {ctype: string[]; rank: number[]}) {
        const appStore = AppStore.Instance;
        const preferenceStore = appStore.preferenceStore;

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
        this.dynamicLayoutName = preferenceStore.existLayoutMapping[ctype] ? preferenceStore.existLayoutMapping[ctype] : null;

        if (this.dynamicLayoutName === null) {
            console.log("No matched layout. Use Initial Layout.");
            this.dynamicLayoutName = INITIAL_LAYOUT_ITEM;
        } else {
            console.log("matched layout name", this.dynamicLayoutName);
        }
    }

    @flow.bound *saveLayoutMapping(layoutName: string, layoutMappingCtype: string) {
        const appStore = AppStore.Instance;
        const layoutStore = appStore.layoutStore;
        const preference = appStore.preferenceStore;

        // set layoutName to INITIAL_LAYOUT_ITEM to delete layout mapping
        if (layoutName === INITIAL_LAYOUT_ITEM) {
            const confirmed = yield appStore.alertStore.showInteractiveAlert(`Do you want to set ${INITIAL_LAYOUT_ITEM} for data type (${layoutMappingCtype})?`);
            if (confirmed) {
                try {
                    this.deleteLayoutMapping(layoutMappingCtype);
                    this.dynamicLayoutName = preference.layout;

                    if (preference.dynamicLayoutEnable && layoutStore.layoutExists(this.dynamicLayoutName) && appStore.activeFrame?.dynamicLayout.ctype === layoutMappingCtype) {
                        layoutStore.applyLayout(this.dynamicLayoutName);
                    }
                } catch (err) {
                    console.log(err);
                    AppToaster.show(ErrorToast(`Fail to delete (${layoutMappingCtype}): ${layoutName}.`));
                }
            }
            return;
        }

        // show alert if no other alert is shown
        if (!layoutStore.layoutExists(layoutName) && appStore.alertStore.alertVisible === false) {
            appStore.alertStore.showAlert(`Fail to save (${layoutMappingCtype}): ${layoutName}! No ${layoutName} layout existed.`);
            return;
        }

        try {
            preference.existLayoutMapping[layoutMappingCtype] = layoutName;

            preference.setPreference(PreferenceKeys.LAYOUT_DYNAMIC_LAYOUT, JSON.parse(JSON.stringify(preference.existLayoutMapping)));
            if (PreferenceStore.Instance.dynamicLayoutEnable && layoutStore.layoutExists(layoutName) && appStore.activeFrame?.dynamicLayout.ctype === layoutMappingCtype) {
                layoutStore.applyLayout(layoutName);
            }
        } catch (err) {
            console.log(err);
            AppToaster.show(ErrorToast(`Fail to save (${layoutMappingCtype}): ${layoutName}.`));
        }
    }

    @action modifyLayoutMapping(layoutName: string, newLayoutName: string) {
        const preference = PreferenceStore.Instance;

        try {
            Object.keys(preference.existLayoutMapping).forEach(ctype => {
                if (preference.existLayoutMapping[ctype] === layoutName) {
                    preference.existLayoutMapping[ctype] = newLayoutName;
                }
            });

            preference.setPreference(PreferenceKeys.LAYOUT_DYNAMIC_LAYOUT, JSON.parse(JSON.stringify(preference.existLayoutMapping)));
        } catch (err) {
            console.log(err);
            AppToaster.show(ErrorToast(`Fail to modify the layout mapping with ${layoutName} to ${newLayoutName}.`));
        }
    }

    @action deleteLayoutMappingByLayoutName(layoutName: string) {
        const preference = PreferenceStore.Instance;

        try {
            Object.keys(preference.existLayoutMapping).forEach(ctype => {
                if (preference.existLayoutMapping[ctype] === layoutName) {
                    delete preference.existLayoutMapping[ctype];
                }
            });

            preference.setPreference(PreferenceKeys.LAYOUT_DYNAMIC_LAYOUT, JSON.parse(JSON.stringify(preference.existLayoutMapping)));
        } catch (err) {
            console.log(err);
            AppToaster.show(ErrorToast(`Fail to delete the layout mapping with layout name: ${layoutName}.`));
        }
    }

    @action deleteLayoutMapping(layoutMappingCtype: string) {
        const preference = PreferenceStore.Instance;

        try {
            delete preference.existLayoutMapping[layoutMappingCtype];
            preference.setPreference(PreferenceKeys.LAYOUT_DYNAMIC_LAYOUT, JSON.parse(JSON.stringify(preference.existLayoutMapping)));
        } catch (err) {
            console.log(err);
            AppToaster.show(ErrorToast(`Fail to delete the layout mapping: ${layoutMappingCtype}.`));
        }
    }
}
