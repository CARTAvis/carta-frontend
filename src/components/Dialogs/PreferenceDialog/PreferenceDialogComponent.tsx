import * as React from "react";
import {observable} from "mobx";
import {observer} from "mobx-react";
import {CARTA} from "carta-protobuf";
import {Button, IDialogProps, Intent, Tab, Tabs, FormGroup, TabId, MenuItem, Switch, RadioGroup, Radio, HTMLSelect, AnchorButton} from "@blueprintjs/core";
import {Select} from "@blueprintjs/select";
import {DraggableDialogComponent} from "components/Dialogs";
import {ScalingComponent} from "components/RenderConfig/ColormapConfigComponent/ScalingComponent";
import {ColormapComponent} from "components/RenderConfig/ColormapConfigComponent/ColormapComponent";
import {ColorComponent} from "components/Dialogs/OverlaySettings/ColorComponent";
import {AppearanceForm} from "components/Dialogs/RegionDialog/AppearanceForm/AppearanceForm";
import {Theme, Layout, Zoom, WCSType, RegionCreationMode} from "models";
import {AppStore, RenderConfigStore} from "stores";
import "./PreferenceDialogComponent.css";

const PercentileSelect = Select.ofType<string>();

enum TABS {
    GLOBAL,
    RENDER_CONFIG,
    WCS_OVERLAY,
    REGION
}

@observer
export class PreferenceDialogComponent extends React.Component<{ appStore: AppStore }> {
    @observable selectedTab: TabId = TABS.GLOBAL;
    @observable theme = this.props.appStore.preferenceStore.getTheme();
    @observable autoLaunch = this.props.appStore.preferenceStore.getAutoLaunch();
    @observable layout = this.props.appStore.preferenceStore.getLayout();
    @observable cursorFreeze = this.props.appStore.preferenceStore.getCursorFreeze();
    @observable zoomMode = this.props.appStore.preferenceStore.getZoomMode();
    @observable scaling = this.props.appStore.preferenceStore.getScaling();
    @observable colormap = this.props.appStore.preferenceStore.getColormap();
    @observable percentile = this.props.appStore.preferenceStore.getPercentile().toString();
    @observable astColor = this.props.appStore.preferenceStore.getASTColor();
    @observable astGridVisible = this.props.appStore.preferenceStore.getASTGridVisible();
    @observable astLabelsVisible = this.props.appStore.preferenceStore.getASTLabelsVisible();
    @observable wcsType = this.props.appStore.preferenceStore.getWCSType();
    @observable regionType = this.props.appStore.preferenceStore.getRegionType();
    @observable regionCreationMode = this.props.appStore.preferenceStore.getRegionCreationMode();

    renderPercentileSelectItem = (percentile: string, {handleClick, modifiers, query}) => {
        return <MenuItem text={percentile + "%"} onClick={handleClick} key={percentile}/>;
    };

