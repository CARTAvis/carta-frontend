import * as React from "react";
import {observable} from "mobx";
import {observer} from "mobx-react";
import {CARTA} from "carta-protobuf";
import {Button, IDialogProps, Intent, Tab, Tabs, FormGroup, TabId, MenuItem, Switch, RadioGroup, Radio} from "@blueprintjs/core";
import {Select} from "@blueprintjs/select";
import {DraggableDialogComponent} from "components/Dialogs";
import {ScalingComponent} from "components/RenderConfig/ColormapConfigComponent/ScalingComponent";
import {ColormapComponent} from "components/RenderConfig/ColormapConfigComponent/ColormapComponent";
import {ColorComponent} from "components/Dialogs/OverlaySettings/ColorComponent";
import {AppearanceForm} from "components/Dialogs/RegionDialog/AppearanceForm/AppearanceForm";
import {AppStore, RegionStore, RenderConfigStore} from "stores";
import "./PreferenceDialogComponent.css";

const PercentileSelect = Select.ofType<string>();
const RegionTypeSelect = Select.ofType<CARTA.RegionType>();

@observer
export class PreferenceDialogComponent extends React.Component<{ appStore: AppStore }> {
    @observable selectedTab: TabId = "global";
    @observable theme = this.props.appStore.preferenceStore.getTheme();
    @observable autoLaunch = this.props.appStore.preferenceStore.getAutoLaunch();
    @observable cursorFreeze = this.props.appStore.preferenceStore.getCursorFreeze();
    @observable zoomMode = this.props.appStore.preferenceStore.getZoomMode();
    @observable scaling = this.props.appStore.preferenceStore.getScaling();
    @observable colormap = this.props.appStore.preferenceStore.getColormap();
    @observable percentile = this.props.appStore.preferenceStore.getPercentile().toString();
    @observable astColor = this.props.appStore.preferenceStore.getASTColor();
    @observable astGridVisible = this.props.appStore.preferenceStore.getASTGridVisible();
    @observable astLabelsVisible = this.props.appStore.preferenceStore.getASTLabelsVisible();
    @observable regionType = this.props.appStore.preferenceStore.getRegionType();
    @observable regionCreationMode = this.props.appStore.preferenceStore.getRegionCreationMode();

    renderPercentileSelectItem = (percentile: string, {handleClick, modifiers, query}) => {
        return <MenuItem text={percentile + "%"} onClick={handleClick} key={percentile}/>;
    };

    renderRegionTypeSelectItem = (regionType: CARTA.RegionType, {handleClick, modifiers, query}) => {
        return <MenuItem text={RegionStore.RegionTypeString(regionType)} onClick={handleClick} key={regionType}/>;
    };

