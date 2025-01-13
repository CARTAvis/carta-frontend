import * as React from "react";
import {AnchorButton, ButtonGroup, Classes, Collapse, DialogProps, FormGroup, HTMLSelect, HTMLTable, InputGroup, Intent, Position, Switch, Tab, Tabs, Tooltip} from "@blueprintjs/core";
import classNames from "classnames";
import {computed, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";

import {DraggableDialogComponent} from "components/Dialogs";
import {ScrollShadow} from "components/Shared";
import {DetermineCtypeName, PresetLayout} from "models";
import {AppStore, DialogId, HelpType, INITIAL_LAYOUT_ITEM, LayoutDialogMode, PreferenceKeys, PreferenceStore} from "stores";

import "./LayoutDialogComponent.scss";

const KEYCODE_ENTER = 13;
@observer
export class LayoutDialogComponent extends React.Component {
    private static readonly DefaultWidth = 400;
    private static readonly DefaultHeight = 600;
    private static readonly MinWidth = 400;
    private static readonly MinHeight = 600;

    @observable private editingLayoutName: string = "";
    @observable private layoutName: string = "";
    @observable private layoutRename: string = "";
    @observable private saveDynamicLayoutEnable: boolean = false;
    @observable private isRename: boolean = false;

    @computed get isEmpty(): boolean {
        return this.isRename ? !this.layoutRename?.trim() : !this.layoutName?.trim();
    }

    @computed get validName(): boolean {
        const name = this.isRename ? this.layoutRename : this.layoutName;
        return name.match(/^[^~`!*()\-+=[.'?<>/|\\:;&]+$/)?.length > 0;
    }

    constructor(props: any) {
        super(props);
        makeObservable(this);
    }

    private handleInput = (ev: React.FormEvent<HTMLInputElement>) => {
        this.isRename ? this.layoutRename = ev.currentTarget.value : this.layoutName = ev.currentTarget.value;
    };

    private clearInput = () => {
        this.layoutName = "";
        this.layoutRename = "";
    };

    private handleKeyDown = ev => {
        if (ev.keyCode === KEYCODE_ENTER && !this.isEmpty) {
            this.isRename ? this.renameLayout() : this.saveLayout();
        }
    };

    private saveLayout = async () => {
        const appStore = AppStore.Instance;
        const dyLayoutStore = appStore.dynamicLayoutStore;

        appStore.dialogStore.hideDialog(DialogId.Layout);
        appStore.layoutStore.setLayoutToBeSaved(this.layoutName.trim());
        if (appStore.layoutStore.layoutExists(this.layoutName)) {
            if (PresetLayout.isPreset(this.layoutName)) {
                appStore.alertStore.showAlert("Layout name cannot be the same as system presets.");
            } else {
                const confirmed = await appStore.alertStore.showInteractiveAlert(`Are you sure to overwrite the existing layout ${this.layoutName}?`);
                if (confirmed) {
                    await appStore.layoutStore.saveLayout();
                    if (this.saveDynamicLayoutEnable) {
                        await dyLayoutStore.saveLayoutMapping(this.layoutName, appStore.activeFrame.dynamicLayoutCtype);
                    }
                }
            }
        } else {
            await appStore.layoutStore.saveLayout();
            if (this.saveDynamicLayoutEnable) {
                await dyLayoutStore.saveLayoutMapping(this.layoutName, appStore.activeFrame.dynamicLayoutCtype);
            }
        }
        this.clearInput();
    };

    private renameLayout = async () => {
        const appStore = AppStore.Instance;
        await appStore.layoutStore.renameLayout(this.editingLayoutName, this.layoutRename.trim());
        this.clearInput();
        this.isRename = false;
    };

    private toggleSaveDynamicLayoutEnable() {
        this.saveDynamicLayoutEnable = !this.saveDynamicLayoutEnable;
    }

    private layoutComponent = () => {
        const layoutStore = AppStore.Instance.layoutStore;

        const layoutRenameInput = (layoutName: string) => {
            return (
            <Tooltip isOpen={!this.isEmpty && !this.validName} position={Position.BOTTOM_LEFT} content={"Layout name should not contain ~, `, !, *, (, ), -, +, =, [, ., ', ?, <, >, /, |, \\, :, ; or &"}>
                <InputGroup className="layout-name-input" placeholder={layoutName} value={this.layoutRename} autoFocus={true} onChange={this.handleInput} onKeyDown={this.handleKeyDown} />
                </Tooltip>
            )
        };

        const saveLayoutRow = () => {
            const activeFrame = AppStore.Instance.activeFrame;

            return (
                <tr>
                    <td>
                        <Tooltip isOpen={!this.isEmpty && !this.validName} position={Position.BOTTOM_LEFT} content={"Layout name should not contain ~, `, !, *, (, ), -, +, =, [, ., ', ?, <, >, /, |, \\, :, ; or &"}>
                            <InputGroup className="layout-name-input" placeholder="New layout name" value={this.layoutName} autoFocus={true} onChange={this.handleInput} onKeyDown={this.handleKeyDown} />
                        </Tooltip>
                    </td>
                    <td className="save-layout-row">
                        <Tooltip content="Layout name cannot be empty!" disabled={!this.isEmpty}>
                            <AnchorButton intent={Intent.PRIMARY} onClick={this.saveLayout} text={"Save"} disabled={this.isEmpty || !this.validName} />
                        </Tooltip>
                        <Collapse isOpen={PreferenceStore.Instance.dynamicLayoutEnable}>
                            <Tooltip content={`Apply layout when images with type (${activeFrame?.dynamicLayoutCtype}) are loaded`} disabled={!activeFrame}>
                                <FormGroup inline={true} disabled={!activeFrame || this.isEmpty}>
                                    <Switch innerLabel="Dyn"checked={this.saveDynamicLayoutEnable} disabled={!activeFrame || this.isEmpty} onChange={() => this.toggleSaveDynamicLayoutEnable()} />
                                </FormGroup>
                            </Tooltip>
                        </Collapse>
                    </td>
                </tr>
            );
        };

        const rows = layoutStore.orderedLayoutNames.map((layoutName, index) => {
            const appStore = AppStore.Instance;
            return (
                <tr key={index}>
                    <td>{this.editingLayoutName === layoutName? layoutRenameInput(layoutName) : layoutName}</td>
                    <td>
                    <ButtonGroup>
                        <AnchorButton onClick={() => layoutStore.applyLayout(layoutName)}>Apply</AnchorButton>
                            <AnchorButton icon="edit" onClick={() => {
                                this.editingLayoutName = this.editingLayoutName === layoutName ? "" : layoutName;
                                this.isRename = true;
                            }} disabled={PresetLayout.PRESETS.includes(layoutName)} active={this.editingLayoutName === layoutName} />
                        <AnchorButton icon="trash" onClick={() => {
                            layoutStore.deleteLayout(layoutName)
                            if (layoutName === appStore.preferenceStore.layout) {
                                appStore.preferenceStore.setPreference(PreferenceKeys.GLOBAL_LAYOUT, PresetLayout.DEFAULT);
                            }
                            }} disabled={PresetLayout.PRESETS.includes(layoutName)} />
                    </ButtonGroup>
                    </td>
                </tr>
            );
        });

        return (
            <HTMLTable data-testid="layout-table">
                {[saveLayoutRow(), ...rows]}
            </HTMLTable>
        );
    };

    private LayoutMappingComponent = () => {
        const layoutStore = AppStore.Instance.layoutStore;
        const dyLayoutStore = AppStore.Instance.dynamicLayoutStore;
        const activeFrame = AppStore.Instance.activeFrame;

        let ctypeList: string[] | any[] = [activeFrame?.dynamicLayoutCtype ?? ""];
        let layoutNameList: string[] | any[] = [activeFrame?.dynamicLayoutName ?? ""];

        if (dyLayoutStore.isMappingExisted) {
            const ctypes = Object.keys(dyLayoutStore.existLayoutMapping);
            const names = Object.values(dyLayoutStore.existLayoutMapping);
            ctypeList = activeFrame ? (ctypes.includes(activeFrame.dynamicLayoutCtype) ? ctypes : [activeFrame.dynamicLayoutCtype, ...ctypes]) : ctypes;
            layoutNameList = activeFrame ? (ctypes.includes(activeFrame.dynamicLayoutCtype) ? names : [activeFrame.dynamicLayoutName, ...names]) : names;
        }

        let rows = [];
        if (ctypeList[0] !== "") {
            ctypeList.forEach((layoutCtypes, index) => {
                let ctypeDescription = layoutCtypes
                    .split(",")
                    .map((ctype, idx) => {
                        return DetermineCtypeName(ctype);
                    })
                    .join(",");

                rows.push(
                    <tr key={index}>
                        <td>
                            <Tooltip position="bottom" content={`(${ctypeDescription.replaceAll(",", ", ")})`}>
                                <FormGroup>
                                    (
                                    {layoutCtypes
                                        .replace(/\s+/g, "")
                                        .split(",")
                                        .map((ctype, idx) => {
                                            return idx !== 0 ? ", " + ctype : ctype;
                                        })}
                                    )
                                </FormGroup>
                            </Tooltip>
                        </td>
                        <td>
                            <HTMLSelect value={layoutNameList[index]} onChange={ev => dyLayoutStore.saveLayoutMapping(ev.currentTarget.value, layoutCtypes)}>
                                {[INITIAL_LAYOUT_ITEM, ...layoutStore.orderedLayoutNames].map(layout => (
                                    <option key={layout} value={layout}>
                                        {layout}
                                    </option>
                                ))}
                            </HTMLSelect>
                        </td>
                        <td>
                            <AnchorButton icon="trash" onClick={() => dyLayoutStore.saveLayoutMapping(INITIAL_LAYOUT_ITEM, layoutCtypes)} />
                        </td>
                    </tr>
                );
            });
        }

        return (
            <HTMLTable data-testid="dynamic-layout-table">
                <thead>
                    <tr>
                        <th>Data type</th>
                        <th>Layout</th>
                    </tr>
                </thead>
                <tbody>{rows}</tbody>
            </HTMLTable>
        );
    };

    private showDialog = () => {
        const appStore = AppStore.Instance;
        const preferenceStore = appStore.preferenceStore;
        if (!preferenceStore.dynamicLayoutEnable) {
            return (
                <ScrollShadow>{this.layoutComponent()}</ScrollShadow>
            )
        } else {
            return (
                <Tabs>
                    <Tab id={LayoutDialogMode.Layout} title="Layout" panel={<ScrollShadow>{this.layoutComponent()}</ScrollShadow>} />
                    <Tab id={LayoutDialogMode.DynamicLayout} title="Dynamic layout" panel={<ScrollShadow>{this.LayoutMappingComponent()}</ScrollShadow>} />
                </Tabs>
            )
        }
    }

    render() {
        const appStore = AppStore.Instance;
        const className = classNames("layout-dialog");

        const dialogProps: DialogProps = {
            icon: "page-layout",
            backdropClassName: "minimal-dialog-backdrop",
            className: className,
            canOutsideClickClose: false,
            lazy: true,
            isOpen: appStore.dialogStore.dialogVisible.get(DialogId.LayoutDialog),
            title: "Layout"
        };

        return (
            <DraggableDialogComponent
                dialogProps={dialogProps}
                helpType={HelpType.SAVE_LAYOUT}
                defaultWidth={LayoutDialogComponent.DefaultWidth}
                defaultHeight={LayoutDialogComponent.DefaultHeight}
                minWidth={LayoutDialogComponent.MinWidth}
                minHeight={LayoutDialogComponent.MinHeight}
                enableResizing={true}
                dialogId={DialogId.LayoutDialog}
            >
                <div className={Classes.DIALOG_BODY}>
                    {this.showDialog()}
                </div>
            </DraggableDialogComponent>
        );
    }
}
