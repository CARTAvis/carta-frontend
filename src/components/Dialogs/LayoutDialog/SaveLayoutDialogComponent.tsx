import * as React from "react";
import {AnchorButton, Classes, Collapse, DialogProps, FormGroup, HTMLSelect, HTMLTable, InputGroup, Intent, Position, Switch, Tooltip} from "@blueprintjs/core";
import classNames from "classnames";
import {computed, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";

import {DraggableDialogComponent} from "components/Dialogs";
import {DetermineCtypeAbbr, PresetLayout} from "models";
import {AppStore, DialogId, HelpType, INITIAL_LAYOUT_ITEM, LayoutDialogMode, PreferenceStore} from "stores";

import "./SaveLayoutDialogComponent.scss";

const KEYCODE_ENTER = 13;

@observer
export class SaveLayoutDialogComponent extends React.Component {
    private static readonly DefaultWidth = 400;
    private static readonly DefaultHeight = 185;
    private static readonly MinWidth = 400;
    private static readonly MinHeight = 185;

    @observable private layoutName: string = "";
    @observable private saveDynamicLayoutEnable: boolean = false;

    constructor(props: any) {
        super(props);
        makeObservable(this);
    }

    private titleMap = new Map<LayoutDialogMode, string>([
        [LayoutDialogMode.Save, "Save Layout"],
        [LayoutDialogMode.Rename, "Rename Layout"],
        [LayoutDialogMode.DynamicLayout, "Dynamic Layout Map"]
    ]);

    private handleInput = (ev: React.FormEvent<HTMLInputElement>) => {
        this.layoutName = ev.currentTarget.value;
    };

    private clearInput = () => {
        this.layoutName = "";
    };

    private handleKeyDown = ev => {
        if (ev.keyCode === KEYCODE_ENTER && !this.isEmpty) {
            AppStore.Instance.layoutStore.isSave ? this.saveLayout() : this.renameLayout();
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
        await appStore.layoutStore.renameLayout(appStore.layoutStore.oldLayoutName, this.layoutName.trim());
        this.clearInput();
    };

    private toggleSaveDynamicLayoutEnable() {
        this.saveDynamicLayoutEnable = !this.saveDynamicLayoutEnable;
    }

    @computed get isEmpty(): boolean {
        return !this.layoutName?.trim();
    }

    @computed get validName(): boolean {
        return this.layoutName.match(/^[^~`!*()\-+=[.'?<>/|\\:;&]+$/)?.length > 0;
    }

    @computed get enableDynamicLayoutSave(): boolean {
        const dyLayoutStore = AppStore.Instance.dynamicLayoutStore;
        return dyLayoutStore.dynamicLayoutCtype && !!AppStore.Instance.activeFrame;
    }

    private renderLayoutDialogBody = (mode: LayoutDialogMode) => {
        const layoutStore = AppStore.Instance.layoutStore;

        switch (mode) {
            case LayoutDialogMode.Save:
                return (
                    <div className={Classes.DIALOG_BODY}>
                        <FormGroup inline={true} label="Save current layout as:">
                            <Tooltip isOpen={!this.isEmpty && !this.validName} position={Position.BOTTOM_LEFT} content={"Layout name should not contain ~, `, !, *, (, ), -, +, =, [, ., ', ?, <, >, /, |, \\, :, ; or &"}>
                                <InputGroup className="layout-name-input" placeholder="Enter layout name" value={this.layoutName} autoFocus={true} onChange={this.handleInput} onKeyDown={this.handleKeyDown} />
                            </Tooltip>
                        </FormGroup>
                    </div>
                );
            case LayoutDialogMode.Rename:
                return (
                    <div className={Classes.DIALOG_BODY}>
                        <FormGroup inline={true} label={`Rename ${layoutStore.oldLayoutName} to:`}>
                            <Tooltip isOpen={!this.isEmpty && !this.validName} position={Position.BOTTOM_LEFT} content={"Layout name should not contain ~, `, !, *, (, ), -, +, =, [, ., ', ?, <, >, /, |, \\, :, ; or &"}>
                                <InputGroup className="layout-name-input" placeholder="Enter layout name" value={this.layoutName} autoFocus={true} onChange={this.handleInput} onKeyDown={this.handleKeyDown} />
                            </Tooltip>
                        </FormGroup>
                    </div>
                );
            default:
                return "";
        }
    };

    private renderLayoutDialogFooter = (mode: LayoutDialogMode) => {
        const activeFrame = AppStore.Instance.activeFrame;

        switch (mode) {
            case LayoutDialogMode.Save:
                return (
                    <div className={Classes.DIALOG_FOOTER}>
                        <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                            <Collapse isOpen={PreferenceStore.Instance.dynamicLayoutEnable}>
                                <Tooltip content={`Apply layout when images with type (${activeFrame?.dynamicLayoutCtype}) are loaded`} disabled={!activeFrame}>
                                    <FormGroup inline={true} disabled={!activeFrame} label="Save as dynamic layout">
                                        <Switch checked={this.saveDynamicLayoutEnable} disabled={!activeFrame} onChange={ev => this.toggleSaveDynamicLayoutEnable()} />
                                    </FormGroup>
                                </Tooltip>
                            </Collapse>
                            <Tooltip content="Layout name cannot be empty!" disabled={!this.isEmpty}>
                                <AnchorButton intent={Intent.PRIMARY} onClick={this.saveLayout} text={"Save"} disabled={this.isEmpty || !this.validName} />
                            </Tooltip>
                        </div>
                    </div>
                );
            case LayoutDialogMode.Rename:
                return (
                    <div className={Classes.DIALOG_FOOTER}>
                        <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                            <Tooltip content="Layout name cannot be empty!" disabled={!this.isEmpty}>
                                <AnchorButton intent={Intent.PRIMARY} onClick={this.renameLayout} text={"Rename"} disabled={this.isEmpty || !this.validName} />
                            </Tooltip>
                        </div>
                    </div>
                );
            default:
                return "";
        }
    };

    render() {
        const appStore = AppStore.Instance;
        const className = classNames("preference-dialog", {[Classes.DARK]: appStore.darkTheme});

        const dialogProps: DialogProps = {
            icon: "layout-grid",
            backdropClassName: "minimal-dialog-backdrop",
            className: className,
            canOutsideClickClose: false,
            lazy: true,
            isOpen: appStore.dialogStore.dialogVisible.get(DialogId.Layout),
            title: this.titleMap.get(appStore.layoutStore.layoutDialogMode)
        };

        if (appStore.layoutStore.layoutDialogMode === LayoutDialogMode.DynamicLayout) {
            return (
                <DraggableDialogComponent
                    dialogProps={dialogProps}
                    helpType={HelpType.SAVE_LAYOUT}
                    defaultWidth={SaveLayoutDialogComponent.DefaultWidth}
                    defaultHeight={SaveLayoutDialogComponent.DefaultHeight}
                    minWidth={SaveLayoutDialogComponent.MinWidth}
                    minHeight={SaveLayoutDialogComponent.MinHeight}
                    enableResizing={true}
                    dialogId={DialogId.Layout}
                >
                    {LayoutMappingComponent()}
                </DraggableDialogComponent>
            );
        } else {
            const dialogBody = this.renderLayoutDialogBody(appStore.layoutStore.layoutDialogMode);
            const dialogFooter = this.renderLayoutDialogFooter(appStore.layoutStore.layoutDialogMode);

            return (
                <DraggableDialogComponent
                    dialogProps={dialogProps}
                    helpType={HelpType.SAVE_LAYOUT}
                    defaultWidth={SaveLayoutDialogComponent.DefaultWidth}
                    defaultHeight={SaveLayoutDialogComponent.DefaultHeight}
                    minWidth={SaveLayoutDialogComponent.MinWidth}
                    minHeight={SaveLayoutDialogComponent.MinHeight}
                    enableResizing={true}
                    dialogId={DialogId.Layout}
                >
                    {dialogBody}
                    {dialogFooter}
                </DraggableDialogComponent>
            );
        }
    }
}

export const LayoutMappingComponent = () => {
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
                    return DetermineCtypeAbbr(ctype);
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
