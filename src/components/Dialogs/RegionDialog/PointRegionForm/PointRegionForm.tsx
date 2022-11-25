import * as React from "react";
import {observer} from "mobx-react";
import {Classes, H5, InputGroup, Position, Button, PopoverPosition, MenuItem, Icon} from "@blueprintjs/core";
import {Tooltip2} from "@blueprintjs/popover2";
import {CARTA} from "carta-protobuf";
import * as AST from "ast_wrapper";
import {AppStore, NUMBER_FORMAT_LABEL} from "stores";
import {PointAnnotationStore, RegionCoordinate, RegionStore} from "stores/Frame";
import {Point2D, WCSPoint2D} from "models";
import {closeTo, getFormattedWCSPoint, getPixelValueFromWCS, isWCSStringFormatValid} from "utilities";
import {SafeNumericInput, CoordinateComponent} from "components/Shared";
import "./PointRegionForm.scss";
import {IItemRendererProps, Select} from "@blueprintjs/select";

const KEYCODE_ENTER = 13;

@observer
export class PointRegionForm extends React.Component<{region: RegionStore; wcsInfo: AST.FrameSet}> {
    private static readonly REGION_PIXEL_EPS = 1.0e-3;

    private handleNameChange = ev => {
        this.props.region.setName(ev.currentTarget.value);
    };

