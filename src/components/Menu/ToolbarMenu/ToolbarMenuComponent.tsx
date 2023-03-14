import * as React from "react";
import {AnchorButton, ButtonGroup, Position} from "@blueprintjs/core";
import {IconName} from "@blueprintjs/icons";
import {Tooltip2} from "@blueprintjs/popover2";
import {CARTA} from "carta-protobuf";
import classNames from "classnames";
import {observer} from "mobx-react";

import {ImageViewLayer} from "components";
import {CustomIcon, CustomIconName} from "icons/CustomIcons";
import {RegionCreationMode} from "models";
import {AppStore, WidgetsStore} from "stores";
import {RegionMode, RegionStore} from "stores/Frame";

import "./ToolbarMenuComponent.scss";

@observer
export class ToolbarMenuComponent extends React.Component {
    handleRegionTypeClicked = (type: CARTA.RegionType) => {
        const appStore = AppStore.Instance;
        appStore.updateActiveLayer(ImageViewLayer.RegionCreating);
        appStore.activeFrame.regionSet.setNewRegionType(type);
        appStore.activeFrame.regionSet.setMode(RegionMode.CREATING);
    };

    handleDistanceMeasuringClicked = () => {
        const appStore = AppStore.Instance;
        appStore.dialogStore.showDistanceMeasuringDialog();
        const layer = ImageViewLayer.DistanceMeasuring;
        if (appStore.activeLayer !== ImageViewLayer.DistanceMeasuring && layer === ImageViewLayer.DistanceMeasuring) {
            appStore.frames.forEach(frame => frame.distanceMeasuring.resetPos());
        }
        appStore.updateActiveLayer(layer);
        appStore.activeFrame.regionSet.setMode(RegionMode.MOVING);
    };

    regionTooltip = (type: CARTA.RegionType) => {
        const regionModeIsCenter = AppStore.Instance.preferenceStore.regionCreationMode === RegionCreationMode.CENTER;
        let tooltip = null;
        switch (type) {
            case CARTA.RegionType.RECTANGLE:
            case CARTA.RegionType.ELLIPSE:
            case CARTA.RegionType.LINE:
                tooltip = (
                    <small>
                        Click-and-drag to define a region ({regionModeIsCenter ? "center to corner" : "corner to corner"}).
                        <br />
                        Hold Ctrl/Cmd to define a region ({regionModeIsCenter ? "corner to corner" : "center to corner"}).
                        <br />
                        Change the default creation mode in Preferences.
                        <br />
                        {type === CARTA.RegionType.LINE ? "" : `Hold shift key to create a ${type === CARTA.RegionType.RECTANGLE ? "square" : "circle"}.`}
                    </small>
                );
                break;
            case CARTA.RegionType.POLYGON:
            case CARTA.RegionType.POLYLINE:
                tooltip = (
                    <small>
                        Define control points with a series of clicks.
                        <br />
                        Double-click to {type === CARTA.RegionType.POLYLINE ? "" : "close the loop and"} finish creation.
                        <br />
                        Double-click on a control point to delete it.
                        <br />
                        Click on a side to create a new control point.
                    </small>
                );
                break;
            default:
                break;
        }

        return (
            <span>
                {RegionStore.RegionTypeString(type)}
                <span>
                    <br />
                    <i>{tooltip}</i>
                </span>
            </span>
        );
    };

