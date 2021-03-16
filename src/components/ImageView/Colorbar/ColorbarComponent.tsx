import * as React from "react";
import {observer} from "mobx-react";
import {Layer, Line, Rect, Stage, Text} from "react-konva";
import {AppStore, dayPalette, nightPalette} from "stores";
import {fonts} from "ast_wrapper";
import {Font} from "../ImageViewSettingsPanel/ImageViewSettingsPanelComponent"
import "./ColorbarComponent.scss";

export interface ColorbarComponentProps {
    height: number;
    left: number;
}

@observer
export class ColorbarComponent extends React.Component<ColorbarComponentProps> {
    
    private astFonts: Font[] = fonts.map((x, i) => (new Font(x, i)));

    private getColor = (): string => {
        const appStore = AppStore.Instance;
        const colorId = appStore.overlayStore.global.color
        return appStore.darkTheme ? nightPalette[colorId] : dayPalette[colorId];
    }

    private renderColorbar = () => {
        const appStore = AppStore.Instance;
        const frame = appStore.activeFrame;
        const colorbarSettings = appStore.overlayStore.colorbar;
        const yOffset = appStore.overlayStore.padding.top;
        return (
            <Layer>
                <Rect
                    x={colorbarSettings.offset}
                    y={yOffset}
                    width={colorbarSettings.width}
                    height={frame.renderHeight}
                    fillLinearGradientStartPoint={{x: 0, y: yOffset}}
                    fillLinearGradientEndPoint={{x: 0, y: yOffset + frame.renderHeight}}
                    fillLinearGradientColorStops={frame.renderConfig.colorscaleArray}
                    stroke={colorbarSettings.borderVisible ? this.getColor() : null}
                    strokeWidth={colorbarSettings.borderWidth}
                />
            </Layer>
        )
    };

    private renderTicksLabels = () => {
        const appStore = AppStore.Instance;
        const frame = appStore.activeFrame;
        const colorbarSettings = appStore.overlayStore.colorbar;
        const yOffset = appStore.overlayStore.padding.top;

        const indexArray = Array.from(Array(colorbarSettings.tickNum).keys())
        let scaledArray = indexArray.map(x => x / (colorbarSettings.tickNum - 1));
        // TODO: different scaling
        const yPosArray = scaledArray.map(x => yOffset + frame.renderHeight * (1 - x));

        let text_dy = (frame.renderConfig.scaleMaxVal - frame.renderConfig.scaleMinVal) / (colorbarSettings.tickNum - 1);    
        let texts = indexArray.map(x => (frame.renderConfig.scaleMinVal + text_dy * x).toFixed(4));

        let ticks = [];
        let labels = [];
        for (let i = 0; i < colorbarSettings.tickNum; i++) {
            if (colorbarSettings.tickVisible) {
                ticks.push(
                    <Line
                        points={[colorbarSettings.rightBorderPos - colorbarSettings.tickLen, yPosArray[i], colorbarSettings.rightBorderPos, yPosArray[i]]}
                        stroke={this.getColor()}
                        strokeWidth={colorbarSettings.tickWidth}
                    />
                );
            }
            if (colorbarSettings.labelVisible) {
                labels.push(
                    <Text
                        text={texts[i]}
                        x={colorbarSettings.rightBorderPos + 5}
                        y={colorbarSettings.labelRotated ? yPosArray[i] + 18 : yPosArray[i] - colorbarSettings.labelFontSize / 2}
                        fill={this.getColor()}
                        fontFamily={this.astFonts[colorbarSettings.labelFont].family}
                        fontStyle={`${this.astFonts[colorbarSettings.labelFont].style} ${this.astFonts[colorbarSettings.labelFont].weight}`}
                        fontSize={colorbarSettings.labelFontSize}
                        rotation={colorbarSettings.labelRotated ? -90 : 0}
                    />
                );
            }
        }

        return (
            <React.Fragment>
                <Layer>
                    {colorbarSettings.tickVisible ? ticks : null}
                </Layer>
                <Layer>
                    {colorbarSettings.labelVisible ? labels : null}
                </Layer>
            </React.Fragment>
        );
    };

    private renderTitle = () => {
        const appStore = AppStore.Instance;
        const frame = appStore.activeFrame;
        const colorbarSettings = appStore.overlayStore.colorbar;
        const yOffset = appStore.overlayStore.padding.top;
        return (
            <Layer>
                <Text
                    text={frame.unit}
                    x={colorbarSettings.rightBorderPos + 5 + colorbarSettings.labelWidth}
                    y={yOffset + frame.renderHeight / 2}
                    fill={this.getColor()}
                    fontFamily={this.astFonts[colorbarSettings.titleFont].family}
                    fontSize={colorbarSettings.titleFontSize}
                    fontStyle={`${this.astFonts[colorbarSettings.titleFont].style} ${this.astFonts[colorbarSettings.titleFont].weight}`}
                    rotation={-90}
                />
            </Layer>
        );
    };


    render() {
        const colorbarSettings = AppStore.Instance.overlayStore.colorbar;
        return (
            <Stage
                className={"colorbar-stage"}
                width={colorbarSettings.stageWidth}
                height={this.props.height}
                style={{left: this.props.left}}
            >
                {this.renderColorbar()}
                {colorbarSettings.tickVisible || colorbarSettings.labelVisible ? this.renderTicksLabels() : null}
                {colorbarSettings.titleVisible ? this.renderTitle() : null}
            </Stage>
        );
    }
}