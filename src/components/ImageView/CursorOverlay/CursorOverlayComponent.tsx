import * as React from "react";
import "./CursorOverlayComponent.css";
import {CursorInfo} from "../../../models/CursorInfo";
import {CSSProperties} from "react";

class CursorOverlayProps {
    cursorInfo: CursorInfo;
    docked: boolean;
    mip: number;
    width: number;
    top?: number;
    bottom?: number;
    height?: number;
    unit?: string;

    showWCS?: boolean;
    showImage?: boolean;
    showValue?: boolean;
    showCanvas?: boolean;

}

export class CursorOverlayComponent extends React.PureComponent<CursorOverlayProps> {

    render() {
        const cursorInfo = this.props.cursorInfo;
        let infoStrings: string[] = [];
        if (this.props.showWCS && cursorInfo.infoWCS) {
            infoStrings.push(`WCS: (${cursorInfo.infoWCS.x}, ${cursorInfo.infoWCS.y})`);
        }
        if (this.props.showCanvas) {
            infoStrings.push(`Canvas: (${cursorInfo.posCanvasSpace.x.toFixed(0)}, ${cursorInfo.posCanvasSpace.y.toFixed(0)})`);
        }
        if (this.props.showImage) {
            infoStrings.push(`Image: (${cursorInfo.posImageSpace.x.toFixed(0)}, ${cursorInfo.posImageSpace.y.toFixed(0)})`);
        }
        if (this.props.showValue && this.props.cursorInfo.value !== undefined) {
            let valueString = `Value: ${this.expo(this.props.cursorInfo.value, 5, this.props.unit, true, true)}`;
            if (this.props.mip > 1) {
                valueString += ` [${this.props.mip}\u00D7${this.props.mip} average]`;
            }
            if (isNaN(this.props.cursorInfo.value)) {
                valueString = "NaN";
            }
            infoStrings.push(valueString);
        }

        const height = (this.props.height !== undefined && this.props.height >= 0) ? this.props.height : 20;
        let top = 0;

        let styleProps: CSSProperties = {
            height: height + "px",
            lineHeight: height + "px"
        };

        if (this.props.top !== undefined) {
            styleProps.top = this.props.top + "px";
        }
        else if (this.props.bottom !== undefined) {
            styleProps.bottom = this.props.bottom + "px";
        }

        return (
            <div className={"cursor-overlay-div"} style={styleProps}>
                {infoStrings.join("; ")}
            </div>
        );
    }

    expo(val: number, digits: number, unit: string = "", trim: boolean = true, pad: boolean = false) {
        let valString = val.toExponential(digits);
        if (trim) {
            // remove unnecessary trailing decimals
            valString = valString.replace(/0+e/, "e");
            valString = valString.replace(".e", "0.e");
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