    private handleCenterXChange = ev => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }
        const valueString = ev.currentTarget.value;
        const value = parseFloat(valueString);
        const existingValue = this.props.region.center.x;

        if (isFinite(value) && !closeTo(value, existingValue, PointRegionForm.REGION_PIXEL_EPS)) {
            this.props.region.setCenter({x: value, y: this.props.region.center.y});
            return;
        }

        ev.currentTarget.value = existingValue;
    };

    private handleCenterYChange = ev => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }
        const valueString = ev.currentTarget.value;
        const value = parseFloat(valueString);
        const existingValue = this.props.region.center.y;

        if (isFinite(value) && !closeTo(value, existingValue, PointRegionForm.REGION_PIXEL_EPS)) {
            this.props.region.setCenter({x: this.props.region.center.x, y: value});
            return;
        }

        ev.currentTarget.value = existingValue;
    };

    private handleCenterWCSXChange = ev => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }
        const centerWCSPoint = getFormattedWCSPoint(this.props.wcsInfo, this.props.region.center);
        if (!centerWCSPoint) {
            return;
        }
        const wcsString = ev.currentTarget.value;
        if (wcsString === centerWCSPoint.x) {
            return;
        }
        if (isWCSStringFormatValid(wcsString, AppStore.Instance.overlayStore.numbers.formatTypeX)) {
            const newPoint = getPixelValueFromWCS(this.props.wcsInfo, {x: wcsString, y: centerWCSPoint.y});
            const existingValue = this.props.region.center.x;
            if (newPoint && isFinite(newPoint.x) && !closeTo(newPoint.x, existingValue, PointRegionForm.REGION_PIXEL_EPS)) {
                this.props.region.setCenter(newPoint);
                return;
            }
        }

        ev.currentTarget.value = centerWCSPoint.x;
    };

    private handleCenterWCSYChange = ev => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }
        const centerWCSPoint = getFormattedWCSPoint(this.props.wcsInfo, this.props.region.center);
        if (!centerWCSPoint) {
            return;
        }
        const wcsString = ev.currentTarget.value;
        if (wcsString === centerWCSPoint.y) {
            return;
        }
        if (isWCSStringFormatValid(wcsString, AppStore.Instance.overlayStore.numbers.formatTypeY)) {
            const newPoint = getPixelValueFromWCS(this.props.wcsInfo, {x: centerWCSPoint.x, y: wcsString});
            const existingValue = this.props.region.center.y;
            if (newPoint && isFinite(newPoint.y) && !closeTo(newPoint.y, existingValue, PointRegionForm.REGION_PIXEL_EPS)) {
                this.props.region.setCenter(newPoint);
                return;
            }
        }

        ev.currentTarget.value = centerWCSPoint.y;
    };

    private IconWrapper = (path: React.SVGProps<SVGPathElement>, color: string, fill: boolean, strokeWidth = 2, viewboxDefault = 16) => {
        let fillColor = color;
        if (!fill) {
            fillColor = "none";
        }
        return (
            <span className="bp3-icon">
                <svg data-icon="triangle-up-open" width="16" height="16" viewBox={`0 0 ${viewboxDefault} ${viewboxDefault}`} style={{stroke: color, fill: fillColor, strokeWidth: strokeWidth}}>
                    {path}
                </svg>
            </span>
        );
    };

    private renderShapePopOver = (shape: CARTA.PointAnnotationShape, itemProps: IItemRendererProps) => {
        const shapeItem = this.getPointShape(shape);
        return <MenuItem icon={shapeItem} key={shape} onClick={itemProps.handleClick} active={itemProps.modifiers.active} />;
    };

    private getPointShape = (shape: CARTA.PointAnnotationShape) => {
        const square = <path d="M 2 2 L 14 2 L 14 14 L 2 14 Z" />;
        const rhomb = <path d="M 8 14 L 14 8 L 8 2 L 2 8 Z" />;
        const color = this.props.region.color;
        switch (shape) {
            case CARTA.PointAnnotationShape.SQUARE:
                return this.IconWrapper(square, color, true);
            case CARTA.PointAnnotationShape.BOX:
                return <Icon icon="square" color={color} />;
            case CARTA.PointAnnotationShape.CIRCLE:
                return <Icon icon="full-circle" color={color} />;
            case CARTA.PointAnnotationShape.CIRCLE_LINED:
                return <Icon icon="circle" color={color} />;
            case CARTA.PointAnnotationShape.DIAMOND:
                return this.IconWrapper(rhomb, color, true);
            case CARTA.PointAnnotationShape.DIAMOND_LINED:
                return this.IconWrapper(rhomb, color, false);
            case CARTA.PointAnnotationShape.CROSS:
                return <Icon icon="plus" color={color} />;
            case CARTA.PointAnnotationShape.X:
                return <Icon icon="cross" color={color} />;
            default:
                return <Icon icon="square" color={color} />;
        }
    };

    public render() {
        // dummy variables related to wcs to trigger re-render
        // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
        const system = AppStore.Instance.overlayStore.global.explicitSystem;
        const formatX = AppStore.Instance.overlayStore.numbers.formatTypeX;
        const formatY = AppStore.Instance.overlayStore.numbers.formatTypeY;
        const region = this.props.region as PointAnnotationStore;
        if (!region || (region.regionType !== CARTA.RegionType.POINT && region.regionType !== CARTA.RegionType.ANNPOINT)) {
            return null;
        }

        const centerPoint = region.center;
        const centerWCSPoint = getFormattedWCSPoint(this.props.wcsInfo, centerPoint);
        let xInput, yInput;
        if (region.coordinate === RegionCoordinate.Image) {
            xInput = <SafeNumericInput selectAllOnFocus={true} buttonPosition="none" placeholder="X Coordinate" value={centerPoint.x} onBlur={this.handleCenterXChange} onKeyDown={this.handleCenterXChange} />;
            yInput = <SafeNumericInput selectAllOnFocus={true} buttonPosition="none" placeholder="Y Coordinate" value={centerPoint.y} onBlur={this.handleCenterYChange} onKeyDown={this.handleCenterYChange} />;
        } else {
            xInput = (
                <Tooltip2 content={`Format: ${NUMBER_FORMAT_LABEL.get(formatX)}`} position={Position.BOTTOM} hoverOpenDelay={300}>
                    <SafeNumericInput
                        allowNumericCharactersOnly={false}
                        buttonPosition="none"
                        placeholder="X WCS Coordinate"
                        disabled={!this.props.wcsInfo || !centerWCSPoint}
                        value={centerWCSPoint ? centerWCSPoint.x : ""}
                        onBlur={this.handleCenterWCSXChange}
                        onKeyDown={this.handleCenterWCSXChange}
                    />
                </Tooltip2>
            );
            yInput = (
                <Tooltip2 content={`Format: ${NUMBER_FORMAT_LABEL.get(formatY)}`} position={Position.BOTTOM} hoverOpenDelay={300}>
                    <SafeNumericInput
                        allowNumericCharactersOnly={false}
                        buttonPosition="none"
                        placeholder="Y WCS Coordinate"
                        disabled={!this.props.wcsInfo || !centerWCSPoint}
                        value={centerWCSPoint ? centerWCSPoint.y : ""}
                        onBlur={this.handleCenterWCSYChange}
                        onKeyDown={this.handleCenterWCSYChange}
                    />
                </Tooltip2>
            );
        }
        const infoString = region.coordinate === RegionCoordinate.Image ? `WCS: ${WCSPoint2D.ToString(centerWCSPoint)}` : `Image: ${Point2D.ToString(centerPoint, "px", 3)}`;
        const pxUnitSpan = region.coordinate === RegionCoordinate.Image ? <span className={Classes.TEXT_MUTED}>(px)</span> : "";
        return (
            <div className="form-section point-region-form">
                <H5>Properties</H5>
                <div className="form-contents">
                    <table>
                        <tbody>
                            <tr>
                                <td>{region.isAnnotation ? "Annotation" : "Region"} Name</td>
                                <td colSpan={2}>
                                    <InputGroup placeholder={region.isAnnotation ? "Enter an annotation name" : "Enter a region name"} value={region.name} onChange={this.handleNameChange} />
                                </td>
                            </tr>
                            {region.regionType === CARTA.RegionType.ANNPOINT && (
                                <>
                                    <tr>
                                        <td>Point Shape</td>
                                        <td>
                                            <Select
                                                className="bp3-fill"
                                                filterable={false}
                                                items={Object.values(CARTA.PointAnnotationShape)}
                                                activeItem={region.pointShape}
                                                onItemSelect={item => region.setPointShape(item as CARTA.PointAnnotationShape)}
                                                itemRenderer={this.renderShapePopOver}
                                                popoverProps={{popoverClassName: "catalog-select", minimal: true, position: PopoverPosition.AUTO_END}}
                                            >
                                                <Button icon={this.getPointShape(region.pointShape)} rightIcon="double-caret-vertical" />
                                            </Select>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>Point Width</td>
                                        <td>
                                            <SafeNumericInput placeholder="Point Width" min={0.5} max={50} value={region.pointWidth} stepSize={0.5} onValueChange={width => region.setPointWidth(width)} />
                                        </td>
                                    </tr>
                                </>
                            )}
                            <tr>
                                <td>Coordinate</td>
                                <td colSpan={2}>
                                    <CoordinateComponent region={region} disableCoordinate={!this.props.wcsInfo} />
                                </td>
                            </tr>
                            <tr>
                                <td>Center {pxUnitSpan}</td>
                                <td>{xInput}</td>
                                <td>{yInput}</td>
                                <td>
                                    <span className="info-string">{infoString}</span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }
}
