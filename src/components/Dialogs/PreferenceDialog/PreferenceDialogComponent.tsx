import * as React from "react";
import {observable} from "mobx";
import {observer} from "mobx-react";
import {Button, IDialogProps, Intent, Tab, Tabs, FormGroup, TabId, MenuItem, IPopoverProps} from "@blueprintjs/core";
import {Select} from "@blueprintjs/select";
import {DraggableDialogComponent} from "components/Dialogs";
import {ScalingComponent} from "components/RenderConfig/ColormapConfigComponent/ScalingComponent";
import {ColormapComponent} from "components/RenderConfig/ColormapConfigComponent/ColormapComponent";
import {ColorComponent} from "components/Dialogs/OverlaySettings/ColorComponent";
import {AppStore} from "stores";
import {RenderConfigStore} from "stores/RenderConfigStore";
import "./PreferenceDialogComponent.css";

const PercentileSelect = Select.ofType<string>();
const PERCENTILE_POPOVER_PROPS: Partial<IPopoverProps> = {minimal: true, position: "auto-end", popoverClassName: "colormap-select-popover"};

@observer
export class PreferenceDialogComponent extends React.Component<{ appStore: AppStore }> {
    @observable selectedTab: TabId = "renderConfig";
    @observable scaling = this.props.appStore.preferenceStore.getScaling();
    @observable colormap = this.props.appStore.preferenceStore.getColormap();
    @observable percentile = this.props.appStore.preferenceStore.getPercentile().toString();
    @observable astColor = this.props.appStore.preferenceStore.getASTColor();

    renderPercentileSelectItem = (percentile: string, {handleClick, modifiers, query}) => {
        return <MenuItem text={percentile + "%"} onClick={handleClick} key={percentile}/>;
    };

    public render() {
        const appStore = this.props.appStore;
        const preferenceStore = appStore.preferenceStore;

        const globalPanel = (null);

        const renderConfigPanel = (
            <div className="panel-container">
                <FormGroup inline={true} label="Scaling">
                    <ScalingComponent
                        selectedItem={this.scaling}
                        onItemSelect={(selected) => { preferenceStore.setScaling(selected); this.scaling = selected; }}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Color map">
                    <ColormapComponent
                        selectedItem={this.colormap}
                        onItemSelect={(selected) => { preferenceStore.setColormap(selected); this.colormap = selected; }}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Percentile ranks">
                    <PercentileSelect
                        activeItem={this.percentile}
                        onItemSelect={(selected) => { preferenceStore.setPercentile(selected); this.percentile = selected; }}
                        popoverProps={PERCENTILE_POPOVER_PROPS}
                        filterable={false}
                        items={RenderConfigStore.PERCENTILE_RANKS.map(String)}
                        itemRenderer={this.renderPercentileSelectItem}
                    >
                        <Button text={this.percentile + "%"} rightIcon="double-caret-vertical" alignText={"right"}/>
                    </PercentileSelect>
                </FormGroup>
            </div>
        );

        const astSettingsPanel = (
            <div className="panel-container">
                <FormGroup inline={true} label="Color">
                    <ColorComponent
                        selectedItem={this.astColor}
                        onItemSelect={(selected) => { preferenceStore.setASTColor(selected); this.astColor = selected; }}
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
                        selectedTabId={this.selectedTab}
                        onChange={(tabId) => this.selectedTab = tabId}
                    >
                        <Tab id="global" title="Global" panel={globalPanel}/>
                        <Tab id="renderConfig" title="Default Render Config" panel={renderConfigPanel}/>
                        <Tab id="astSettings" title="Default WCS Overlay" panel={astSettingsPanel}/>
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
