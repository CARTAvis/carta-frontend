import * as React from "react";
import {observer} from "mobx-react";
import {Layer, Line, Rect, Stage, Text} from "react-konva";
import {AppStore, dayPalette, nightPalette} from "stores";
import {getColorsForValues} from "utilities";
import "./ColorbarComponent.scss";

export interface ColorbarComponentProps {
    height: number;
    left: number;
}

@observer
export class ColorbarComponent extends React.Component<ColorbarComponentProps> {
    
    private appStore = AppStore.Instance;
    private frame = this.appStore.activeFrame;
    private colorbarSettings = this.appStore.overlayStore.colorbar;
    private yOffset = this.appStore.overlayStore.padding.top;

    colorscale = () => {
        const colorsForValues = getColorsForValues(this.frame.renderConfig.colorMap);
        const indexArray = Array.from(Array(colorsForValues.size).keys()).map(x => this.frame.renderConfig.inverted ? x / colorsForValues.size : 1 - x / colorsForValues.size);

        let colorscale = [];
        for (let i = 0; i < colorsForValues.size; i++) {
            colorscale.push(indexArray[i],
                `rgb(${colorsForValues.color[i * 4]}, ${colorsForValues.color[i * 4 + 1]}, ${colorsForValues.color[i * 4 + 2]}, ${colorsForValues.color[i * 4 + 3]})`);
        }
        return colorscale
    };

    private renderColorbar = () => {
        return (
            <Layer>
                <Rect
                    x={this.colorbarSettings.offset}
                    y={this.yOffset}
                    width={this.colorbarSettings.width}
                    height={this.frame.renderHeight}
                    fillLinearGradientStartPoint={{x: 0, y: this.yOffset}}
                    fillLinearGradientEndPoint={{x: 0, y: this.yOffset + this.frame.renderHeight}}
                    fillLinearGradientColorStops={this.colorscale()}
                    stroke={this.colorbarSettings.borderVisible ? (this.appStore.darkTheme ? nightPalette[this.appStore.overlayStore.global.color] : dayPalette[this.appStore.overlayStore.global.color]) : null}
                    strokeWidth={this.colorbarSettings.borderWidth}
                />
            </Layer>
        )
    };

    private renderTicksLabels = () => {
        const indexArray = Array.from(Array(this.colorbarSettings.tickNum).keys())
        let scaledArray = indexArray.map(x => x / (this.colorbarSettings.tickNum - 1));
        // TODO: different scaling
        const yPosArray = scaledArray.map(x => this.yOffset + this.frame.renderHeight * (1 - x));

        let text_dy = (this.frame.renderConfig.scaleMaxVal - this.frame.renderConfig.scaleMinVal) / (this.colorbarSettings.tickNum - 1);    
        let texts = indexArray.map(x => (this.frame.renderConfig.scaleMinVal + text_dy * x).toFixed(4));

        let ticks = [];
        let labels = [];
        for (let i = 0; i < this.colorbarSettings.tickNum; i++) {
            ticks.push(
                <Line
                    points={[this.colorbarSettings.rightBorderPos - this.colorbarSettings.tickLen, yPosArray[i], this.colorbarSettings.rightBorderPos, yPosArray[i]]}
                    stroke={this.appStore.darkTheme ? nightPalette[this.appStore.overlayStore.global.color] : dayPalette[this.appStore.overlayStore.global.color]}
                    strokeWidth={this.colorbarSettings.tickWidth}
                />
            );
            labels.push(
                <Text
                    text={texts[i]}
                    x={this.colorbarSettings.rightBorderPos + 5}
                    y={this.colorbarSettings.labelRotated ? yPosArray[i] + 18 : yPosArray[i] - this.colorbarSettings.labelFontSize / 2}
                    fill={this.appStore.darkTheme ? nightPalette[this.appStore.overlayStore.global.color] : dayPalette[this.appStore.overlayStore.global.color]}
                    fontSize={this.colorbarSettings.labelFontSize}
                    rotation={this.colorbarSettings.labelRotated ? -90 : 0}
                />
            );
        }

        return (
            <React.Fragment>
                <Layer>
                    {this.colorbarSettings.tickVisible ? ticks : null}
                </Layer>
                <Layer>
                {this.colorbarSettings.labelVisible ? labels : null}
                </Layer>
            </React.Fragment>
        );
    };

    private renderTitle = () => {
        return (
            <Layer>
                <Text
                    text={this.frame.unit}
                    x={this.colorbarSettings.rightBorderPos + 5 + this.colorbarSettings.labelWidth}
                    y={this.yOffset + this.frame.renderHeight / 2}
                    fill={this.appStore.darkTheme ? nightPalette[this.appStore.overlayStore.global.color] : dayPalette[this.appStore.overlayStore.global.color]}
                    fontSize={this.colorbarSettings.titleFontSize}
                    rotation={-90}
                />
            </Layer>
        );
    };


    render() {
        return (
            <Stage
                className={"colorbar-stage"}
                width={this.colorbarSettings.stageWidth}
                height={this.props.height}
                style={{left: this.props.left}}
            >
                {this.renderColorbar()}
                {this.renderTicksLabels()}
                {this.colorbarSettings.titleVisible ? this.renderTitle() : null}
            </Stage>
        );
    }
}