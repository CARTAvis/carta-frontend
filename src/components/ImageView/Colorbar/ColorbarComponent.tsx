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

    private renderTicksNumbers = () => {
        const appStore = AppStore.Instance;
        const frame = appStore.activeFrame;
        const colorbarSettings = appStore.overlayStore.colorbar;
        const yOffset = appStore.overlayStore.padding.top;

        const indexArray = Array.from(Array(colorbarSettings.tickNum).keys())
        let scaledArray = indexArray.map(x => (x + 1) / (colorbarSettings.tickNum + 1));
        
        switch(frame.renderConfig.scalingName) {
            case('Log'):
                scaledArray = scaledArray.map(x => Math.log(frame.renderConfig.alpha * x + 1) / Math.log(frame.renderConfig.alpha + 1));
                break;
            case('Square root'):
                scaledArray = scaledArray.map(x => x ** 0.5);
                break;
            case('Squared'):
                scaledArray = scaledArray.map(x => x ** 2.0);
                break;
            case('Gamma'):
                scaledArray = scaledArray.map(x => x ** frame.renderConfig.gamma);
                break;
            case('Power'):
                scaledArray = scaledArray.map(x => (frame.renderConfig.alpha ** x - 1) / (frame.renderConfig.alpha - 1));
                break;
            case('Linear'):
            case('Unknown'):
            default:
                break;
        }

        const yPosArray = scaledArray.map(x => yOffset + frame.renderHeight * (1 - x));

        let text_dy = (frame.renderConfig.scaleMaxVal - frame.renderConfig.scaleMinVal) / (colorbarSettings.tickNum + 1);    
        let texts = indexArray.map(x => (frame.renderConfig.scaleMinVal + text_dy * (x + 1)).toFixed(4));

        let ticks = [];
        let numbers = [];
        for (let i = 0; i < colorbarSettings.tickNum; i++) {
            if (colorbarSettings.tickVisible) {
                ticks.push(
                    <Line
                        points={[colorbarSettings.rightBorderPos - colorbarSettings.tickLen, yPosArray[i], colorbarSettings.rightBorderPos, yPosArray[i]]}
                        stroke={this.getColor()}
                        strokeWidth={colorbarSettings.tickWidth}
                        key={i.toString()}
                    />
                );
            }
            if (colorbarSettings.numberVisible) {
                numbers.push(
                    <Text
                        text={texts[i]}
                        x={colorbarSettings.rightBorderPos + colorbarSettings.textGap}
                        y={colorbarSettings.numberRotated ? yPosArray[i] + 18 : yPosArray[i] - colorbarSettings.numberFontSize / 2}
                        fill={this.getColor()}
                        fontFamily={this.astFonts[colorbarSettings.numberFont].family}
                        fontStyle={`${this.astFonts[colorbarSettings.numberFont].style} ${this.astFonts[colorbarSettings.numberFont].weight}`}
                        fontSize={colorbarSettings.numberFontSize}
                        rotation={colorbarSettings.numberRotated ? -90 : 0}
                        key={i.toString()}
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
                    {colorbarSettings.numberVisible ? numbers : null}
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
                    x={colorbarSettings.rightBorderPos + colorbarSettings.textGap + colorbarSettings.labelWidth}
                    y={yOffset + frame.renderHeight / 2}
                    fill={this.getColor()}
                    fontFamily={this.astFonts[colorbarSettings.labelFont].family}
                    fontSize={colorbarSettings.labelFontSize}
                    fontStyle={`${this.astFonts[colorbarSettings.labelFont].style} ${this.astFonts[colorbarSettings.labelFont].weight}`}
                    rotation={-90}
                    key={'0'}
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
                {colorbarSettings.tickVisible || colorbarSettings.numberVisible ? this.renderTicksNumbers() : null}
                {colorbarSettings.labelVisible ? this.renderTitle() : null}
            </Stage>
        );
    }
}