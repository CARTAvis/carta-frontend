import * as React from "react";
import {observer} from "mobx-react";
import {computed} from "mobx";
import {Classes, FormGroup, H5, InputGroup, Position} from "@blueprintjs/core";
import {Tooltip2} from "@blueprintjs/popover2";
import {CARTA} from "carta-protobuf";
import * as AST from "ast_wrapper";
import {AppStore, NUMBER_FORMAT_LABEL} from "stores";
import {FrameStore, RegionCoordinate, RegionStore, VectorAnnotationStore, WCS_PRECISION} from "stores/Frame";
import {Point2D, WCSPoint2D} from "models";
import {closeTo, formattedArcsec, getFormattedWCSPoint, getPixelValueFromWCS, getValueFromArcsecString, isWCSStringFormatValid, length2D} from "utilities";
import {SafeNumericInput, CoordinateComponent} from "components/Shared";
import "./LineRegionForm.scss";

const KEYCODE_ENTER = 13;

@observer
export class LineRegionForm extends React.Component<{region: RegionStore; frame: FrameStore; wcsInfo: AST.FrameSet}> {
    @computed get startPoint(): Point2D {
        const region = this.props.region;
        if (!region || region.controlPoints.length !== 2) {
            return {x: NaN, y: NaN};
        }

        return {x: region.controlPoints[0].x, y: region.controlPoints[0].y};
    }

    @computed get endPoint(): Point2D {
        const region = this.props.region;
        if (!region || region.controlPoints.length !== 2) {
            return {x: NaN, y: NaN};
        }

        return {x: region.controlPoints[1].x, y: region.controlPoints[1].y};
    }

    // size determined by reference frame
    @computed get lengthWCS(): string {
        const region = this.props.region;
        if (!region || region.controlPoints.length !== 2 || !region.size || !this.props.frame) {
            return null;
        }
        const size = this.props.region.size;
        const wcsSize = this.props.frame.getWcsSizeInArcsec(size);
        if (wcsSize) {
            return formattedArcsec(length2D(wcsSize), WCS_PRECISION);
        }
        return null;
    }

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

        if (isFinite(value) && !closeTo(value, existingValue, LineRegionForm.REGION_PIXEL_EPS)) {
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

        if (isFinite(value) && !closeTo(value, existingValue, LineRegionForm.REGION_PIXEL_EPS)) {
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
            if (newPoint && isFinite(newPoint.x) && !closeTo(newPoint.x, existingValue, LineRegionForm.REGION_PIXEL_EPS)) {
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
            if (newPoint && isFinite(newPoint.y) && !closeTo(newPoint.y, existingValue, LineRegionForm.REGION_PIXEL_EPS)) {
                this.props.region.setCenter(newPoint);
                return;
            }
        }

        ev.currentTarget.value = centerWCSPoint.y;
    };

    private handleLengthChange = ev => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }
        const valueString = ev.currentTarget.value;
        const value = parseFloat(valueString);
        const existingValue = length2D(this.props.region.size);

        if (isFinite(value) && value > 0 && !closeTo(value, existingValue, LineRegionForm.REGION_PIXEL_EPS)) {
            const region = this.props.region;
            const rotation = (region.rotation * Math.PI) / 180.0;
            // the rotation angle is defined to be 0 at North (mostly in +y axis) and increases counter-clockwisely. This is
            // different from the usual definition in math where 0 degree is in the +x axis. The extra 90-degree offset swaps
            // cos and sin with a proper +/-1 constant applied.
            region.setSize({x: value * Math.sin(rotation), y: -1 * value * Math.cos(rotation)});
            return;
        }

