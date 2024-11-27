import * as GoldenLayout from "golden-layout";
import {action, autorun, computed, flow, makeObservable, observable} from "mobx";

import {AppToaster, SuccessToast} from "components/Shared";
import {LayoutConfig, PresetLayout} from "models";
import {ApiService} from "services";
import {AlertStore, AppStore, DialogId, PreferenceStore} from "stores";

const MAX_LAYOUT = 10;
export const LAYOUT_MAP_NAME = "LayoutMap";

export enum LayoutDialogMode {
    Hidden,
    Save,
    Rename,
    DynamicLayout
}

export class LayoutStore {
    private static staticInstance: LayoutStore;

    static get Instance() {
        if (!LayoutStore.staticInstance) {
            LayoutStore.staticInstance = new LayoutStore();
        }
        return LayoutStore.staticInstance;
    }

    public static readonly ToasterTimeout = 1500;
    private layoutNameToBeSaved: string;

    public static layoutMap = "LayoutMap";

    // self-defined structure: {layoutName: config, layoutName: config, ...}
    @observable dockedLayout: GoldenLayout | null;
    @observable currentLayoutName: string;
    @observable private layouts: any;
    @observable supportsServer: boolean;
    @observable oldLayoutName: string | undefined;
    @observable layoutDialogMode: LayoutDialogMode | undefined;

    // Data type associated layout
    @observable isDynamicLayout: boolean;
    @observable isHighDimPriority: boolean;
    @observable existLayoutMap: any | null;
    @observable dynamicLayoutName: string | null;
    @observable currentLayoutMapCtype: any; // type needs to be changed
    @observable currentLayoutMapIndex: number | null;
    @observable selectedLayoutMapIndex: number | null;

    @computed get dialogShowedCtype(): string {
        const index = this.selectedLayoutMapIndex;
        let output = "";
        if (this.existLayoutMap && this.existLayoutMap.layoutMap) {
            output = index === null ? (this.currentLayoutMapCtype.length > 0 ? this.currentLayoutMapCtype : this.existLayoutMap.layoutMap[0].ctype) : this.existLayoutMap.layoutMap[index].ctype;
        }
        return output;
    }

    @computed get dialogShowedLayoutName(): string {
        const index = this.selectedLayoutMapIndex;
        let output = "";
        if (this.existLayoutMap && this.existLayoutMap.layoutMap) {
            output = index === null ? (this.currentLayoutMapCtype.length > 0 ? this.currentLayoutName : this.existLayoutMap.layoutMap[0].layoutName) : this.existLayoutMap.layoutMap[index].layoutName;
        }
        return output;
    }

    @computed get dialogShowedCtypeList(): string[] {
        let output: string[] = [this.currentLayoutMapCtype ?? []];
        if (this.existLayoutMap && this.existLayoutMap.layoutMap) {
            output =
                this.currentLayoutMapIndex === null && this.currentLayoutMapCtype.length > 0
                    ? [this.currentLayoutMapCtype, ...this.existLayoutMap.layoutMap.map(layout => layout.ctype)]
                    : this.existLayoutMap.layoutMap.map(layout => layout.ctype);
        }
        return output;
    }

    @computed get isSave(): boolean {
        return !this.oldLayoutName;
    }

    @computed get priorityFileIndexes() {
        const fileBrowserStore = AppStore.Instance.fileBrowserStore;

        let sortWithIndex = fileBrowserStore.selectedFilesHeaderInfo.dim.map((value, index) => ({index: index, value: value}));
        if (this.isHighDimPriority) {
            sortWithIndex.sort((a, b) => b.value - a.value);
        }
        return sortWithIndex.map(item => item.index);
    }

