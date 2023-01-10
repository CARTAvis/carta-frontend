import * as React from "react";
import {observer} from "mobx-react";
import {computed} from "mobx";
import {Classes, H5, InputGroup} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import * as AST from "ast_wrapper";
import {AppStore} from "stores";
import {FrameStore, CoordinateMode, RegionStore, WCS_PRECISION} from "stores/Frame";
import {Point2D, WCSPoint2D} from "models";
import {closeTo, formattedArcsec, getFormattedWCSPoint, getPixelValueFromWCS, getValueFromArcsecString, isWCSStringFormatValid} from "utilities";
import {CoordinateComponent, CoordNumericInput, InputType, RotationNumericInput} from "components/Shared";
import "./EllipticalRegionForm.scss";

@observer
export class EllipticalRegionForm extends React.Component<{region: RegionStore; frame: FrameStore; wcsInfo: AST.FrameSet}> {
    private static readonly REGION_PIXEL_EPS = 1.0e-3;

    // size determined by reference frame
    @computed get sizeWCS(): WCSPoint2D {
        const region = this.props.region;
        if (!region || region.controlPoints.length !== 2 || !region.size || !this.props.frame) {
            return null;
        }
        const size = this.props.region.size;
        const wcsSize = this.props.frame.getWcsSizeInArcsec(size);
        if (wcsSize) {
            return {x: formattedArcsec(wcsSize.x, WCS_PRECISION), y: formattedArcsec(wcsSize.y, WCS_PRECISION)};
        }
        return null;
    }

    @computed get centerWCS(): WCSPoint2D {
        const region = this.props.region;
        if (!region || !this.props.wcsInfo) {
            return null;
        }
        return getFormattedWCSPoint(this.props.wcsInfo, region.center);
    }

    private handleNameChange = ev => {
        this.props.region.setName(ev.currentTarget.value);
    };

    private handleCenterXChange = (value: number): boolean => {
        const existingValue = this.props.region.center.x;
        if (isFinite(value) && !closeTo(value, existingValue, EllipticalRegionForm.REGION_PIXEL_EPS)) {
            this.props.region.setCenter({x: value, y: this.props.region.center.y});
            return true;
        }
        return false;
    };

    private handleCenterYChange = (value: number): boolean => {
        const existingValue = this.props.region.center.y;
        if (isFinite(value) && !closeTo(value, existingValue, EllipticalRegionForm.REGION_PIXEL_EPS)) {
            this.props.region.setCenter({x: this.props.region.center.x, y: value});
            return true;
        }
        return false;
    };

    private handleCenterWCSXChange = (wcsString: string): boolean => {
        if (isWCSStringFormatValid(wcsString, AppStore.Instance.overlayStore.numbers.formatTypeX)) {
            const newPoint = getPixelValueFromWCS(this.props.wcsInfo, {x: wcsString, y: this.centerWCS.y});
            const existingValue = this.props.region.center.x;
            if (isFinite(newPoint?.x) && !closeTo(newPoint.x, existingValue, EllipticalRegionForm.REGION_PIXEL_EPS)) {
                this.props.region.setCenter(newPoint);
                return true;
            }
        }
        return false;
    };

    private handleCenterWCSYChange = (wcsString: string): boolean => {
        if (isWCSStringFormatValid(wcsString, AppStore.Instance.overlayStore.numbers.formatTypeY)) {
            const newPoint = getPixelValueFromWCS(this.props.wcsInfo, {x: this.centerWCS.x, y: wcsString});
            const existingValue = this.props.region.center.y;
            if (isFinite(newPoint?.y) && !closeTo(newPoint.y, existingValue, EllipticalRegionForm.REGION_PIXEL_EPS)) {
                this.props.region.setCenter(newPoint);
                return true;
            }
        }
        return false;
    };

    private handleMajorAxisChange = (value: number): boolean => {
        const existingValue = this.props.region.size.x;
        if (isFinite(value) && value > 0 && !closeTo(value, existingValue, EllipticalRegionForm.REGION_PIXEL_EPS)) {
            this.props.region.setSize({x: value, y: this.props.region.size.y});
            return true;
        }
        return false;
    };

    private handleMajorAxisWCSChange = (wcsString: string): boolean => {
        const value = this.props.frame.getImageXValueFromArcsec(getValueFromArcsecString(wcsString));
        const existingValue = this.props.region.size.x;
        if (isFinite(value) && value > 0 && !closeTo(value, existingValue, EllipticalRegionForm.REGION_PIXEL_EPS)) {
            this.props.region.setSize({x: value, y: this.props.region.size.y});
            return true;
        }
        return false;
    };

    private handleMinorAxisChange = (value: number): boolean => {
        const existingValue = this.props.region.size.y;
        if (isFinite(value) && value > 0 && !closeTo(value, existingValue, EllipticalRegionForm.REGION_PIXEL_EPS)) {
            this.props.region.setSize({x: this.props.region.size.x, y: value});
            return true;
        }
        return false;
    };