        ev.currentTarget.value = existingValue;
    };

    private handleLengthWCSChange = ev => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }
        if (!this.lengthWCS) {
            return;
        }
        const wcsString = ev.currentTarget.value;
        if (wcsString === this.lengthWCS) {
            return;
        }
        const existingValue = length2D(this.props.region.size);
        const value = (existingValue * getValueFromArcsecString(wcsString)) / length2D(this.props.frame.getWcsSizeInArcsec(this.props.region.size));
        if (isFinite(value) && value > 0 && !closeTo(value, existingValue, LineRegionForm.REGION_PIXEL_EPS)) {
            const region = this.props.region;
            const rotation = (region.rotation * Math.PI) / 180.0;
            // the rotation angle is defined to be 0 at North (mostly in +y axis) and increases counter-clockwisely. This is
            // different from the usual definition in math where 0 degree is in the +x axis. The extra 90-degree offset swaps
            // cos and sin with a proper +/-1 constant applied.
            region.setSize({x: value * Math.sin(rotation), y: -1 * value * Math.cos(rotation)});
            return;
        }

        ev.currentTarget.value = this.lengthWCS;
    };

    private handleStartXValueChange = (value: number, existingValue: number): boolean => {
        if (isFinite(value) && isFinite(existingValue) && !closeTo(value, existingValue, LineRegionForm.REGION_PIXEL_EPS)) {
            const region = this.props.region;
            const newDims = {x: Math.abs(value - region.controlPoints[1].x), y: region.size.y};
            if (newDims.x > 0 || newDims.y > 0) {
                region.setControlPoint(0, {x: value, y: region.controlPoints[0].y});
                return true;
            }
        }
        return false;
    };

    private handleStartXChange = ev => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }
        const valueString = ev.currentTarget.value;
        const value = parseFloat(valueString);
        const existingValue = this.startPoint.x;
        if (this.handleStartXValueChange(value, existingValue)) {
            return;
        }

        ev.currentTarget.value = existingValue;
    };

    private handleStartXWCSChange = ev => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }
        const startWCSPoint = getFormattedWCSPoint(this.props.wcsInfo, this.startPoint);
        const wcsString = ev.currentTarget.value;
        if (wcsString === startWCSPoint.x) {
            return;
        }
        if (isWCSStringFormatValid(wcsString, AppStore.Instance.overlayStore.numbers.formatTypeX)) {
            const newPoint = getPixelValueFromWCS(this.props.wcsInfo, {x: wcsString, y: startWCSPoint.y});
            const value = newPoint.x;
            const existingValue = this.startPoint.x;
            if (this.handleStartXValueChange(value, existingValue)) {
                return;
            }
        }

        ev.currentTarget.value = startWCSPoint.x;
    };

    private handleStartYValueChange = (value: number, existingValue: number): boolean => {
        if (isFinite(value) && isFinite(existingValue) && !closeTo(value, existingValue, LineRegionForm.REGION_PIXEL_EPS)) {
            const region = this.props.region;
            const newDims = {x: region.size.x, y: Math.abs(value - region.controlPoints[1].y)};
            if (newDims.x > 0 || newDims.y > 0) {
                region.setControlPoint(0, {x: region.controlPoints[0].x, y: value});
                return true;
            }
        }
        return false;
    };

    private handleStartYChange = ev => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }
        const valueString = ev.currentTarget.value;
        const value = parseFloat(valueString);
        const existingValue = this.startPoint.y;
        if (this.handleStartYValueChange(value, existingValue)) {
            return;
        }

        ev.currentTarget.value = existingValue;
    };

    private handleStartYWCSChange = ev => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }
        const startWCSPoint = getFormattedWCSPoint(this.props.wcsInfo, this.startPoint);
        const wcsString = ev.currentTarget.value;
        if (wcsString === startWCSPoint.y) {
            return;
        }
        if (isWCSStringFormatValid(wcsString, AppStore.Instance.overlayStore.numbers.formatTypeY)) {
            const newPoint = getPixelValueFromWCS(this.props.wcsInfo, {x: startWCSPoint.x, y: wcsString});
            const value = newPoint.y;
            const existingValue = this.startPoint.y;
            if (this.handleStartYValueChange(value, existingValue)) {
                return;
            }
        }

        ev.currentTarget.value = startWCSPoint.y;
    };

    private handleEndXValueChange = (value: number, existingValue: number): boolean => {
        if (isFinite(value) && isFinite(existingValue) && !closeTo(value, existingValue, LineRegionForm.REGION_PIXEL_EPS)) {
            const region = this.props.region;
            const newDims = {x: Math.abs(value - region.controlPoints[0].x), y: region.size.y};
            if (newDims.x > 0 || newDims.y > 0) {
                region.setControlPoint(1, {x: value, y: region.controlPoints[1].y});
                return true;
            }
        }
        return false;
    };

    private handleEndXChange = ev => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }
        const valueString = ev.currentTarget.value;
        const value = parseFloat(valueString);
        const existingValue = this.endPoint.x;
        if (this.handleEndXValueChange(value, existingValue)) {
            return;
        }

        ev.currentTarget.value = existingValue;
    };

    private handleEndXWCSChange = ev => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }
        const endWCSPoint = getFormattedWCSPoint(this.props.wcsInfo, this.endPoint);
        const wcsString = ev.currentTarget.value;
        if (wcsString === endWCSPoint.x) {
            return;
        }
        if (isWCSStringFormatValid(wcsString, AppStore.Instance.overlayStore.numbers.formatTypeX)) {
            const newPoint = getPixelValueFromWCS(this.props.wcsInfo, {x: wcsString, y: endWCSPoint.y});
            const value = newPoint.x;
            const existingValue = this.endPoint.x;
            if (this.handleEndXValueChange(value, existingValue)) {
                return;
            }
        }

        ev.currentTarget.value = endWCSPoint.x;
    };

    private handleEndYValueChange = (value: number, existingValue: number): boolean => {
        if (isFinite(value) && isFinite(existingValue) && !closeTo(value, existingValue, LineRegionForm.REGION_PIXEL_EPS)) {
            const region = this.props.region;
            const newDims = {x: region.size.x, y: Math.abs(value - region.controlPoints[0].y)};
            if (newDims.x > 0 || newDims.y > 0) {
                region.setControlPoint(1, {x: region.controlPoints[1].x, y: value});
                return true;
            }
        }
        return false;
    };

    private handleEndYChange = ev => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }
        const valueString = ev.currentTarget.value;
        const value = parseFloat(valueString);
        const existingValue = this.endPoint.y;
        if (this.handleEndYValueChange(value, existingValue)) {
            return;
        }

        ev.currentTarget.value = existingValue;
    };

    private handleEndYWCSChange = ev => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }
        const endWCSPoint = getFormattedWCSPoint(this.props.wcsInfo, this.endPoint);
        const wcsString = ev.currentTarget.value;
        if (wcsString === endWCSPoint.y) {
            return;
        }
        if (isWCSStringFormatValid(wcsString, AppStore.Instance.overlayStore.numbers.formatTypeY)) {
            const newPoint = getPixelValueFromWCS(this.props.wcsInfo, {x: endWCSPoint.x, y: wcsString});
            const value = newPoint.y;
            const existingValue = this.endPoint.y;
            if (this.handleEndYValueChange(value, existingValue)) {
                return;
            }
        }

        ev.currentTarget.value = endWCSPoint.y;
    };

    private handleRotationChange = ev => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }
        const valueString = ev.currentTarget.value;
        const value = parseFloat(valueString);
        const existingValue = this.props.region.rotation;

        if (isFinite(value) && !closeTo(value, existingValue, LineRegionForm.REGION_PIXEL_EPS)) {
            this.props.region.setRotation(value);
            return;
        }

        ev.currentTarget.value = existingValue;
    };

    private vectorArrowTipForm = () => {
        const region = this.props.region as VectorAnnotationStore;

        return (
            <div className="form-section appearance-form">
                <H5>Arrow Pointer</H5>
                <div className="form-contents">
                    <FormGroup inline={true} label="Arrow Tip Length" labelInfo="(px)">
                        <SafeNumericInput placeholder="Length" min={0} max={RegionStore.MAX_DASH_LENGTH} value={region.pointerLength} stepSize={1} onValueChange={value => region.setPointerLength(value)} />
                    </FormGroup>
                    <FormGroup inline={true} label="Arrow Tip Width" labelInfo="(px)">
                        <SafeNumericInput placeholder="Width" min={0} max={RegionStore.MAX_DASH_LENGTH} value={region.pointerWidth} stepSize={1} onValueChange={value => region.setPointerWidth(value)} />
                    </FormGroup>
                </div>
            </div>
        );
    };

    public render() {
        // dummy variables related to wcs to trigger re-render
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const system = AppStore.Instance.overlayStore.global.explicitSystem;
        const formatX = AppStore.Instance.overlayStore.numbers.formatTypeX;
        const formatY = AppStore.Instance.overlayStore.numbers.formatTypeY;
        const region = this.props.region;
        if (!region || region.controlPoints.length !== 2 || (region.regionType !== CARTA.RegionType.LINE && region.regionType !== CARTA.RegionType.ANNLINE && region.regionType !== CARTA.RegionType.ANNVECTOR)) {
            return null;
        }

        // start
        const startWCSPoint = getFormattedWCSPoint(this.props.wcsInfo, this.startPoint);
        let startInputX, startInputY;
        if (region.coordinate === RegionCoordinate.Image) {
            startInputX = <SafeNumericInput selectAllOnFocus={true} buttonPosition="none" placeholder="X Coordinate" value={this.startPoint.x} onBlur={this.handleStartXChange} onKeyDown={this.handleStartXChange} />;
            startInputY = <SafeNumericInput selectAllOnFocus={true} buttonPosition="none" placeholder="Y Coordinate" value={this.startPoint.y} onBlur={this.handleStartYChange} onKeyDown={this.handleStartYChange} />;
        } else {
            startInputX = (
                <Tooltip2 content={`Format: ${NUMBER_FORMAT_LABEL.get(formatX)}`} position={Position.BOTTOM} hoverOpenDelay={300}>
                    <SafeNumericInput
                        allowNumericCharactersOnly={false}
                        buttonPosition="none"
                        placeholder="X WCS Coordinate"
                        disabled={!this.props.wcsInfo || !startWCSPoint}
                        value={startWCSPoint ? startWCSPoint.x : ""}
                        onBlur={this.handleStartXWCSChange}
                        onKeyDown={this.handleStartXWCSChange}
                    />
                </Tooltip2>
            );
            startInputY = (
                <Tooltip2 content={`Format: ${NUMBER_FORMAT_LABEL.get(formatY)}`} position={Position.BOTTOM} hoverOpenDelay={300}>
                    <SafeNumericInput
                        allowNumericCharactersOnly={false}
                        buttonPosition="none"
                        placeholder="Y WCS Coordinate"
                        disabled={!this.props.wcsInfo || !startWCSPoint}
                        value={startWCSPoint ? startWCSPoint.y : ""}
                        onBlur={this.handleStartYWCSChange}
                        onKeyDown={this.handleStartYWCSChange}
                    />
                </Tooltip2>
            );
        }
        const startInfoString = region.coordinate === RegionCoordinate.Image ? `WCS: ${WCSPoint2D.ToString(startWCSPoint)}` : `Image: ${Point2D.ToString(this.startPoint, "px", 3)}`;

        // end
        const endWCSPoint = getFormattedWCSPoint(this.props.wcsInfo, this.endPoint);
        let endInputX, endInputY;
        if (region.coordinate === RegionCoordinate.Image) {
            endInputX = <SafeNumericInput selectAllOnFocus={true} buttonPosition="none" placeholder="X Coordinate" value={this.endPoint.x} onBlur={this.handleEndXChange} onKeyDown={this.handleEndXChange} />;
            endInputY = <SafeNumericInput selectAllOnFocus={true} buttonPosition="none" placeholder="Y Coordinate" value={this.endPoint.y} onBlur={this.handleEndYChange} onKeyDown={this.handleEndYChange} />;
        } else {
            endInputX = (
                <Tooltip2 content={`Format: ${NUMBER_FORMAT_LABEL.get(formatX)}`} position={Position.BOTTOM} hoverOpenDelay={300}>
                    <SafeNumericInput
                        allowNumericCharactersOnly={false}
                        buttonPosition="none"
                        placeholder="X WCS Coordinate"
                        disabled={!this.props.wcsInfo || !endWCSPoint}
                        value={endWCSPoint ? endWCSPoint.x : ""}
                        onBlur={this.handleEndXWCSChange}
                        onKeyDown={this.handleEndXWCSChange}
                    />
                </Tooltip2>
            );
            endInputY = (
                <Tooltip2 content={`Format: ${NUMBER_FORMAT_LABEL.get(formatY)}`} position={Position.BOTTOM} hoverOpenDelay={300}>
                    <SafeNumericInput
                        allowNumericCharactersOnly={false}
                        buttonPosition="none"
                        placeholder="Y WCS Coordinate"
                        disabled={!this.props.wcsInfo || !endWCSPoint}
                        value={endWCSPoint ? endWCSPoint.y : ""}
                        onBlur={this.handleEndYWCSChange}
                        onKeyDown={this.handleEndYWCSChange}
                    />
                </Tooltip2>
            );
        }
        const endInfoString = region.coordinate === RegionCoordinate.Image ? `WCS: ${WCSPoint2D.ToString(endWCSPoint)}` : `Image: ${Point2D.ToString(this.endPoint, "px", 3)}`;

        // center
        const centerPoint = region.center;
        const centerWCSPoint = getFormattedWCSPoint(this.props.wcsInfo, centerPoint);
        let centerInputX, centerInputY;
        if (region.coordinate === RegionCoordinate.Image) {
            centerInputX = <SafeNumericInput selectAllOnFocus={true} buttonPosition="none" placeholder="X Coordinate" value={centerPoint.x} onBlur={this.handleCenterXChange} onKeyDown={this.handleCenterXChange} />;
            centerInputY = <SafeNumericInput selectAllOnFocus={true} buttonPosition="none" placeholder="Y Coordinate" value={centerPoint.y} onBlur={this.handleCenterYChange} onKeyDown={this.handleCenterYChange} />;
        } else {
            centerInputX = (
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
            centerInputY = (
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
        const centerInfoString = region.coordinate === RegionCoordinate.Image ? `WCS: ${WCSPoint2D.ToString(centerWCSPoint)}` : `Image: ${Point2D.ToString(centerPoint, "px", 3)}`;

        // length
        const length = length2D(region.size);
        let lengthInput;
        if (region.coordinate === RegionCoordinate.Image) {
            lengthInput = <SafeNumericInput selectAllOnFocus={true} buttonPosition="none" placeholder="Length" value={length} onBlur={this.handleLengthChange} onKeyDown={this.handleLengthChange} />;
        } else {
            lengthInput = (
                <Tooltip2 content={"Format: arcsec(\"), arcmin('), or degrees(deg)"} position={Position.BOTTOM} hoverOpenDelay={300}>
                    <SafeNumericInput
                        allowNumericCharactersOnly={false}
                        buttonPosition="none"
                        placeholder="Length"
                        disabled={!this.props.wcsInfo}
                        value={this.lengthWCS ? this.lengthWCS : ""}
                        onBlur={this.handleLengthWCSChange}
                        onKeyDown={this.handleLengthWCSChange}
                    />
                </Tooltip2>
            );
        }
        const lengthInfoString = region.coordinate === RegionCoordinate.Image ? `WCS: ${this.lengthWCS}` : `Image: ${length.toFixed(3)} px`;

        const pxUnitSpan = region.coordinate === RegionCoordinate.Image ? <span className={Classes.TEXT_MUTED}>(px)</span> : "";
        return (
            <>
                {region.regionType === CARTA.RegionType.ANNVECTOR && this.vectorArrowTipForm()}
                <div className="form-section line-region-form">
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
                                <tr>
                                    <td>Coordinate</td>
                                    <td colSpan={2}>
                                        <CoordinateComponent region={region} disableCoordinate={!this.props.wcsInfo} />
                                    </td>
                                </tr>
                                <tr>
                                    <td>Start {pxUnitSpan}</td>
                                    <td>{startInputX}</td>
                                    <td>{startInputY}</td>
                                    <td>
                                        <span className="info-string">{startInfoString}</span>
                                    </td>
                                </tr>
                                <tr>
                                    <td>End {pxUnitSpan}</td>
                                    <td>{endInputX}</td>
                                    <td>{endInputY}</td>
                                    <td>
                                        <span className="info-string">{endInfoString}</span>
                                    </td>
                                </tr>
                                <tr>
                                    <td>Center {pxUnitSpan}</td>
                                    <td>{centerInputX}</td>
                                    <td>{centerInputY}</td>
                                    <td>
                                        <span className="info-string">{centerInfoString}</span>
                                    </td>
                                </tr>
                                {this.props.frame?.hasSquarePixels ? (
                                    <React.Fragment>
                                        <tr>
                                            <td>Length {pxUnitSpan}</td>
                                            <td>{lengthInput}</td>
                                            <td></td>
                                            <td>
                                                <span className="info-string">{lengthInfoString}</span>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td>
                                                P.A. <span className={Classes.TEXT_MUTED}>(deg)</span>
                                            </td>
                                            <td>
                                                <SafeNumericInput selectAllOnFocus={true} buttonPosition="none" placeholder="P.A." value={region.rotation} onBlur={this.handleRotationChange} onKeyDown={this.handleRotationChange} />
                                            </td>
                                        </tr>
                                    </React.Fragment>
                                ) : null}
                            </tbody>
                        </table>
                    </div>
                </div>
            </>
        );
    }
}
