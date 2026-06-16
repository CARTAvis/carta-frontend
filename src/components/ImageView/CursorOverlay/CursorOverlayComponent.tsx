import type {CSSProperties} from "react";
import * as React from "react";
import classNames from "classnames";
import {observer} from "mobx-react";
import type {CursorInfo, SpectralInfo} from "models";

import {formattedExponential, toFixed} from "utilities";

import "./CursorOverlayComponent.scss";

class CursorOverlayProps {
    cursorInfo?: CursorInfo;
    cursorValue: number;
    isValueCurrent: boolean;
    spectralInfo: SpectralInfo;
    isDocked: boolean;
    width: number;
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
    height?: number;
    unit?: string;
    currentStokes?: string;
    hasCursorValueToPercentage?: boolean;
    isPreview?: boolean;
    isVisible?: boolean;
}

@observer
export class CursorOverlayComponent extends React.Component<CursorOverlayProps> {
    render() {
        const cursorInfo = this.props.cursorInfo;
        const infoStrings: string[] = [];
        if (cursorInfo) {
            if (cursorInfo.infoWCS) {
                infoStrings.push(`WCS: (${cursorInfo.infoWCS.x}, ${cursorInfo.infoWCS.y})`);
            }
            if (cursorInfo.posImageSpace?.x !== -Number.MAX_VALUE || cursorInfo.posImageSpace?.y !== -Number.MAX_VALUE) {
                infoStrings.push(`Image: (${toFixed(cursorInfo.posImageSpace.x)}, ${toFixed(cursorInfo.posImageSpace.y)})`);
            }
        }
        if (this.props.cursorValue !== undefined) {
            let valueString = `Value: ${this.props.hasCursorValueToPercentage ? toFixed(this.props.cursorValue, 1) + " %" : formattedExponential(this.props.cursorValue, 5, this.props.unit, true, true)}`;
            if (isNaN(this.props.cursorValue)) {
                valueString = "NaN";
            }
            if (!this.props.isValueCurrent) {
                valueString += "*";
            } else if (this.props.isPreview) {
                valueString += "~";
            } else {
                valueString += " ";
            }
            infoStrings.push(valueString);
        }
        if (this.props.spectralInfo.spectralString) {
            infoStrings.push(this.props.spectralInfo.spectralString);
            if (this.props.spectralInfo.freqString) {
                infoStrings.push(this.props.spectralInfo.freqString);
            }
            if (this.props.spectralInfo.velocityString) {
                infoStrings.push(this.props.spectralInfo.velocityString);
            }
        }
        if (this.props.currentStokes) {
            infoStrings.push(`Polarization: ${this.props.currentStokes}`);
        }

        const height = this.props.height !== undefined && this.props.height >= 0 ? this.props.height : 20;

        const styleProps: CSSProperties = {
            lineHeight: height + "px"
        };

        if (this.props.left !== undefined && this.props.right !== undefined && (this.props.left > 0 || this.props.right > 0)) {
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

        const className = classNames("cursor-overlay-div", {docked: this.props.isDocked});
        const infoContent =
            infoStrings.length > 0 ? (
                infoStrings.map((info, index) => (
                    <span key={index} className="cursor-info-item">
                        {info}
                        {index < infoStrings.length - 1 && ";\u00a0"}
                    </span>
                ))
            ) : (
                <span>{"\u00a0"}</span>
            );

        return (
            <div className={className} style={{...styleProps, visibility: this.props.isVisible === false ? "hidden" : "visible"}} data-testid="viewer-cursor-info-bar">
                {infoContent}
            </div>
        );
    }
}
