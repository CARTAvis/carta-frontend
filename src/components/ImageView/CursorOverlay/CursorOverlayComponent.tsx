import * as React from "react";
import {observer} from "mobx-react";
import {CSSProperties} from "react";
import {CursorInfo, SpectralInfo} from "models";
import {formattedExponential} from "utilities";
import "./CursorOverlayComponent.css";

class CursorOverlayProps {
    cursorInfo: CursorInfo;
    cursorValue: number;
    spectralInfo: SpectralInfo;
    docked: boolean;
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

@observer
export class CursorOverlayComponent extends React.Component<CursorOverlayProps> {

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
        if (this.props.showValue && this.props.cursorValue !== undefined) {
            let valueString = `Value:\u00a0${formattedExponential(this.props.cursorValue, 5, this.props.unit, true, true)}`;
            if (isNaN(this.props.cursorValue)) {
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
}
