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
import {Theme, Layout, CursorPosition, Zoom, WCSType, RegionCreationMode} from "models";
import {AppStore, RenderConfigStore} from "stores";
import "./PreferenceDialogComponent.css";

enum TABS {
    GLOBAL,
    RENDER_CONFIG,
    WCS_OVERLAY,
    REGION
}

const PercentileSelect = Select.ofType<string>();

@observer
export class PreferenceDialogComponent extends React.Component<{ appStore: AppStore }> {
    @observable selectedTab: TabId = TABS.GLOBAL;

    renderPercentileSelectItem = (percentile: string, {handleClick, modifiers, query}) => {
        return <MenuItem text={percentile + "%"} onClick={handleClick} key={percentile}/>;
    };

    private reset = () => {
        const preference = this.props.appStore.preferenceStore;
        switch (this.selectedTab) {
            case TABS.RENDER_CONFIG:
                preference.resetRenderConfigSettings();
                break;
            case TABS.WCS_OVERLAY:
                preference.resetWCSOverlaySettings();
                break;
            case TABS.REGION:
                preference.resetRegionSettings();
                break;
            case TABS.GLOBAL: default:
                preference.resetGlobalSettings();
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
                        selectedValue={preference.theme}
                        onChange={(ev) => { ev.currentTarget.value === Theme.LIGHT ? appStore.setLightTheme() : appStore.setDarkTheme(); }}
                        inline={true}
                    >
                        <Radio label="Light" value={Theme.LIGHT}/>
                        <Radio label="Dark" value={Theme.DARK}/>
                    </RadioGroup>
                </FormGroup>
                <FormGroup inline={true} label="Auto-launch File Browser">
                    <Switch checked={preference.autoLaunch} onChange={(ev) => { preference.setAutoLaunch(ev.currentTarget.checked); }}/>
                </FormGroup>
                <FormGroup inline={true} label="Default Layout">
                    <HTMLSelect value={preference.layout} onChange={(ev) => { preference.setLayout(ev.currentTarget.value); }}>
                        <option value={Layout.DEFAULT}>default</option>
                        <option value={Layout.CUBEVIEW}>Cube view</option>
                        <option value={Layout.CUBEANALYSIS}>Cube analysis</option>
                        <option value={Layout.CONTINUUMANALYSIS}>Continuum analysis</option>
                    </HTMLSelect>
                </FormGroup>
                <FormGroup inline={true} label="Initial Cursor Position">
                    <RadioGroup
                        selectedValue={preference.cursorPosition}
                        onChange={(ev) => { preference.setCursorPosition(ev.currentTarget.value); }}
                        inline={true}
                    >
                        <Radio label="Fixed" value={CursorPosition.FIXED}/>
                        <Radio label="Tracking" value={CursorPosition.TRACKING}/>
                    </RadioGroup>
                </FormGroup>
                <FormGroup inline={true} label="Initial Zoom Level">
                    <RadioGroup
                        selectedValue={preference.zoomMode}
                        onChange={(ev) => { preference.setZoomMode(ev.currentTarget.value); }}
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
                        selectedItem={preference.scaling}
                        onItemSelect={(selected) => { preference.setScaling(selected); }}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Color map">
                    <ColormapComponent
                        selectedItem={preference.colormap}
                        onItemSelect={(selected) => { preference.setColormap(selected); }}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Percentile ranks">
                    <PercentileSelect
                        activeItem={preference.percentile.toString(10)}
                        onItemSelect={(selected) => { preference.setPercentile(selected); }}
                        popoverProps={{minimal: true, position: "auto"}}
                        filterable={false}
                        items={RenderConfigStore.PERCENTILE_RANKS.map(String)}
                        itemRenderer={this.renderPercentileSelectItem}
                    >
                        <Button text={preference.percentile.toString(10) + "%"} rightIcon="double-caret-vertical" alignText={"right"}/>
                    </PercentileSelect>
                </FormGroup>
            </React.Fragment>
        );

        const wcsOverlayPanel = (
            <React.Fragment>
                <FormGroup inline={true} label="Color">
                    <ColorComponent
                        selectedItem={preference.astColor}
                        onItemSelect={(selected) => { preference.setASTColor(selected); }}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Grid visible">
                    <Switch
                        checked={preference.astGridVisible}
                        onChange={(ev) => { preference.setASTGridVisible(ev.currentTarget.checked); }}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Label visible">
                    <Switch
                        checked={preference.astLabelsVisible}
                        onChange={(ev) => { preference.setASTLabelsVisible(ev.currentTarget.checked); }}
                    />
                </FormGroup>
                <FormGroup inline={true} label="WCS Type">
                    <RadioGroup
                        selectedValue={preference.wcsType}
                        onChange={(ev) => { preference.setWCSType(ev.currentTarget.value); }}
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
                <AppearanceForm region={preference.regionContainer} darkTheme={appStore.darkTheme} isPreference={true}/>
                <FormGroup inline={true} label="Region Type">
                    <HTMLSelect value={preference.regionContainer.regionType} onChange={(ev) => { preference.setRegionType(Number(ev.currentTarget.value)); }}>
                        <option value={CARTA.RegionType.RECTANGLE}>Rectangle</option>
                        <option value={CARTA.RegionType.ELLIPSE}>Ellipse</option>
                    </HTMLSelect>
                </FormGroup>
                <FormGroup inline={true} label="Creation Mode">
                    <RadioGroup
                        selectedValue={preference.regionCreationMode}
                        onChange={(ev) => { preference.setRegionCreationMode(ev.currentTarget.value); }}
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
                        <AnchorButton intent={Intent.WARNING} icon={"refresh"} onClick={this.reset} text="Restore defaults"/>
                        <Button intent={Intent.NONE} onClick={appStore.hidePreferenceDialog} text="Close"/>
                    </div>
                </div>
            </DraggableDialogComponent>
        );
    }
}