    public render() {
        const appStore = this.props.appStore;
        const preference = appStore.preferenceStore;

        const globalPanel = (
            <React.Fragment>
                <FormGroup inline={true} label="Theme">
                    <RadioGroup
                        selectedValue={this.theme}
                        onChange={(ev) => { preference.setTheme(ev.currentTarget.value); this.theme = ev.currentTarget.value; }}
                        inline={true}
                    >
                        <Radio label="Light" value="light"/>
                        <Radio label="Dark" value="dark"/>
                    </RadioGroup>
                </FormGroup>
                <FormGroup inline={true} label="Auto-launch File Browser">
                    <Switch checked={this.autoLaunch} innerLabelChecked="Enable" innerLabel="Disable" onChange={(ev) => { preference.setAutoLaunch(ev.currentTarget.checked); this.autoLaunch = ev.currentTarget.checked; }}/>
                </FormGroup>
                <FormGroup inline={true} label="Cursor Position">
                    <Switch checked={this.cursorFreeze} innerLabelChecked="Freeze" innerLabel="Unfreeze" onChange={(ev) => { preference.setCursorFreeze(ev.currentTarget.checked); this.cursorFreeze = ev.currentTarget.checked; }}/>
                </FormGroup>
                <FormGroup inline={true} label="Image Zoom Level">
                    <RadioGroup
                        selectedValue={this.zoomMode}
                        onChange={(ev) => { preference.setZoomMode(ev.currentTarget.value); this.zoomMode = ev.currentTarget.value; }}
                    >
                        <Radio label="Zoom to fit" value="fit"/>
                        <Radio label="Zoom to 1.0x" value="1.0x"/>
                    </RadioGroup>
                </FormGroup>
            </React.Fragment>
        );

        const renderConfigPanel = (
            <React.Fragment>
                <FormGroup inline={true} label="Scaling">
                    <ScalingComponent
                        selectedItem={this.scaling}
                        onItemSelect={(selected) => { preference.setScaling(selected); this.scaling = selected; }}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Color map">
                    <ColormapComponent
                        selectedItem={this.colormap}
                        onItemSelect={(selected) => { preference.setColormap(selected); this.colormap = selected; }}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Percentile ranks">
                    <PercentileSelect
                        activeItem={this.percentile}
                        onItemSelect={(selected) => { preference.setPercentile(selected); this.percentile = selected; }}
                        popoverProps={{minimal: true, position: "auto"}}
                        filterable={false}
                        items={RenderConfigStore.PERCENTILE_RANKS.map(String)}
                        itemRenderer={this.renderPercentileSelectItem}
                    >
                        <Button text={this.percentile + "%"} rightIcon="double-caret-vertical" alignText={"right"}/>
                    </PercentileSelect>
                </FormGroup>
            </React.Fragment>
        );

        const astSettingsPanel = (
            <React.Fragment>
                <FormGroup inline={true} label="Color">
                    <ColorComponent
                        selectedItem={this.astColor}
                        onItemSelect={(selected) => { preference.setASTColor(selected); this.astColor = selected; }}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Grid visible">
                    <Switch
                        checked={this.astGridVisible}
                        onChange={(ev) => { preference.setASTGridVisible(ev.currentTarget.checked); this.astGridVisible = ev.currentTarget.checked; }}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Label visible">
                    <Switch
                        checked={this.astLabelsVisible}
                        onChange={(ev) => { preference.setASTLabelsVisible(ev.currentTarget.checked); this.astLabelsVisible = ev.currentTarget.checked; }}
                    />
                </FormGroup>
            </React.Fragment>
        );

        const regionSettingsPanel = (
            <React.Fragment>
                <AppearanceForm region={preference.getDefaultRegion()} darkTheme={appStore.darkTheme} isPreference={true}/>
                <FormGroup inline={true} label="Region Type">
                    <RegionTypeSelect
                        activeItem={this.regionType}
                        onItemSelect={(selected) => { preference.setRegionType(selected); this.regionType = selected; }}
                        popoverProps={{minimal: true, position: "auto-start"}}
                        filterable={false}
                        items={Array.from(RegionStore.AVAILABLE_REGION_TYPES.keys())}
                        itemRenderer={this.renderRegionTypeSelectItem}
                    >
                        <Button text={RegionStore.RegionTypeString(preference.getRegionType())} rightIcon="double-caret-vertical" alignText={"right"}/>
                    </RegionTypeSelect>
                </FormGroup>
                <FormGroup inline={true} label="Creation Mode">
                    <RadioGroup
                        selectedValue={this.regionCreationMode}
                        onChange={(ev) => { preference.setRegionCreationMode(ev.currentTarget.value); this.regionCreationMode = ev.currentTarget.value; }}
                    >
                        <Radio label="Center to corner" value="center"/>
                        <Radio label="Corner to corner" value="corner"/>
                    </RadioGroup>
                </FormGroup>
            </React.Fragment>
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
            <DraggableDialogComponent dialogProps={dialogProps} minWidth={300} minHeight={300} defaultWidth={725} defaultHeight={450} enableResizing={true}>
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
                        <Tab id="regionSettings" title="Default Region settings" panel={regionSettingsPanel}/>
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
