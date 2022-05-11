import * as React from "react";
import classNames from "classnames";
import {observer} from "mobx-react";
import {CSSProperties} from "react";
import {CursorInfo, SpectralInfo} from "models";
import {formattedExponential, toFixed} from "utilities";
import "./CursorOverlayComponent.scss";

class CursorOverlayProps {
    cursorInfo: CursorInfo;
    cursorValue: number;
    isValueCurrent: boolean;
    spectralInfo: SpectralInfo;
    docked: boolean;
    width: number;
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
    height?: number;
    unit?: string;
    currentStokes?: string;
    cursorValueToPercentage?: boolean;
}

@observer
export class CursorOverlayComponent extends React.Component<CursorOverlayProps> {
    render() {
        const cursorInfo = this.props.cursorInfo;
        let infoStrings: string[] = [];
        if (cursorInfo.infoWCS) {
            infoStrings.push(`WCS:\u00a0(${cursorInfo.infoWCS.x},\u00a0${cursorInfo.infoWCS.y})`);
        }
        if (cursorInfo.posImageSpace?.x !== -Number.MAX_VALUE || cursorInfo.posImageSpace?.y !== -Number.MAX_VALUE) {
            infoStrings.push(`Image:\u00a0(${toFixed(cursorInfo.posImageSpace.x)},\u00a0${toFixed(cursorInfo.posImageSpace.y)})`);
        }
        if (this.props.cursorValue !== undefined) {
            let valueString = `Value:\u00a0${this.props.cursorValueToPercentage ? toFixed(this.props.cursorValue, 1) + " %" : formattedExponential(this.props.cursorValue, 5, this.props.unit, true, true)}`;
            if (isNaN(this.props.cursorValue)) {
                valueString = "NaN";
            }
            if (!this.props.isValueCurrent) {
                valueString += "*";
            } else {
                valueString += " ";
            }
            infoStrings.push(valueString);
        }
        if (this.props.spectralInfo.spectralString) {
            infoStrings.push(this.props.spectralInfo.spectralString.replace(/\s/g, "\u00a0"));
            if (this.props.spectralInfo.freqString) {
                infoStrings.push(this.props.spectralInfo.freqString.replace(/\s/g, "\u00a0"));
            }
            if (this.props.spectralInfo.velocityString) {
                infoStrings.push(this.props.spectralInfo.velocityString.replace(/\s/g, "\u00a0"));
            }
        }
        if (this.props.currentStokes) {
            infoStrings.push(`Polarization:\u00a0${this.props.currentStokes}`);
        }

        const height = this.props.height !== undefined && this.props.height >= 0 ? this.props.height : 20;

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

        const className = classNames("cursor-overlay-div", {docked: this.props.docked});

        return (
            <div className={className} style={styleProps}>
                {infoStrings.length ? infoStrings.join("; ") : "\u00a0"}
            </div>
        );
    }
}