    private constructor() {
        makeObservable<LayoutStore, "layouts">(this);
        this.dockedLayout = null;
        this.layouts = {};
        this.supportsServer = false;
        this.oldLayoutName = ""; // for rename
        this.initLayoutsFromPresets();

        this.dynamicLayoutName = null;
        this.currentLayoutMapCtype = [];
        this.currentLayoutMapIndex = null;
        this.layoutDialogMode = undefined;
        this.existLayoutMap = null;

        autorun(() => {
            this.isDynamicLayout = PreferenceStore.Instance.isDynamicLayout;
            this.isHighDimPriority = PreferenceStore.Instance.isHighDimPriority;
            this.selectedLayoutMapIndex = this.currentLayoutMapIndex;
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

    @action setLayoutDialogMode = (mode: LayoutDialogMode) => {
        this.layoutDialogMode = mode;
    };

    @action showLayoutDialog = (mode: LayoutDialogMode, oldLayoutName?: string) => {
        this.setLayoutDialogMode(mode);
        if (mode === LayoutDialogMode.Rename) {
            this.setOldLayoutName(oldLayoutName);
        }
        AppStore.Instance.dialogStore.showDialog(DialogId.Layout);
    };

    public layoutExists = (layoutName: string): boolean => {
        return layoutName.length > 0 && this.allLayoutNames.includes(layoutName);
    };

    public setLayoutToBeSaved = (layoutName: string) => {
        this.layoutNameToBeSaved = layoutName ? layoutName : "Empty";
    };

    public setOldLayoutName = (oldLayoutName: string | undefined) => {
        this.oldLayoutName = oldLayoutName;
    };

    @flow.bound *fetchLayouts() {
        try {
            const userLayouts = yield ApiService.Instance.getLayouts();
            for (const name of Object.keys(userLayouts)) {
                if (name) {
                    this.layouts[name] = userLayouts[name];
                }
            }
        } catch (err) {
            AlertStore.Instance.showAlert("Loading user-defined layout failed!");
            console.log(err);
        }
    }

    @flow.bound *fetchLayoutMap() {
        try {
            this.existLayoutMap = yield ApiService.Instance.getLayoutMaps();
        } catch (err) {
            AlertStore.Instance.showAlert("Loading layout map failed!");
            console.log(err);
        }
    }

    private initLayoutsFromPresets = () => {
        PresetLayout.PRESETS.forEach(presetName => {
            const presetConfig = LayoutConfig.GetPresetConfig(presetName);
            if (presetConfig) {
                this.layouts[presetName] = presetConfig;
            }
        });
    };

    @computed get allLayoutNames(): string[] {
        return this.layouts ? Object.keys(this.layouts) : [];
    }

    @computed get userLayoutNames(): string[] {
        return this.layouts ? Object.keys(this.layouts).filter(layoutName => !PresetLayout.isPreset(layoutName)) : [];
    }

    @computed get orderedLayoutNames(): string[] {
        let orderedLayouts = [...PresetLayout.PRESETS];
        return this.userLayoutNames?.length ? orderedLayouts.concat(this.userLayoutNames) : orderedLayouts;
    }

    @computed get numSavedLayouts(): number {
        return this.userLayoutNames.length;
    }

    @action applyLayout = (layoutName: string): boolean => {
        if (!layoutName || !this.layoutExists(layoutName)) {
            AlertStore.Instance.showAlert(`Applying layout failed! Layout ${layoutName} not found.`);
            return false;
        }

        const config = this.layouts[layoutName];
        const appStore = AppStore.Instance;
        // destroy old layout & clear floating widgets
        if (this.dockedLayout) {
            appStore.widgetsStore.removeFloatingWidgets();
            this.dockedLayout.destroy();
        }

        // generate docked config & collect docked components
        let dockedConfig = {
            type: config.docked.type,
            content: []
        };
        let dockedComponentConfigs = [];
        LayoutConfig.CreateConfigToApply(dockedConfig.content, config.docked.content, dockedComponentConfigs);
        // use component configs to init widget stores, IDs in componentConfigs will be updated
        appStore.widgetsStore.initWidgets(dockedComponentConfigs, config.floating);
        // generate new layout config & apply
        // Does this work?
        // @ts-ignore
        this.dockedLayout = new GoldenLayout(
            {
                settings: {
                    showPopoutIcon: false,
                    showCloseIcon: false
                },
                dimensions: {
                    minItemWidth: 250,
                    minItemHeight: 200,
                    dragProxyWidth: 600,
                    dragProxyHeight: 270
                },
                content: [dockedConfig]
            },
            appStore.getAppContainer()
        );
        if (this.dockedLayout) {
            appStore.widgetsStore.initLayoutWithWidgets(this.dockedLayout);
            this.dockedLayout.init();
        }
        this.currentLayoutName = layoutName;

        return true;
    };

    @flow.bound *saveLayout() {
        const appStore = AppStore.Instance;
        if (!this.layouts || !this.layoutNameToBeSaved || !this.dockedLayout) {
            appStore.alertStore.showAlert("Save layout failed! Empty layouts or name.");
            return;
        }

        if (PresetLayout.isPreset(this.layoutNameToBeSaved)) {
            appStore.alertStore.showAlert("Layout name cannot be the same as system presets.");
            return;
        }

        if (!this.layoutExists(this.layoutNameToBeSaved) && this.numSavedLayouts >= MAX_LAYOUT) {
            appStore.alertStore.showAlert(`Maximum user-defined layout quota exceeded! (${MAX_LAYOUT} layouts)`);
            return;
        }

        const currentConfig = this.dockedLayout.toConfig();
        if (!currentConfig || !currentConfig.content || currentConfig.content.length <= 0) {
            appStore.alertStore.showAlert("Saving layout failed! Something is wrong with current layout.");
            return;
        }

        const configToSave = LayoutConfig.CreateConfigToSave(appStore, currentConfig.content[0]);
        if (!configToSave) {
            appStore.alertStore.showAlert("Saving layout failed! Creat layout configuration for saving failed.");
            return;
        }

        // save layout to layouts[] & server/local storage
        this.layouts[this.layoutNameToBeSaved] = configToSave;
        if (!PresetLayout.isPreset(this.layoutNameToBeSaved)) {
            try {
                const success = yield appStore.apiService.setLayout(this.layoutNameToBeSaved, configToSave);
                if (success) {
                    this.handleSaveResult(success);
                }
            } catch (err) {
                console.log(err);
                this.handleSaveResult(false);
            }
        }
    }

    private handleSaveResult = (success: boolean) => {
        if (success) {
            AppToaster.show(SuccessToast("layout-grid", `Layout ${this.layoutNameToBeSaved} saved successfully.`, LayoutStore.ToasterTimeout));
            this.currentLayoutName = this.layoutNameToBeSaved;
        } else {
            delete this.layouts[this.layoutNameToBeSaved];
            AlertStore.Instance.showAlert("Saving user-defined layout failed! ");
        }
    };

    @flow.bound *saveLayoutMap(layoutName: string, layoutMapIndex: number) {
        const appStore = AppStore.Instance;
        const layoutMapCtype = layoutMapIndex !== null ? this.existLayoutMap.layoutMap[layoutMapIndex].ctype : this.currentLayoutMapCtype;

        if (!layoutName || layoutMapCtype.length === 0) {
            appStore.alertStore.showAlert("Save layout map failed! Empty layouts or name.");
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
                        if (this.isDynamicLayout && layoutMapIndex !== null && this.layoutExists(this.dynamicLayoutName) && this.currentLayoutMapIndex === layoutMapIndex) {
                            this.applyLayout(this.dynamicLayoutName);
                        }
                    }
                }
            } catch (err) {
                console.log(err);
                AppToaster.show(SuccessToast("layout-grid", `Data type (${layoutMapCtype}) fails to associated with layout ${layoutName}`, LayoutStore.ToasterTimeout));
            }
        }
    }

