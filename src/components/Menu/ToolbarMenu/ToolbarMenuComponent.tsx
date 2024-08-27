import * as React from "react";
import {AnchorButton, ButtonGroup, Classes, Menu, Popover, Position, Tooltip} from "@blueprintjs/core";
import {IconName} from "@blueprintjs/icons";
import {CARTA} from "carta-protobuf";
import classNames from "classnames";
import {observer} from "mobx-react";

import {ImageViewLayer} from "components";
import {AnnotationMenuComponent} from "components/Shared";
import {CustomIcon, CustomIconName} from "icons/CustomIcons";
import {RegionCreationMode} from "models";
import {AppStore, DialogId, WidgetsStore, WidgetType} from "stores";
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

        const className = classNames("toolbar-menu", {[Classes.DARK]: appStore.darkTheme});
        const dialogClassName = classNames("dialog-toolbar-menu", {[Classes.DARK]: appStore.darkTheme});
        const actionsClassName = classNames("actions-toolbar-menu", {[Classes.DARK]: appStore.darkTheme});
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

        const annotationMenu = (
            <Menu>
                <AnnotationMenuComponent handleRegionTypeClicked={this.handleRegionTypeClicked} />
            </Menu>
        );

        return (
            <React.Fragment>
                <ButtonGroup className={actionsClassName}>
                    {Array.from(RegionStore.AVAILABLE_REGION_TYPES.entries()).map(([type, typeString], index) => {
                        const regionIconString: IconName | CustomIconName = RegionStore.RegionIconString(type);
                        const regionIcon = RegionStore.IsRegionCustomIcon(type) ? <CustomIcon icon={regionIconString as CustomIconName} /> : (regionIconString as IconName);
                        return (
                            <Tooltip content={this.regionTooltip(type)} position={Position.BOTTOM} key={index}>
                                <AnchorButton
                                    icon={regionIcon}
                                    onClick={() => this.handleRegionTypeClicked(type)}
                                    active={isRegionCreating && newRegionType === type}
                                    disabled={regionButtonsDisabled}
                                    data-testid={typeString.toLowerCase() + "-region-shortcut-button"}
                                />
                            </Tooltip>
                        );
                    })}

                    <Popover content={annotationMenu} position={Position.BOTTOM_LEFT} minimal={true} disabled={regionButtonsDisabled}>
                        <Tooltip
                            content={
                                <span>
                                    Annotation <br /> <small>Click to select annotation type.</small>
                                </span>
                            }
                            position={Position.BOTTOM}
                        >
                            <AnchorButton icon={"annotation"} disabled={regionButtonsDisabled} active={isRegionCreating === true && appStore.activeFrame.regionSet.isNewRegionAnnotation === true} data-testid="annotation-shortcut-dropdown" />
                        </Tooltip>
                    </Popover>
                </ButtonGroup>
                <ButtonGroup className={className}>
                    {Array.from(WidgetsStore.Instance.CARTAWidgets.keys()).map(widgetType => {
                        const widgetConfig = WidgetsStore.Instance.CARTAWidgets.get(widgetType);
                        const trimmedStr = widgetType?.replace(/\s+/g, "");
                        const lowerCaseStart = widgetType === WidgetType.PvGenerator ? 2 : 1;
                        const widgetTypeTooltip = widgetType?.slice(0, lowerCaseStart) + widgetType?.slice(lowerCaseStart)?.toLowerCase();
                        return (
                            <Tooltip
                                key={`${trimmedStr}Tooltip`}
                                content={
                                    <span>
                                        {widgetTypeTooltip}
                                        {commonTooltip}
                                    </span>
                                }
                            >
                                <AnchorButton
                                    icon={widgetConfig.isCustomIcon ? <CustomIcon icon={widgetConfig.icon as CustomIconName} /> : (widgetConfig.icon as IconName)}
                                    id={`${trimmedStr}Button`} // id particularly is for drag source in WidgetStore
                                    onClick={widgetConfig.onClick}
                                />
                            </Tooltip>
                        );
                    })}
                </ButtonGroup>
                <ButtonGroup className={dialogClassName}>
                    <Tooltip content={<span>File header</span>} position={Position.BOTTOM}>
                        <AnchorButton
                            icon={"app-header"}
                            disabled={!appStore.activeFrame}
                            onClick={() => dialogStore.showDialog(DialogId.FileInfo)}
                            active={dialogStore.dialogVisible.get(DialogId.FileInfo)}
                            data-testid={DialogId.FileInfo + "-button"}
                        />
                    </Tooltip>
                    <Tooltip content={<span>Preferences</span>} position={Position.BOTTOM}>
                        <AnchorButton icon={"wrench"} onClick={() => dialogStore.showDialog(DialogId.Preference)} active={dialogStore.dialogVisible.get(DialogId.Preference)} data-testid={DialogId.Preference + "-button"} />
                    </Tooltip>
                    <Tooltip content={<span>Contours</span>} position={Position.BOTTOM}>
                        <AnchorButton
                            icon={<CustomIcon icon={"contour"} />}
                            disabled={!appStore.activeFrame}
                            onClick={() => dialogStore.showDialog(DialogId.Contour)}
                            active={dialogStore.dialogVisible.get(DialogId.Contour)}
                            data-testid={DialogId.Contour + "-button"}
                        />
                    </Tooltip>
                    <Tooltip content={<span>Vector overlay</span>} position={Position.BOTTOM}>
                        <AnchorButton
                            icon={<CustomIcon icon={"vectorOverlay"} />}
                            disabled={!appStore.activeFrame}
                            onClick={() => dialogStore.showDialog(DialogId.Vector)}
                            active={dialogStore.dialogVisible.get(DialogId.Vector)}
                            data-testid={DialogId.Vector + "-button"}
                        />
                    </Tooltip>
                    <Tooltip content={<span>Image fitting</span>} position={Position.BOTTOM}>
                        <AnchorButton
                            icon={<CustomIcon icon="imageFitting" />}
                            disabled={!appStore.activeFrame}
                            onClick={() => dialogStore.showDialog(DialogId.Fitting)}
                            active={dialogStore.dialogVisible.get(DialogId.Fitting)}
                            data-testid={DialogId.Fitting + "-button"}
                        />
                    </Tooltip>
                    <Tooltip content={<span>Online data query</span>} position={Position.BOTTOM}>
                        <AnchorButton icon="geosearch" onClick={() => dialogStore.showDialog(DialogId.OnlineDataQuery)} active={dialogStore.dialogVisible.get(DialogId.OnlineDataQuery)} data-testid={DialogId.OnlineDataQuery + "-button"} />
                    </Tooltip>
                    {appStore.preferenceStore.codeSnippetsEnabled && (
                        <Tooltip
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
                            <AnchorButton icon={"console"} onClick={() => appStore.dialogStore.showDialog(DialogId.Snippet)} active={dialogStore.dialogVisible.get(DialogId.Snippet)} />
                        </Tooltip>
                    )}
                </ButtonGroup>
            </React.Fragment>
        );
    }
}
