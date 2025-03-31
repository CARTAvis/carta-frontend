import * as React from "react";
import {CSSProperties} from "react";
import {AnchorButton, ButtonGroup, Classes, Collapse, DialogProps, FormGroup, HTMLSelect, HTMLTable, InputGroup, Intent, Position, Switch, Tab, Tabs, Tooltip} from "@blueprintjs/core";
import classNames from "classnames";
import {action, computed, flow, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";

import {DraggableDialogComponent} from "components/Dialogs";
import {ScrollShadow} from "components/Shared";
import {CtypeAbbrToName, PresetLayout} from "models";
import {AppStore, DialogId, FrameStore, HelpType, INITIAL_LAYOUT_ITEM, LayoutDialogMode, PreferenceKeys, PreferenceStore} from "stores";

import "./LayoutDialogComponent.scss";

const KEYCODE_ENTER = 13;
@observer
export class LayoutDialogComponent extends React.Component {
    private static readonly DefaultWidth = 425;
    private static readonly DefaultHeight = 600;
    private static readonly MinWidth = 425;
    private static readonly MinHeight = 600;

    @observable private editingLayoutName: string = "";
    @observable private layoutName: string = "";
    @observable private layoutRename: string = "";
    @observable private saveDynamicLayoutEnable: boolean = false;
    @observable private hoverLayoutName: string = "";

    @computed get isEmpty(): boolean {
        return !this.layoutName?.trim();
    }

    @computed get isRenameEmpty(): boolean {
        return !this.layoutRename?.trim();
    }

    @computed get validName(): boolean {
        return this.layoutName.match(/^[^~`!*()\-+=[.'?<>/|\\:;&]+$/)?.length > 0;
    }

    @computed get validRename(): boolean {
        return this.layoutRename.match(/^[^~`!*()\-+=[.'?<>/|\\:;&]+$/)?.length > 0;
    }

    @action onMouseEnter = (layoutName: string) => {
        this.hoverLayoutName = layoutName;
    };

    @action onMouseLeave = () => {
        this.hoverLayoutName = "";
    };

    @action onMouseClick = () => {
        if (this.hoverLayoutName !== this.editingLayoutName) {
            this.editingLayoutName = "";
            this.clearRenameInput();
        }
    };

    constructor(props: any) {
        super(props);
        makeObservable(this);
    }

    @action private handleInput = (ev: React.FormEvent<HTMLInputElement>) => {
        this.layoutName = ev.currentTarget.value;
    };

    @action private handleRenameInput = (ev: React.FormEvent<HTMLInputElement>) => {
        this.layoutRename = ev.currentTarget.value;
    };

    @action private clearInput = () => {
        this.layoutName = "";
    };

    @action private clearRenameInput = () => {
        this.layoutRename = "";
    };

    private handleKeyDown = ev => {
        if (ev.keyCode === KEYCODE_ENTER && !this.isEmpty && this.validName) {
            this.saveLayout();
        }
    };

    private handleRenameKeyDown = ev => {
        if (ev.keyCode === KEYCODE_ENTER && !this.isRenameEmpty && this.validRename) {
            this.renameLayout();
        }
    };

    @flow.bound private *saveLayout() {
        const appStore = AppStore.Instance;
        const dyLayoutStore = appStore.dynamicLayoutStore;

        appStore.layoutStore.setLayoutToBeSaved(this.layoutName.trim());
        if (appStore.layoutStore.layoutExists(this.layoutName)) {
            if (PresetLayout.isPreset(this.layoutName)) {
                appStore.alertStore.showAlert("Layout name cannot be the same as system presets.");
            } else {
                const confirmed = yield appStore.alertStore.showInteractiveAlert(`Are you sure to overwrite the existing layout ${this.layoutName}?`);
                if (confirmed) {
                    yield appStore.layoutStore.saveLayout();
                    if (this.saveDynamicLayoutEnable && appStore.activeFrame && appStore.activeFrame?.dynamicLayout.ctype !== "") {
                        yield dyLayoutStore.saveLayoutMapping(this.layoutName, appStore.activeFrame.dynamicLayout.ctype);
                    }
                }
            }
        } else {
            yield appStore.layoutStore.saveLayout();
            if (this.saveDynamicLayoutEnable && appStore.activeFrame && appStore.activeFrame?.dynamicLayout.ctype !== "") {
                yield dyLayoutStore.saveLayoutMapping(this.layoutName, appStore.activeFrame.dynamicLayout.ctype);
            }
        }
        this.clearInput();
        this.saveDynamicLayoutEnable = false;
    }

    private renameLayout = async () => {
        const appStore = AppStore.Instance;
        await appStore.layoutStore.renameLayout(this.editingLayoutName, this.layoutRename.trim());
        this.clearRenameInput();
    };

    @action private toggleSaveDynamicLayoutEnable() {
        this.saveDynamicLayoutEnable = !this.saveDynamicLayoutEnable;
    }

    private layoutComponent = () => {
        const layoutStore = AppStore.Instance.layoutStore;

        const layoutRenameInput = (layoutName: string) => {
            return (
                <Tooltip isOpen={!this.isRenameEmpty && !this.validRename} position={Position.BOTTOM_LEFT} content={"Layout name should not contain ~, `, !, *, (, ), -, +, =, [, ., ', ?, <, >, /, |, \\, :, ; or &"}>
                    <InputGroup className="layout-name-input" placeholder={layoutName} value={this.layoutRename} autoFocus={true} onChange={this.handleRenameInput} onKeyDown={this.handleRenameKeyDown} />
                </Tooltip>
            );
        };

        const saveLayoutRow = () => {
            const activeFrame = AppStore.Instance.activeFrame;

            return (
                <tr key={"saveLayoutRow"} onClick={this.onMouseClick}>
                    <td>
                        <Tooltip isOpen={!this.isEmpty && !this.validName} position={Position.BOTTOM_LEFT} content={"Layout name should not contain ~, `, !, *, (, ), -, +, =, [, ., ', ?, <, >, /, |, \\, :, ; or &"}>
                            <InputGroup className="layout-name-input" placeholder="New layout name" value={this.layoutName} autoFocus={true} onChange={this.handleInput} onKeyDown={this.handleKeyDown} />
                        </Tooltip>
                    </td>
                    <td className="save-layout-row">
                        <Tooltip content="Layout name cannot be empty!" disabled={!this.isEmpty}>
                            <AnchorButton intent={Intent.PRIMARY} onClick={this.saveLayout} text={"Save"} disabled={this.isEmpty || !this.validName} />
                        </Tooltip>
                        <Collapse isOpen={PreferenceStore.Instance.dynamicLayoutEnable && !!activeFrame && activeFrame?.dynamicLayout.ctype !== ""}>
                            <Tooltip content={`If on, apply layout when images with type (${activeFrame?.dynamicLayout.ctype.replace(",", ", ")}) are loaded`} disabled={!activeFrame || activeFrame?.dynamicLayout.ctype === ""}>
                                <FormGroup inline={true} disabled={!activeFrame || this.isEmpty}>
                                    <Switch
                                        innerLabel="dynamic"
                                        checked={this.saveDynamicLayoutEnable}
                                        disabled={!activeFrame || this.isEmpty || activeFrame?.dynamicLayout.ctype === ""}
                                        onChange={() => this.toggleSaveDynamicLayoutEnable()}
                                    />
                                </FormGroup>
                            </Tooltip>
                        </Collapse>
                    </td>
                </tr>
            );
        };

        const rows = layoutStore.orderedLayoutNames.map((layoutName, index) => {
            const appStore = AppStore.Instance;
            const className = classNames("layout-name-input", {active: this.editingLayoutName === layoutName});

            const styleProps: CSSProperties = {
                opacity: this.hoverLayoutName === layoutName ? 1 : 0,
                backgroundColor: "transparent"
            };

            return (
                <tr key={index} onMouseOver={() => this.onMouseEnter(layoutName)} onMouseLeave={this.onMouseLeave}>
                    <td className={className} onClick={this.onMouseClick}>
                        <FormGroup>{this.editingLayoutName === layoutName ? layoutRenameInput(layoutName) : layoutName}</FormGroup>
                    </td>
                    <td>
                        <ButtonGroup style={styleProps}>
                            <AnchorButton onClick={() => (layoutName === this.editingLayoutName ? this.renameLayout() : layoutStore.applyLayout(layoutName))} disabled={layoutName === this.editingLayoutName && !this.validRename}>
                                {layoutName === this.editingLayoutName ? "Rename" : "Apply"}
                            </AnchorButton>
                            <AnchorButton
                                icon="edit"
                                onClick={() => (this.editingLayoutName = this.editingLayoutName === layoutName ? "" : layoutName)}
                                disabled={PresetLayout.PRESETS.includes(layoutName)}
                                active={this.editingLayoutName === layoutName}
                            />
                            <AnchorButton
                                icon="trash"
                                onClick={() => {
                                    layoutStore.deleteLayout(layoutName);
                                    if (layoutName === appStore.preferenceStore.layout) {
                                        appStore.preferenceStore.setPreference(PreferenceKeys.LAYOUT, PresetLayout.DEFAULT);
                                    }
                                }}
                                disabled={PresetLayout.PRESETS.includes(layoutName)}
                            />
                        </ButtonGroup>
                    </td>
                </tr>
            );
        });

        return (
            <HTMLTable data-testid="layout-table">
                <tbody>{[saveLayoutRow(), ...rows]}</tbody>
            </HTMLTable>
        );
    };

    private showDialog = () => {
        const appStore = AppStore.Instance;
        const {preferenceStore, layoutStore} = appStore;

        if (preferenceStore.dynamicLayoutEnable && ((appStore.activeFrame && appStore.activeFrame.dynamicLayout.ctype !== "") || appStore.dynamicLayoutStore.isMappingExisted)) {
            return (
                <ScrollShadow>
                    <Tabs>
                        <Tab id={LayoutDialogMode.Layout} title="Layout" panel={this.layoutComponent()} />
                        <Tab
                            id={LayoutDialogMode.DynamicLayout}
                            title="Dynamic Layout"
                            panel={<LayoutMappingComponent orderedLayoutNames={layoutStore.orderedLayoutNames} existLayoutMapping={preferenceStore.existLayoutMapping} activeFrame={appStore.activeFrame} />}
                        />
                    </Tabs>
                </ScrollShadow>
            );
        } else {
            return (
                <ScrollShadow>
                    <div>{this.layoutComponent()}</div>
                </ScrollShadow>
            );
        }
    };

    render() {
        const appStore = AppStore.Instance;

        const dialogProps: DialogProps = {
            icon: "page-layout",
            backdropClassName: "minimal-dialog-backdrop",
            className: "layout-dialog",
            canOutsideClickClose: false,
            lazy: true,
            isOpen: appStore.dialogStore.dialogVisible.get(DialogId.Layout),
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
                dialogId={DialogId.Layout}
            >
                <div
                    className={Classes.DIALOG_BODY}
                    onClick={ev => {
                        this.onMouseClick();
                        ev.stopPropagation();
                    }}
                >
                    {this.showDialog()}
                </div>
            </DraggableDialogComponent>
        );
    }
}

function LayoutMappingRow({ctypes, layoutName}: {ctypes: string; layoutName: string}) {
    const appStore = AppStore.Instance;
    const {dynamicLayoutStore: dyLayoutStore, layoutStore, activeFrame} = appStore;

    const className = classNames("layout-mapping", {
        active: ctypes === activeFrame?.dynamicLayout.ctype
    });

    const [selectedLayout, setSelectedLayout] = React.useState(layoutName);

    const ctypeName = CtypeAbbrToName(ctypes);
    const NormCtype = ctypes
        .split(",")
        .map(ctype => {
            return ctype.length > 2 ? `${ctype[0]}..` : ctype;
        })
        .join(", ");

    return (
        <tr>
            <td className={className}>
                <Tooltip position="bottom" content={`(${ctypeName.replaceAll(",", ", ")})`}>
                    <FormGroup>({NormCtype})</FormGroup>
                </Tooltip>
            </td>
            <td className={className}>
                <HTMLSelect
                    value={selectedLayout}
                    onChange={ev => {
                        dyLayoutStore.saveLayoutMapping(ev.currentTarget.value, ctypes);
                        setSelectedLayout(ev.currentTarget.value);
                    }}
                >
                    {[INITIAL_LAYOUT_ITEM, ...layoutStore.orderedLayoutNames].map(layout => (
                        <option key={layout} value={layout}>
                            {layout}
                        </option>
                    ))}
                </HTMLSelect>
                <AnchorButton
                    icon="trash"
                    onClick={() => {
                        dyLayoutStore.deleteLayoutMapping(ctypes);
                    }}
                />
            </td>
        </tr>
    );
}

interface LayoutMappingComponentProps {
    orderedLayoutNames: string[];
    existLayoutMapping: {[key: string]: string};
    activeFrame: FrameStore;
}

export const LayoutMappingComponent = React.memo((props: LayoutMappingComponentProps) => {
    const appStore = AppStore.Instance;
    const {dynamicLayoutStore: dyLayoutStore} = appStore;

    let ctypeList = [props.activeFrame?.dynamicLayout.ctype ?? ""];
    let layoutNameList = [props.activeFrame?.dynamicLayout.layoutName ?? ""];

    if (dyLayoutStore.isMappingExisted) {
        const ctypes = Object.keys(props.existLayoutMapping).reverse();
        const layoutNames = ctypes.map(ctype => props.existLayoutMapping[ctype]);

        ctypeList = props.activeFrame && props.activeFrame.dynamicLayout.ctype !== "" ? (ctypes.includes(props.activeFrame.dynamicLayout.ctype) ? ctypes : [props.activeFrame.dynamicLayout.ctype, ...ctypes]) : ctypes;
        layoutNameList =
            props.activeFrame && props.activeFrame.dynamicLayout.ctype !== "" ? (ctypes.includes(props.activeFrame.dynamicLayout.ctype) ? layoutNames : [props.activeFrame.dynamicLayout.layoutName, ...layoutNames]) : layoutNames;
    }

    const LayoutMappingRows = () => {
        return ctypeList.map((layoutCtypes, index) => {
            return <LayoutMappingRow key={layoutCtypes} ctypes={layoutCtypes} layoutName={layoutNameList[index]} />;
        });
    };

    return (
        <HTMLTable data-testid="dynamic-layout-table">
            <thead>
                <tr>
                    <th>Data type</th>
                    <th>Layout</th>
                </tr>
            </thead>
            <tbody>
                <LayoutMappingRows />
            </tbody>
        </HTMLTable>
    );
});