    private handleMinorAxisWCSChange = (wcsString: string): boolean => {
        const value = this.props.frame.getImageYValueFromArcsec(getValueFromArcsecString(wcsString));
        const existingValue = this.props.region.size.y;
        if (isFinite(value) && value > 0 && !closeTo(value, existingValue, EllipticalRegionForm.REGION_PIXEL_EPS)) {
            this.props.region.setSize({x: this.props.region.size.x, y: value});
            return true;
        }
        return false;
    };

    private handleRotationChange = (valueString: string): boolean => {
        const value = parseFloat(valueString);
        const existingValue = this.props.region.rotation;
        if (isFinite(value) && !closeTo(value, existingValue, EllipticalRegionForm.REGION_PIXEL_EPS)) {
            this.props.region.setRotation(value);
            return true;
        }
        return false;
    };

    public render() {
        // dummy variables related to wcs to trigger re-render
        /* eslint-disable @typescript-eslint/no-unused-vars */
        const system = AppStore.Instance.overlayStore.global.explicitSystem;
        const formatX = AppStore.Instance.overlayStore.numbers.formatTypeX;
        const formatY = AppStore.Instance.overlayStore.numbers.formatTypeY;
        /* eslint-enable @typescript-eslint/no-unused-vars */

        const region = this.props.region;
        if (!region || region.controlPoints.length !== 2 || region.regionType !== CARTA.RegionType.ELLIPSE) {
            return null;
        }

        const centerPoint = region.center;
        const centerWCSPoint = this.centerWCS;
        const xInput = (
            <CoordNumericInput
                coord={region.coordinate}
                inputType={InputType.XCoord}
                value={centerPoint?.x}
                onChange={this.handleCenterXChange}
                valueWcs={centerWCSPoint?.x}
                onChangeWcs={this.handleCenterWCSXChange}
                wcsDisabled={!this.props.wcsInfo || !centerWCSPoint}
            />
        );
        const yInput = (
            <CoordNumericInput
                coord={region.coordinate}
                inputType={InputType.YCoord}
                value={centerPoint?.y}
                onChange={this.handleCenterYChange}
                valueWcs={centerWCSPoint?.y}
                onChangeWcs={this.handleCenterWCSYChange}
                wcsDisabled={!this.props.wcsInfo || !centerWCSPoint}
            />
        );
        const infoString = region.coordinate === CoordinateMode.Image ? `WCS: ${WCSPoint2D.ToString(centerWCSPoint)}` : `Image: ${Point2D.ToString(centerPoint, "px", 3)}`;

        const size = region.size;
        const sizeWCS = this.sizeWCS;
        const sizeWidthInput = (
            <CoordNumericInput
                coord={region.coordinate}
                inputType={InputType.Size}
                value={size.x}
                onChange={this.handleMajorAxisChange}
                valueWcs={sizeWCS?.x}
                onChangeWcs={this.handleMajorAxisWCSChange}
                wcsDisabled={!this.props.wcsInfo}
                sizePlaceholder="Semi-major"
            />
        );
        const sizeHeightInput = (
            <CoordNumericInput
                coord={region.coordinate}
                inputType={InputType.Size}
                value={size.y}
                onChange={this.handleMinorAxisChange}
                valueWcs={sizeWCS?.y}
                onChangeWcs={this.handleMinorAxisWCSChange}
                wcsDisabled={!this.props.wcsInfo}
                sizePlaceholder="Semi-minor"
            />
        );
        const sizeInfoString = region.coordinate === CoordinateMode.Image ? `(Semi-major, Semi-minor): ${WCSPoint2D.ToString(sizeWCS)}` : `Image: ${Point2D.ToString(size, "px", 3)}`;
        const pxUnitSpan = region.coordinate === CoordinateMode.Image ? <span className={Classes.TEXT_MUTED}>(px)</span> : "";
        return (
            <div className="form-section elliptical-region-form">
                <H5>Properties</H5>
                <div className="form-contents">
                    <table>
                        <tbody>
                            <tr>
                                <td>Region Name</td>
                                <td colSpan={2}>
                                    <InputGroup placeholder="Enter a region name" value={region.name} onChange={this.handleNameChange} />
                                </td>
                            </tr>
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
                            <tr>
                                <td>Semi-axes {pxUnitSpan}</td>
                                <td>{sizeWidthInput}</td>
                                <td>{sizeHeightInput}</td>
                                <td>
                                    <span className="info-string">{sizeInfoString}</span>
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    P.A. <span className={Classes.TEXT_MUTED}>(deg)</span>
                                </td>
                                <td>
                                    <RotationNumericInput value={region.rotation} onChange={this.handleRotationChange} disabled={!this.props.frame?.hasSquarePixels} />
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }
}
