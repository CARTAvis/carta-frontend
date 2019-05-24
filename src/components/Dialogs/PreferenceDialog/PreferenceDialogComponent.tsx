import * as React from "react";
import {observer} from "mobx-react";
import {Select} from "@blueprintjs/select";
import {Button, IDialogProps, Intent, Tab, Tabs, IPopoverProps, MenuItem, FormGroup} from "@blueprintjs/core";
import {DraggableDialogComponent} from "components/Dialogs";
import {AppStore} from "stores";
import "./PreferenceDialogComponent.css";
import {FrameScaling, RenderConfigStore} from "stores/RenderConfigStore";

// Static assets
import allMaps from "static/allmaps.png";
// Equation PNG images
import linearPng from "static/equations/linear.png";
import logPng from "static/equations/log.png";
import sqrtPng from "static/equations/sqrt.png";
import squaredPng from "static/equations/squared.png";
import gammaPng from "static/equations/gamma.png";
import powerPng from "static/equations/power.png";

const equationPngMap = new Map([
    [FrameScaling.LINEAR, linearPng],
    [FrameScaling.LOG, logPng],
    [FrameScaling.SQRT, sqrtPng],
    [FrameScaling.SQUARE, squaredPng],
    [FrameScaling.GAMMA, gammaPng],
    [FrameScaling.POWER, powerPng]
]);

const ScalingSelect = Select.ofType<FrameScaling>();
const SCALING_KEYS = Array.from(RenderConfigStore.SCALING_TYPES.keys());
const SCALING_POPOVER_PROPS: Partial<IPopoverProps> = {minimal: true, position: "auto-end", popoverClassName: "colormap-select-popover"};

@observer
export class PreferenceDialogComponent extends React.Component<{ appStore: AppStore }> {
    renderScalingSelectItem = (scaling: FrameScaling, {handleClick, modifiers, query}) => {
        if (!modifiers.matchesPredicate || !RenderConfigStore.SCALING_TYPES.has(scaling)) {
            return null;
        }
        return (
            <MenuItem
                active={modifiers.active}
                disabled={modifiers.disabled}
                label={RenderConfigStore.SCALING_TYPES.get(scaling)}
                key={scaling}
                onClick={handleClick}
                text={<div className="equation-div" style={{backgroundImage: `url(${equationPngMap.get(scaling)}`}}/>}
            />
        );
    };

    public render() {
        const appStore = this.props.appStore;
        const preferenceStore = appStore.preferencesStore;

        const globalPanel = (
            <div className="panel-container">
                <FormGroup inline={true} label="Theme"></FormGroup>
            </div>
        );

        const renderConfigPanel = (
            <div className="panel-container">
                <FormGroup inline={true} label="Scaling">
                    <ScalingSelect
                        activeItem={preferenceStore.scaling}
                        popoverProps={SCALING_POPOVER_PROPS}
                        filterable={false}
                        items={SCALING_KEYS}
                        onItemSelect={preferenceStore.setScaling}
                        itemRenderer={this.renderScalingSelectItem}
                    >
                        <Button text={preferenceStore.scalingName} rightIcon="double-caret-vertical" alignText={"right"}/>
                    </ScalingSelect>
                </FormGroup>
                <FormGroup inline={true} label="Color map"></FormGroup>
                <FormGroup inline={true} label="Percentile Ranks"></FormGroup>
            </div>
        );

        let className = "preference-dialog";
        if (appStore.darkTheme) {
            className += " bp3-dark";
        }

        const dialogProps: IDialogProps = {
            icon: "heart",
            backdropClassName: "minimal-dialog-backdrop",
            className: className,
            canOutsideClickClose: false,
            lazy: true,
            isOpen: appStore.preferenceDialogVisible,
            onClose: appStore.hidePreferenceDialog,
            title: "Preference",
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
                        <Tab id="renderConfig" title="Render Config" panel={renderConfigPanel}/>
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
