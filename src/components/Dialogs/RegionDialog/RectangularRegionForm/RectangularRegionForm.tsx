import * as React from "react";
import * as AST from "ast_wrapper";
import {observer} from "mobx-react";
import {observable} from "mobx";
import {H5, InputGroup, NumericInput, Classes} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {RegionStore} from "stores";
import "./RectangularRegionForm.css";
import {Point2D} from "../../../../models";

@observer
export class RectangularRegionForm extends React.Component<{ region: RegionStore, wcsInfo: number }> {
    @observable displayColorPicker: boolean;

    private handleNameChange = (ev) => {
        this.props.region.setName(ev.currentTarget.value);
    };

    private handleCenterXChange = (ev) => {
        if (ev.type === "keydown" && ev.keyCode !== 13) {
            return;
        }
        const valueString = ev.currentTarget.value;
        const value = parseFloat(valueString);
        if (isFinite(value)) {
            this.props.region.setControlPoint(0, {x: value, y: this.props.region.controlPoints[0].y});
        }
    };

    private handleCenterYChange = (ev) => {
        if (ev.type === "keydown" && ev.keyCode !== 13) {
            return;
        }
        const valueString = ev.currentTarget.value;
        const value = parseFloat(valueString);
        if (isFinite(value)) {
            this.props.region.setControlPoint(0, {x: this.props.region.controlPoints[0].x, y: value});
        }
    };

    private handleWidthChange = (ev) => {
        if (ev.type === "keydown" && ev.keyCode !== 13) {
            return;
        }
        const valueString = ev.currentTarget.value;
        const value = parseFloat(valueString);
        if (isFinite(value)) {
            this.props.region.setControlPoint(1, {x: value, y: this.props.region.controlPoints[1].y});
        }
    };

    private handleHeightChange = (ev) => {
        if (ev.type === "keydown" && ev.keyCode !== 13) {
            return;
        }
        const valueString = ev.currentTarget.value;
        const value = parseFloat(valueString);
        if (isFinite(value)) {
            this.props.region.setControlPoint(1, {x: this.props.region.controlPoints[1].x, y: value});
        }
    };

    private handleLeftChange = (ev) => {
        if (ev.type === "keydown" && ev.keyCode !== 13) {
            return;
        }
        const valueString = ev.currentTarget.value;
        const value = parseFloat(valueString);
        if (isFinite(value)) {
            const region = this.props.region;
            const centerPoint = region.controlPoints[0];
            const sizeDims = region.controlPoints[1];
            const rightValue = centerPoint.x + sizeDims.x / 2.0;
            const newCenter = {x: (value + rightValue) / 2.0, y: centerPoint.y};
            const newDims = {x: Math.abs(value - rightValue), y: sizeDims.y};
            region.setControlPoints([newCenter, newDims]);
        }
    };

    private handleBottomChange = (ev) => {
        if (ev.type === "keydown" && ev.keyCode !== 13) {
            return;
        }
        const valueString = ev.currentTarget.value;
        const value = parseFloat(valueString);
        if (isFinite(value)) {
            const region = this.props.region;
            const centerPoint = region.controlPoints[0];
            const sizeDims = region.controlPoints[1];
            const topValue = centerPoint.y + sizeDims.y / 2.0;
            const newCenter = {x: centerPoint.x, y: (value + topValue) / 2.0};
            const newDims = {x: sizeDims.x, y: Math.abs(value - topValue)};
            region.setControlPoints([newCenter, newDims]);
        }
    };

    private handleRightChange = (ev) => {
        if (ev.type === "keydown" && ev.keyCode !== 13) {
            return;
        }
        const valueString = ev.currentTarget.value;
        const value = parseFloat(valueString);
        if (isFinite(value)) {
            const region = this.props.region;
            const centerPoint = region.controlPoints[0];
            const sizeDims = region.controlPoints[1];
            const leftValue = centerPoint.x - sizeDims.x / 2.0;
            const newCenter = {x: (value + leftValue) / 2.0, y: centerPoint.y};
            const newDims = {x: Math.abs(value - leftValue), y: sizeDims.y};
            region.setControlPoints([newCenter, newDims]);
        }
    };

    private handleTopChange = (ev) => {
        if (ev.type === "keydown" && ev.keyCode !== 13) {
            return;
        }
        const valueString = ev.currentTarget.value;
        const value = parseFloat(valueString);
        if (isFinite(value)) {
            const region = this.props.region;
            const centerPoint = region.controlPoints[0];
            const sizeDims = region.controlPoints[1];
            const bottomValue = centerPoint.y - sizeDims.y / 2.0;
            const newCenter = {x: centerPoint.x, y: (value + bottomValue) / 2.0};
            const newDims = {x: sizeDims.x, y: Math.abs(value - bottomValue)};
            region.setControlPoints([newCenter, newDims]);
        }
    };

