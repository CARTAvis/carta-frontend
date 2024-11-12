import * as React from "react";
import {AnchorButton, Classes, DialogProps, FormGroup, HTMLSelect, InputGroup, Intent, Label, Position, Tooltip} from "@blueprintjs/core";
import classNames from "classnames";
import {computed, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";

import {DraggableDialogComponent} from "components/Dialogs";
import {PresetLayout} from "models";
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
        [LayoutDialogMode.SmartLayout, "Smart Layout"]
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

    private saveLayoutMap = async () => {
        // keep layoutName before it is cleared in saveLayout()
        const layoutName = this.layoutName.trim();

        await this.saveLayout();

        const appStore = AppStore.Instance;
        appStore.dialogStore.hideDialog(DialogId.Layout);
        await appStore.layoutStore.saveLayoutMap(layoutName);
    };

    @computed get isEmpty(): boolean {
        return !this.layoutName?.trim();
    }

    @computed get validName(): boolean {
        return this.layoutName.match(/^[^~`!*()\-+=[.'?<>/|\\:;&]+$/)?.length > 0;
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
            case LayoutDialogMode.SmartLayout:
                return (
                    <div className={Classes.DIALOG_BODY}>
                        <Label>{`Associate data type (${layoutStore.currentLayoutMapCtype})`}</Label>
                    </div>
                );
            default:
                return "";
        }
    };

    private renderLayoutDialogFooter = (mode: LayoutDialogMode) => {
        const layoutStore = AppStore.Instance.layoutStore;

        switch (mode) {
            case LayoutDialogMode.Save:
                return (
                    <div className={Classes.DIALOG_FOOTER}>
                        <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                            <Tooltip content="Save as smart layout" disabled={!this.isEmpty}>
                                <AnchorButton intent={Intent.PRIMARY} onClick={this.saveLayoutMap} text={"Smart Layout"} disabled={this.isEmpty || !this.validName || layoutStore.currentLayoutMapCtype.length === 0} />
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
            case LayoutDialogMode.SmartLayout:
                return (
                    <div className={Classes.DIALOG_FOOTER}>
                        <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                            <FormGroup inline={true} label="to Layout:">
                                <HTMLSelect value={layoutStore.smartLayoutName} onChange={ev => layoutStore.saveLayoutMap(ev.currentTarget.value)}>
                                    {layoutStore.orderedLayoutNames.map(layout => (
                                        <option key={layout} value={layout}>
                                            {layout}
                                        </option>
                                    ))}
                                </HTMLSelect>
                            </FormGroup>
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
                {/* <div className={Classes.DIALOG_BODY}> */}
                {/* <FormGroup inline={true} label={isSave ? "Save current layout as:" : `Rename ${appStore.layoutStore.oldLayoutName} to:`}>
                        <Tooltip isOpen={!this.isEmpty && !this.validName} position={Position.BOTTOM_LEFT} content={"Layout name should not contain ~, `, !, *, (, ), -, +, =, [, ., ', ?, <, >, /, |, \\, :, ; or &"}>
                            <InputGroup className="layout-name-input" placeholder="Enter layout name" value={this.layoutName} autoFocus={true} onChange={this.handleInput} onKeyDown={this.handleKeyDown} />
                        </Tooltip>
                    </FormGroup> */}
                {/* </div> */}
                {dialogBody}
                {/* <div className={Classes.DIALOG_FOOTER}>
                    <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                        <Tooltip content="Save as smart layout" disabled={!this.isEmpty}>
                            <AnchorButton intent={Intent.PRIMARY} onClick={this.saveLayoutMap} text={"Smart Layout"} disabled={this.isEmpty || !this.validName || appStore.layoutStore.currentLayoutMapCtype.length === 0} />
                        </Tooltip>
                        <Tooltip content="Layout name cannot be empty!" disabled={!this.isEmpty}>
                            <AnchorButton intent={Intent.PRIMARY} onClick={isSave ? this.saveLayout : this.renameLayout} text={isSave ? "Save" : "Rename"} disabled={this.isEmpty || !this.validName} />
                        </Tooltip>
                    </div>
                </div> */}
                {dialogFooter}
            </DraggableDialogComponent>
        );
    }
}