    private reset = () => {
        const preference = this.props.appStore.preferenceStore;

        switch (this.selectedTab) {
            case TABS.RENDER_CONFIG:
                preference.resetRenderConfigSettings();
                this.scaling = preference.getScaling();
                this.colormap = preference.getColormap();
                this.percentile = preference.getPercentile().toString();
                break;
            case TABS.WCS_OVERLAY:
                preference.resetWCSOverlaySettings();
                this.astColor = preference.getASTColor();
                this.astGridVisible = preference.getASTGridVisible();
                this.astLabelsVisible = preference.getASTLabelsVisible();
                this.wcsType = preference.getWCSType();
                break;
            case TABS.REGION:
                break;
            case TABS.GLOBAL: default:
                preference.resetGlobalSettings();
                this.theme = preference.getTheme();
                this.autoLaunch = preference.getAutoLaunch();
                this.layout = preference.getLayout();
                this.cursorFreeze = preference.getCursorFreeze();
                this.zoomMode = preference.getZoomMode();
                break;
        }
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
                        <Radio label="Light" value={Theme.LIGHT}/>
                        <Radio label="Dark" value={Theme.DARK}/>
                    </RadioGroup>
                </FormGroup>
                <FormGroup inline={true} label="Auto-launch File Browser">
                    <Switch checked={this.autoLaunch} innerLabelChecked="Enable" innerLabel="Disable" onChange={(ev) => { preference.setAutoLaunch(ev.currentTarget.checked); this.autoLaunch = ev.currentTarget.checked; }}/>
                </FormGroup>
                <FormGroup inline={true} label="Layout">
                    <HTMLSelect value={this.layout} onChange={(ev) => { preference.setLayout(ev.currentTarget.value); this.layout = ev.currentTarget.value; }}>
                        <option value={Layout.CUBEVIEW}>Cube view</option>
                        <option value={Layout.CUBEANALYSIS}>Cube analysis</option>
                        <option value={Layout.CONTINUUMANALYSIS}>Continuum analysis</option>
                    </HTMLSelect>
                </FormGroup>
                <FormGroup inline={true} label="Cursor Position">
                    <Switch checked={this.cursorFreeze} innerLabelChecked="Freeze" innerLabel="Unfreeze" onChange={(ev) => { preference.setCursorFreeze(ev.currentTarget.checked); this.cursorFreeze = ev.currentTarget.checked; }}/>
                </FormGroup>
                <FormGroup inline={true} label="Image Zoom Level">
                    <RadioGroup
                        selectedValue={this.zoomMode}
                        onChange={(ev) => { preference.setZoomMode(ev.currentTarget.value); this.zoomMode = ev.currentTarget.value; }}
                        inline={true}
                    >
                        <Radio label="Zoom to fit" value={Zoom.FIT}/>
                        <Radio label="Zoom to 1.0x" value={Zoom.RAW}/>
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

        const wcsOverlayPanel = (
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
                <FormGroup inline={true} label="WCS Type">
                    <RadioGroup
                        selectedValue={this.wcsType}
                        onChange={(ev) => { preference.setWCSType(ev.currentTarget.value); this.wcsType = ev.currentTarget.value; }}
                    >
                        <Radio label="Automatic" value={WCSType.AUTOMATIC}/>
                        <Radio label="Degrees" value={WCSType.DEGREES}/>
                        <Radio label="Sexigesimal" value={WCSType.SEXIGESIMAL}/>
                    </RadioGroup>
                </FormGroup>
            </React.Fragment>
        );

        const regionSettingsPanel = (
            <React.Fragment>
                <AppearanceForm region={preference.getDefaultRegion()} darkTheme={appStore.darkTheme} isPreference={true}/>
                <FormGroup inline={true} label="Region Type">
                    <HTMLSelect value={this.regionType} onChange={(ev) => { preference.setRegionType(Number(ev.currentTarget.value)); this.regionType = Number(ev.currentTarget.value); }}>
                        <option value={CARTA.RegionType.RECTANGLE}>Rectangle</option>
                        <option value={CARTA.RegionType.ELLIPSE}>Ellipse</option>
                    </HTMLSelect>
                </FormGroup>
                <FormGroup inline={true} label="Creation Mode">
                    <RadioGroup
                        selectedValue={this.regionCreationMode}
                        onChange={(ev) => { preference.setRegionCreationMode(ev.currentTarget.value); this.regionCreationMode = ev.currentTarget.value; }}
                    >
                        <Radio label="Center to corner" value={RegionCreationMode.CENTER}/>
                        <Radio label="Corner to corner" value={RegionCreationMode.CORNER}/>
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
                        <Tab id={TABS.GLOBAL} title="Global" panel={globalPanel}/>
                        <Tab id={TABS.RENDER_CONFIG} title="Default Render Config" panel={renderConfigPanel}/>
                        <Tab id={TABS.WCS_OVERLAY} title="Default WCS Overlay" panel={wcsOverlayPanel}/>
                        <Tab id={TABS.REGION} title="Default Region settings" panel={regionSettingsPanel}/>
                    </Tabs>
                </div>
                <div className="bp3-dialog-footer">
                    <div className="bp3-dialog-footer-actions">
                        <AnchorButton intent={Intent.DANGER} icon={"refresh"} onClick={this.reset} text="Reset"/>
                        <Button intent={Intent.NONE} onClick={appStore.hidePreferenceDialog} text="Close"/>
                    </div>
                </div>
            </DraggableDialogComponent>
        );
    }
}
