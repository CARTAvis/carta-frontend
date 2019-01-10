import * as React from "react";
import {CSSProperties} from "react";
import {CursorInfo, SpectralInfo} from "models";
import "./CursorOverlayComponent.css";

class CursorOverlayProps {
    cursorInfo: CursorInfo;
    spectralInfo: SpectralInfo;
    docked: boolean;
    mip: number;
    width: number;
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
    height?: number;
    unit?: string;

    showWCS?: boolean;
    showImage?: boolean;
    showValue?: boolean;
    showCanvas?: boolean;
    showChannel?: boolean;
    showSpectral?: boolean;
}

export class CursorOverlayComponent extends React.PureComponent<CursorOverlayProps> {

    render() {
        const cursorInfo = this.props.cursorInfo;
        let infoStrings: string[] = [];
        if (this.props.showWCS && cursorInfo.infoWCS) {
            infoStrings.push(`WCS:\u00a0(${cursorInfo.infoWCS.x},\u00a0${cursorInfo.infoWCS.y})`);
        }
        if (this.props.showCanvas) {
            infoStrings.push(`Canvas:\u00a0(${cursorInfo.posCanvasSpace.x.toFixed(0)},\u00a0${cursorInfo.posCanvasSpace.y.toFixed(0)})`);
        }
        if (this.props.showImage) {
            infoStrings.push(`Image:\u00a0(${cursorInfo.posImageSpace.x.toFixed(0)},\u00a0${cursorInfo.posImageSpace.y.toFixed(0)})`);
        }
        if (this.props.showValue && this.props.cursorInfo.value !== undefined) {
            let valueString = `Value:\u00a0${this.expo(this.props.cursorInfo.value, 5, this.props.unit, true, true)}`;
            if (this.props.mip > 1) {
                valueString += ` [${this.props.mip}\u00D7${this.props.mip}\u00a0average]`;
            }
            if (isNaN(this.props.cursorInfo.value)) {
                valueString = "NaN";
            }
            infoStrings.push(valueString);
        }
        if (this.props.showChannel && this.props.spectralInfo.channel !== undefined) {
            infoStrings.push(`Channel:\u00a0${this.props.spectralInfo.channel}`);
        }
        if (this.props.showSpectral && this.props.spectralInfo.spectralString) {
            infoStrings.push(this.props.spectralInfo.spectralString);
            if (this.props.spectralInfo.freqString) {
                infoStrings.push(this.props.spectralInfo.freqString);
            }
            if (this.props.spectralInfo.velocityString) {
                infoStrings.push(this.props.spectralInfo.velocityString);
            }
        }

        const height = (this.props.height !== undefined && this.props.height >= 0) ? this.props.height : 20;
        let top = 0;

        let styleProps: CSSProperties = {
            lineHeight: height + "px"
        };

        if (this.props.left > 0 || this.props.right > 0) {
            styleProps.width = this.props.width - this.props.left - this.props.right;
        }

        if (this.props.top !== undefined) {
            styleProps.top = this.props.top;
        } else if (this.props.bottom !== undefined) {
            styleProps.bottom = this.props.bottom;
        }

        if (this.props.left !== undefined) {
            styleProps.left = this.props.left;
        }

        let className = "cursor-overlay-div";
        if (this.props.docked) {
            className += " docked";
        }
        return (
            <div className={className} style={styleProps}>
                {infoStrings.join("; ")}
            </div>
        );
    }

    expo(val: number, digits: number, unit: string = "", trim: boolean = true, pad: boolean = false) {
        let valString = val.toExponential(digits);
        if (trim) {
            // remove unnecessary trailing decimals
            valString = valString.replace(/0+e/, "e");
            valString = valString.replace(".e", ".0e");
            // strip unnecessary exponential notation
            valString = valString.replace("e+0", "");
        }
        if (pad && val >= 0) {
            valString = " " + valString;
        }
        // append unit
        if (unit && unit.length) {
            valString = `${valString} ${unit}`;
        }
        return valString;
    }
}
