import * as React from "react";
import {observer} from "mobx-react";
import {Button, IDialogProps, Intent, Tab, Tabs, FormGroup} from "@blueprintjs/core";
import {DraggableDialogComponent} from "components/Dialogs";
import {ScalingComponent} from "components/RenderConfig/ColormapConfigComponent/ScalingComponent";
import {AppStore} from "stores";
import "./PreferenceDialogComponent.css";

@observer
export class PreferenceDialogComponent extends React.Component<{ appStore: AppStore }> {
    public render() {
        const appStore = this.props.appStore;
        const preferenceStore = appStore.preferenceStore;

        const globalPanel = (null);

        const renderConfigPanel = (
            <div className="panel-container">
                <FormGroup inline={true} label="Scaling">
                    <ScalingComponent
                        selectedItem={preferenceStore.getScaling()}
                        onItemSelect={preferenceStore.setScaling}
                    />
                </FormGroup>
            </div>
        );

        let className = "preference-dialog";
        if (appStore.darkTheme) {
            className += " bp3-dark";
        }

        const dialogProps: IDialogProps = {
            icon: "cog",
            backdropClassName: "minimal-dialog-backdrop",
            className: className,
            canOutsideClickClose: false,
            lazy: true,
            isOpen: appStore.preferenceDialogVisible,
            onClose: appStore.hidePreferenceDialog,
            title: "Preferences",
        };

        return (
            <DraggableDialogComponent dialogProps={dialogProps} minWidth={300} minHeight={300} defaultWidth={600} defaultHeight={450} enableResizing={true}>
                <div className="bp3-dialog-body">
                    <Tabs
                        id="preferenceTabs"
                        vertical={true}
                        selectedTabId={preferenceStore.perferenceSelectedTab}
                        onChange={(tabId) => preferenceStore.setPreferenceSelectedTab(String(tabId))}
                    >
                        <Tab id="global" title="Global" panel={globalPanel}/>
                        <Tab id="renderConfig" title="Default Render Config" panel={renderConfigPanel}/>
                    </Tabs>
                </div>
                <div className="bp3-dialog-footer">
                    <div className="bp3-dialog-footer-actions">
                        <Button intent={Intent.PRIMARY} onClick={appStore.hidePreferenceDialog} text="Close"/>
                    </div>
                </div>
            </DraggableDialogComponent>
        );
    }
}
