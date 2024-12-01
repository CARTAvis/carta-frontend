import * as React from "react";
import {AnchorButton, Classes, DialogProps, FormGroup, HTMLSelect, HTMLTable, InputGroup, Intent, Position, Tooltip} from "@blueprintjs/core";
import classNames from "classnames";
import {computed, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";

import {DraggableDialogComponent} from "components/Dialogs";
import {determineCtypeName, PresetLayout} from "models";
import {AppStore, DialogId, HelpType, LayoutDialogMode} from "stores";

import "./SaveLayoutDialogComponent.scss";

const KEYCODE_ENTER = 13;

@observer
export class SaveLayoutDialogComponent extends React.Component {
    private static readonly DefaultWidth = 400;
    private static readonly DefaultHeight = 185;
    private static readonly MinWidth = 300;
    private static readonly MinHeight = 150;

    @observable private layoutName: string = "";

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

        appStore.dialogStore.hideDialog(DialogId.Layout);
        appStore.layoutStore.setLayoutToBeSaved(this.layoutName.trim());
        if (appStore.layoutStore.layoutExists(this.layoutName)) {
            if (PresetLayout.isPreset(this.layoutName)) {
                appStore.alertStore.showAlert("Layout name cannot be the same as system presets.");
            } else {
                const confirmed = await appStore.alertStore.showInteractiveAlert(`Are you sure to overwrite the existing layout ${this.layoutName}?`);
                if (confirmed) {
                    await appStore.layoutStore.saveLayout();
                }
            }
        } else {
            await appStore.layoutStore.saveLayout();
        }
        this.clearInput();
    };

    private renameLayout = async () => {
        const appStore = AppStore.Instance;
        await appStore.layoutStore.renameLayout(appStore.layoutStore.oldLayoutName, this.layoutName.trim());
        this.clearInput();
    };

    private handleSaveLayoutMap = async () => {
        // keep layoutName before it is cleared in saveLayout()
        const layoutName = this.layoutName.trim();

        await this.saveLayout();

        const dynamicLayoutStore = AppStore.Instance.dynamicLayoutStore;
        await dynamicLayoutStore.saveLayoutMap(layoutName, dynamicLayoutStore.currentLayoutMapIndex);
    };

    @computed get isEmpty(): boolean {
        return !this.layoutName?.trim();
    }

    @computed get validName(): boolean {
        return this.layoutName.match(/^[^~`!*()\-+=[.'?<>/|\\:;&]+$/)?.length > 0;
    }

    @computed get enableDynamicLayoutSave(): boolean {
        const dynamicLayoutStore = AppStore.Instance.dynamicLayoutStore;
        return dynamicLayoutStore.currentLayoutMapCtype.length > 0 && !!AppStore.Instance.activeFrame;
    }

    private renderLayoutDialogBody = (mode: LayoutDialogMode) => {
        const layoutStore = AppStore.Instance.layoutStore;
        // const dynamicLayoutStore = AppStore.Instance.dynamicLayoutStore;

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
            // case LayoutDialogMode.DynamicLayout:
            //     const className = classNames(Classes.DIALOG_BODY, "layout-map");
            //     return (
            //         <div className={className}>
            //             <FormGroup inline={true} label="Data type:">
            //                 <Tooltip content="Associate the data type to a exist layout.">
            //                     <HTMLSelect value={dynamicLayoutStore.dialogShowedCtype} disabled={!dynamicLayoutStore.isExistLayoutMap} onChange={ev => dynamicLayoutStore.selectLayoutMap(ev.currentTarget.selectedIndex)}>
            //                         {dynamicLayoutStore.dialogShowedCtypeList.map(dataType => (
            //                             <option key={dataType} value={dataType}>
            //                                 {`(${dataType})`}
            //                             </option>
            //                         ))}
            //                     </HTMLSelect>
            //                 </Tooltip>
            //             </FormGroup>
            //         </div>
            //     );
            default:
                return "";
        }
    };

    private renderLayoutDialogFooter = (mode: LayoutDialogMode) => {
        const dynamicLayoutStore = AppStore.Instance.dynamicLayoutStore;

        switch (mode) {
            case LayoutDialogMode.Save:
                dynamicLayoutStore.selectLayoutMap(dynamicLayoutStore.currentLayoutMapIndex);
                return (
                    <div className={Classes.DIALOG_FOOTER}>
                        <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                            <Tooltip content={`Save layout and associate it with data type (${dynamicLayoutStore.currentLayoutMapCtype})`} disabled={!this.isEmpty}>
                                <AnchorButton intent={Intent.PRIMARY} onClick={this.handleSaveLayoutMap} text={"Dynamic Layout"} disabled={this.isEmpty || !this.validName || !this.enableDynamicLayoutSave} />
                            </Tooltip>
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
            // case LayoutDialogMode.DynamicLayout:
            //     return (
            //         <div className={Classes.DIALOG_FOOTER}>
            //             <div className={Classes.DIALOG_FOOTER_ACTIONS}>
            //                 <FormGroup inline={true} label="Layout:">
            //                     <HTMLSelect
            //                         value={dynamicLayoutStore.dialogShowedLayoutName}
            //                         disabled={!dynamicLayoutStore.isExistLayoutMap}
            //                         onChange={ev => dynamicLayoutStore.saveLayoutMap(ev.currentTarget.value, dynamicLayoutStore.selectedLayoutMapIndex)}
            //                     >
            //                         {dynamicLayoutStore.dialogShowedLayoutNameList.map(layout => (
            //                             <option key={layout} value={layout}>
            //                                 {layout}
            //                             </option>
            //                         ))}
            //                     </HTMLSelect>
            //                 </FormGroup>
            //             </div>
            //         </div>
            //     );
            default:
                return "";
        }
    };

    render() {
        const appStore = AppStore.Instance;
        const className = classNames("layout-dialog", {[Classes.DARK]: appStore.darkTheme});

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
                    {LayoutMapComponent()}
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

export const LayoutMapComponent = () => {
    const dynamicLayoutStore = AppStore.Instance.dynamicLayoutStore;

    let layoutMapRow = [];
    if (dynamicLayoutStore.isExistLayoutMap) {
        dynamicLayoutStore.existLayoutMap.layoutMap.forEach((layoutMap, index) => {
            layoutMapRow.push(
                <tr key={index}>
                    <td>
                        <FormGroup>
                            (
                            {layoutMap.ctype.map((ctype, index) => {
                                const showedCtype = index !== 0 ? "," + ctype : ctype;
                                return (
                                    <Tooltip position="bottom" content={determineCtypeName(ctype)}>
                                        <span>{showedCtype}</span>
                                    </Tooltip>
                                );
                            })}
                            )
                        </FormGroup>
                    </td>
                    <td>
                        <HTMLSelect value={layoutMap.layoutName} disabled={!dynamicLayoutStore.isExistLayoutMap} onChange={ev => dynamicLayoutStore.saveLayoutMap(ev.currentTarget.value, index)}>
                            {dynamicLayoutStore.dialogShowedLayoutNameList.map(layout => (
                                <option key={layout} value={layout}>
                                    {layout}
                                </option>
                            ))}
                        </HTMLSelect>
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
            <tbody>{layoutMapRow}</tbody>
        </HTMLTable>
    );
};