    public render() {
        const appStore = AppStore.Instance;
        const dialogStore = appStore.dialogStore;

        const className = classNames("toolbar-menu", {"bp3-dark": appStore.darkTheme});
        const dialogClassName = classNames("dialog-toolbar-menu", {"bp3-dark": appStore.darkTheme});
        const actionsClassName = classNames("actions-toolbar-menu", {"bp3-dark": appStore.darkTheme});
        const isRegionCreating = appStore.activeFrame ? appStore.activeFrame.regionSet.mode === RegionMode.CREATING : false;
        const newRegionType = appStore.activeFrame ? appStore.activeFrame.regionSet.newRegionType : CARTA.RegionType.RECTANGLE;
        const regionButtonsDisabled = !appStore.activeFrame || appStore.activeLayer === ImageViewLayer.Catalog;

        const commonTooltip = (
            <span>
                <br />
                <i>
                    <small>
                        Drag to place docked widget
                        <br />
                        Click to place a floating widget
                    </small>
                </i>
            </span>
        );
        return (
            <React.Fragment>
                <ButtonGroup className={actionsClassName}>
                    {Array.from(RegionStore.AVAILABLE_REGION_TYPES.keys()).map((type, index) => {
                        const regionIconString: IconName | CustomIconName = RegionStore.RegionIconString(type);
                        const regionIcon = RegionStore.IsRegionCustomIcon(type) ? <CustomIcon icon={regionIconString as CustomIconName} /> : (regionIconString as IconName);
                        return (
                            <Tooltip2 content={this.regionTooltip(type)} position={Position.BOTTOM} key={index}>
                                <AnchorButton icon={regionIcon} onClick={() => this.handleRegionTypeClicked(type)} active={isRegionCreating && newRegionType === type} disabled={regionButtonsDisabled} />
                            </Tooltip2>
                        );
                    })}
                </ButtonGroup>
                <ButtonGroup className={className}>
                    {Array.from(WidgetsStore.Instance.CARTAWidgets.keys()).map(widgetType => {
                        const widgetConfig = WidgetsStore.Instance.CARTAWidgets.get(widgetType);
                        const trimmedStr = widgetType.replace(/\s+/g, "");
                        return (
                            <Tooltip2
                                key={`${trimmedStr}Tooltip`}
                                content={
                                    <span>
                                        {widgetType}
                                        {commonTooltip}
                                    </span>
                                }
                            >
                                <AnchorButton
                                    icon={widgetConfig.isCustomIcon ? <CustomIcon icon={widgetConfig.icon as CustomIconName} /> : (widgetConfig.icon as IconName)}
                                    id={`${trimmedStr}Button`} // id particularly is for drag source in WidgetStore
                                    onClick={widgetConfig.onClick}
                                />
                            </Tooltip2>
                        );
                    })}
                </ButtonGroup>
                <ButtonGroup className={dialogClassName}>
                    <Tooltip2 content={<span>File header</span>} position={Position.BOTTOM}>
                        <AnchorButton icon={"app-header"} onClick={dialogStore.showFileInfoDialog} active={dialogStore.fileInfoDialogVisible} />
                    </Tooltip2>
                    <Tooltip2 content={<span>Preferences</span>} position={Position.BOTTOM}>
                        <AnchorButton icon={"wrench"} onClick={dialogStore.showPreferenceDialog} active={dialogStore.preferenceDialogVisible} />
                    </Tooltip2>
                    <Tooltip2 content={<span>Contours</span>} position={Position.BOTTOM}>
                        <AnchorButton icon={<CustomIcon icon={"contour"} />} onClick={dialogStore.showContourDialog} active={dialogStore.contourDialogVisible} />
                    </Tooltip2>
                    <Tooltip2 content={<span>Vector overlay</span>} position={Position.BOTTOM}>
                        <AnchorButton icon={<CustomIcon icon={"vectorOverlay"} />} onClick={dialogStore.showVectorOverlayDialog} active={dialogStore.vectorOverlayDialogVisible} />
                    </Tooltip2>
                    <Tooltip2 content={<span>Image fitting</span>} position={Position.BOTTOM}>
                        <AnchorButton icon={<CustomIcon icon="imageFitting" />} onClick={dialogStore.showFittingDialog} active={dialogStore.fittingDialogVisible} />
                    </Tooltip2>
                    <Tooltip2 content={<span>Online catalog query</span>} position={Position.BOTTOM}>
                        <AnchorButton icon="geosearch" onClick={dialogStore.showCatalogQueryDialog} active={dialogStore.catalogQueryDialogVisible} />
                    </Tooltip2>
                    <Tooltip2 content={<span>Distance measurement</span>} position={Position.BOTTOM}>
                        <AnchorButton icon={<CustomIcon icon="distanceMeasuring" />} active={dialogStore.distanceMeasuringDialogVisible} onClick={this.handleDistanceMeasuringClicked} />
                    </Tooltip2>
                    {appStore.preferenceStore.codeSnippetsEnabled && (
                        <Tooltip2
                            content={
                                <span>
                                    Code snippets
                                    <span>
                                        <br />
                                        <i>
                                            <small>
                                                Use to save, load or run small code snippets,
                                                <br />
                                                providing additional functionality to CARTA.
                                                <br />
                                                Warning: Use at own risk!
                                            </small>
                                        </i>
                                    </span>
                                </span>
                            }
                            position={Position.BOTTOM}
                        >
                            <AnchorButton icon={"console"} onClick={appStore.dialogStore.showCodeSnippetDialog} active={dialogStore.codeSnippetDialogVisible} />
                        </Tooltip2>
                    )}
                </ButtonGroup>
            </React.Fragment>
        );
    }
}