    @flow.bound *renameLayout(oldName: string, newName: string) {
        const appStore = AppStore.Instance;

        if (!this.layouts || !newName || !this.dockedLayout) {
            appStore.alertStore.showAlert("Save layout failed! Empty layouts or name.");
            return;
        }

        if (PresetLayout.isPreset(newName)) {
            appStore.alertStore.showAlert("Layout name cannot be the same as system presets.");
            return;
        }

        if (this.layoutExists(newName)) {
            appStore.alertStore.showAlert("Layout name already exists.");
            return;
        }

        if (!oldName || !this.layoutExists(oldName)) {
            appStore.alertStore.showAlert(`Cannot rename layout ${oldName}! It does not exist.`);
            return;
        }

        appStore.dialogStore.hideDialog(DialogId.Layout);

        // save layout to layouts[] & server/local storage
        const configToSave = this.layouts[oldName];
        this.layouts[newName] = configToSave;
        if (!PresetLayout.isPreset(this.layoutNameToBeSaved)) {
            try {
                const success = yield appStore.apiService.setLayout(newName, configToSave);

                if (success) {
                    const success = yield appStore.apiService.clearLayout(oldName);
                    if (success) {
                        delete this.layouts[oldName];
                    }
                    this.handleRenameResult(oldName, newName, success);
                    yield this.renameLayoutMap(oldName, newName);
                }
            } catch (err) {
                console.log(err);
                this.handleRenameResult(oldName, newName, false);
            }
        }
    }

    private handleRenameResult = (oldName: string, newName: string, success: boolean) => {
        if (success) {
            AppToaster.show(SuccessToast("layout-grid", `Layout ${oldName} renamed to ${newName} successfully.`, LayoutStore.ToasterTimeout));
            if (oldName === this.currentLayoutName) {
                this.currentLayoutName = newName;
            }
        } else {
            AlertStore.Instance.showAlert("Renaming user-defined layout failed!");
        }
    };

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

    @flow.bound *deleteLayout(layoutName: string) {
        const appStore = AppStore.Instance;
        if (!layoutName || !this.layoutExists(layoutName)) {
            appStore.alertStore.showAlert(`Cannot delete layout ${layoutName}! It does not exist.`);
            return;
        }

        try {
            const success = yield appStore.apiService.clearLayout(layoutName);
            yield this.deleteLayoutMap(layoutName);
            if (success) {
                delete this.layouts[layoutName];
            }
            this.handleDeleteResult(layoutName, success);
        } catch (err) {
            console.log(err);
            this.handleDeleteResult(layoutName, false);
        }
    }

    private handleDeleteResult = (layoutName: string, success: boolean) => {
        if (success) {
            AppToaster.show(SuccessToast("layout-grid", `Layout ${layoutName} deleted successfully.`, LayoutStore.ToasterTimeout));
            if (layoutName === this.currentLayoutName) {
                this.currentLayoutName = "";
            }
        } else {
            AlertStore.Instance.showAlert("Deleting user-defined layout failed!");
        }
    };

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