    private getFormattedString(wcsInfo: number, pixelCoords: Point2D) {
        if (wcsInfo) {
            const pointWCS = AST.pixToWCS(this.props.wcsInfo, pixelCoords.x, pixelCoords.y);
            const normVals = AST.normalizeCoordinates(this.props.wcsInfo, pointWCS.x, pointWCS.y);
            const wcsCoords = AST.getFormattedCoordinates(this.props.wcsInfo, normVals.x, normVals.y);
            if (wcsCoords) {
                return `WCS: (${wcsCoords.x}, ${wcsCoords.y})`;
            }
        }
        return null;
    }

    public render() {
        const region = this.props.region;
        if (!region || !region.isValid || region.regionType !== CARTA.RegionType.RECTANGLE) {
            return null;
        }

        const centerPoint = region.controlPoints[0];
        const sizeDims = region.controlPoints[1];
        const bottomLeftPoint = {x: centerPoint.x - sizeDims.x / 2.0, y: centerPoint.y - sizeDims.y / 2.0};
        const topRightPoint = {x: centerPoint.x + sizeDims.x / 2.0, y: centerPoint.y + sizeDims.y / 2.0};
        const wcsStringCenter = this.getFormattedString(this.props.wcsInfo, centerPoint);
        const wcsStringLeft = this.getFormattedString(this.props.wcsInfo, bottomLeftPoint);
        const wcsStringRight = this.getFormattedString(this.props.wcsInfo, topRightPoint);

        const commonProps = {
            selectAllOnFocus: true,
            allowNumericCharactersOnly: true
        };

        const pxUnitSpan = <span className={Classes.TEXT_MUTED}>(px)</span>;
        return (
            <div className="form-section rectangular-region-form">
                <H5>Properties</H5>
                <div className="form-contents">
                    <table>
                        <tbody>
                        <tr>
                            <td>Region Name</td>
                            <td colSpan={2}>
                                <InputGroup placeholder="Enter a region name" value={region.name} onChange={this.handleNameChange}/>
                            </td>
                        </tr>
                        <tr>
                            <td>Center {pxUnitSpan}</td>
                            <td>
                                <NumericInput {...commonProps} buttonPosition="none" placeholder="X Coordinate" value={centerPoint.x} onBlur={this.handleCenterXChange} onKeyDown={this.handleCenterXChange}/>
                            </td>
                            <td>
                                <NumericInput {...commonProps} buttonPosition="none" placeholder="Y Coordinate" value={centerPoint.y} onBlur={this.handleCenterYChange} onKeyDown={this.handleCenterYChange}/>
                            </td>
                            <td>
                                <span className="wcs-string">{wcsStringCenter}</span>
                            </td>
                        </tr>
                        <tr>
                            <td>Size {pxUnitSpan}</td>
                            <td>
                                <NumericInput {...commonProps} buttonPosition="none" placeholder="Width" value={sizeDims.x} onBlur={this.handleWidthChange} onKeyDown={this.handleWidthChange}/>
                            </td>
                            <td>
                                <NumericInput{...commonProps} buttonPosition="none" placeholder="Height" value={sizeDims.y} onBlur={this.handleHeightChange} onKeyDown={this.handleHeightChange}/>
                            </td>
                        </tr>
                        <tr>
                            <td>Bottom Left {pxUnitSpan}</td>
                            <td>
                                <NumericInput {...commonProps} buttonPosition="none" placeholder="X Coordinate" value={bottomLeftPoint.x} onBlur={this.handleLeftChange} onKeyDown={this.handleLeftChange}/>
                            </td>
                            <td>
                                <NumericInput {...commonProps} buttonPosition="none" placeholder="Y Coordinate" value={bottomLeftPoint.y} onBlur={this.handleBottomChange} onKeyDown={this.handleBottomChange}/>
                            </td>
                            <td><span className="wcs-string">{wcsStringLeft}</span></td>
                        </tr>
                        <tr>
                            <td>Top Right {pxUnitSpan}</td>
                            <td>
                                <NumericInput {...commonProps} buttonPosition="none" placeholder="X Coordinate" value={topRightPoint.x} onBlur={this.handleRightChange} onKeyDown={this.handleRightChange}/>
                            </td>
                            <td>
                                <NumericInput {...commonProps} buttonPosition="none" placeholder="Y Coordinate" value={topRightPoint.y} onBlur={this.handleTopChange} onKeyDown={this.handleTopChange}/>
                            </td>
                            <td><span className="wcs-string">{wcsStringRight}</span></td>
                        </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }
}