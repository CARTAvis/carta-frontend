import * as React from "react";
import {Layer, Line, Rect, Stage, Text} from "react-konva";
import {fonts} from "ast_wrapper";
import {action, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";

import {ProfilerInfoComponent} from "components/Shared";
import {AppStore} from "stores";
import {FrameStore} from "stores/Frame";
import {clamp, getColorForTheme} from "utilities";

import {Font} from "../ImageViewSettingsPanel/ImageViewSettingsPanelComponent";

import "./ColorbarComponent.scss";

export interface ColorbarComponentProps {
    onCursorHoverValueChanged: (number) => void;
    frame: FrameStore;
}

@observer
export class ColorbarComponent extends React.Component<ColorbarComponentProps> {
    @observable hoverInfoText: string = "";
    @observable isHovering: boolean = false;
    @observable cursorY: number = -1;
    private mouseEnterHandle;
    private layerRef = React.createRef<any>();

    private static readonly HoverDelay = 500;

    private astFonts: Font[] = fonts.map((x, i) => new Font(x, i));

    constructor(props) {
        super(props);
        makeObservable(this);
    }

    @action setHoverInfoText = (text: string) => {
        this.hoverInfoText = text;
    };

    @action setMouseHovering = (val: boolean) => {
        this.isHovering = val;
    };

    @action onMouseEnter = () => {
        if (this.mouseEnterHandle) {
            clearTimeout(this.mouseEnterHandle);
        }
        this.mouseEnterHandle = setTimeout(() => {
            this.setMouseHovering(true);
        }, ColorbarComponent.HoverDelay);
    };

    @action onMouseLeave = () => {
        this.setMouseHovering(false);
        if (this.mouseEnterHandle) {
            clearTimeout(this.mouseEnterHandle);
        }
        this.props.onCursorHoverValueChanged(NaN);
    };

    @action setCursorY = (y: number) => {
        this.cursorY = y;
    };

    componentDidUpdate() {
        AppStore.Instance.resetImageRatio();
    }

    private handleMouseMove = event => {
        const appStore = AppStore.Instance;
        const renderConfig = this.props.frame?.renderConfig;
        const colorbarSettings = appStore?.overlayStore?.colorbar;
        if (!renderConfig || !colorbarSettings) {
            return;
        }

        const stage = event.target.getStage();
        let point = colorbarSettings.position === "right" ? stage.getPointerPosition().y : stage.getPointerPosition().x;
        let scaledPos = point - colorbarSettings.yOffset;
        if (colorbarSettings.position === "right") {
            scaledPos = colorbarSettings.height - scaledPos;
        }
        scaledPos /= colorbarSettings.height;
        scaledPos = clamp(scaledPos, 0.0, 1.0);
        // Recalculate clamped point position
        point = clamp(point, colorbarSettings.yOffset, colorbarSettings.yOffset + colorbarSettings.height);
        // Lock to mid-pixel for sharp lines
        point = Math.floor(point) + 0.5;

        const hoverValue = renderConfig.scaleMinVal + scaledPos * (renderConfig.scaleMaxVal - renderConfig.scaleMinVal);
        this.setHoverInfoText(this.props.frame?.requiredUnit === "%" ? hoverValue.toFixed(1) : hoverValue.toExponential(5));
        if (colorbarSettings.interactive && this.isHovering) {
            this.props.onCursorHoverValueChanged(hoverValue);
        } else {
            this.props.onCursorHoverValueChanged(NaN);
        }
        this.setCursorY(point);
    };

    render() {
        const appStore = AppStore.Instance;
        const frame = this.props.frame;
        const colorbarSettings = appStore.overlayStore.colorbar;

        appStore.updateLayerPixelRatio(this.layerRef);

        let getColor = (customColor: boolean, color: string): string => {
            return customColor ? getColorForTheme(color) : colorbarSettings.customColor ? getColorForTheme(colorbarSettings.color) : getColorForTheme(appStore.overlayStore.global.color);
        };

        // to avoid blurry border when width <= 1px, add 0.5 px offset to the colorbar if necessary
        const isOnePixBorder = colorbarSettings.borderWidth * appStore.imageRatio <= 1;
        let isIntPosition = (position: number): boolean => {
            return (position * devicePixelRatio) % 1 === 0;
        };

        let stageWidth = colorbarSettings.stageWidth;
        let stageHeight = appStore.overlayStore.viewHeight;
        let stageTop = 0;
        let stageLeft = 0;
        let rectX = colorbarSettings.offset + (isOnePixBorder ? 0.5 / devicePixelRatio : 0);
        let rectY = colorbarSettings.yOffset - (isOnePixBorder && (isIntPosition(colorbarSettings.yOffset) ? 0.5 / devicePixelRatio : 0));
        let rectWidth = colorbarSettings.width;
        let rectHeight = colorbarSettings.height + (isOnePixBorder && (!isIntPosition(colorbarSettings.height) ? (isIntPosition(colorbarSettings.yOffset) ? 0.5 : -0.5) / devicePixelRatio : 0));
        let rectGradientStart = {x: 0, y: 0};
        let rectGradientEnd = {x: 0, y: colorbarSettings.height};
        let labelXPos = colorbarSettings.rightBorderPos + colorbarSettings.numberWidth + colorbarSettings.textGap;
        let labelYPos = colorbarSettings.yOffset;
        let hoverBarPosition = [colorbarSettings.offset, this.cursorY, colorbarSettings.rightBorderPos, this.cursorY];

        // adjust stage position
        if (colorbarSettings.position === "right") {
            stageLeft = appStore.overlayStore.padding.left + appStore.overlayStore.renderWidth;
        } else if (colorbarSettings.position === "bottom") {
            stageTop = appStore.overlayStore.viewHeight - appStore.overlayStore.colorbarHoverInfoHeight - colorbarSettings.stageWidth;
        } else if (colorbarSettings.position === "top" && appStore.overlayStore.title.show) {
            stageTop = appStore.overlayStore.padding.top - colorbarSettings.stageWidth;
        }

        // rotate to horizontal by swapping
        if (colorbarSettings.position !== "right") {
            stageHeight = stageWidth;
            stageWidth = appStore.overlayStore.viewWidth;
            rectY = rectX;
            rectX = colorbarSettings.yOffset + (isOnePixBorder && (isIntPosition(colorbarSettings.yOffset) ? 0.5 / devicePixelRatio : 0));
            [rectWidth, rectHeight] = [rectHeight, rectWidth];
            [rectGradientStart.x, rectGradientStart.y, rectGradientEnd.x, rectGradientEnd.y] = [rectGradientEnd.y, rectGradientEnd.x, rectGradientStart.y, rectGradientStart.x];
            [labelXPos, labelYPos] = [labelYPos, labelXPos];
            hoverBarPosition = [hoverBarPosition[1], hoverBarPosition[0], hoverBarPosition[3], hoverBarPosition[2]];
        }

        // reflect over x-axis
        if (colorbarSettings.position === "top") {
            rectY = colorbarSettings.stageWidth - rectY - colorbarSettings.width;
            labelYPos = colorbarSettings.rightBorderPos - colorbarSettings.numberWidth - colorbarSettings.textGap - colorbarSettings.labelFontSize;
            hoverBarPosition[1] = colorbarSettings.stageWidth - hoverBarPosition[1];
        }

        const colorbar = (
            <Rect
                x={rectX}
                y={rectY}
                width={rectWidth}
                height={rectHeight}
                fillLinearGradientStartPoint={rectGradientStart}
                fillLinearGradientEndPoint={rectGradientEnd}
                fillLinearGradientColorStops={colorbarSettings.gradientVisible ? frame.renderConfig.colorscaleArray : null}
                stroke={colorbarSettings.borderVisible ? getColor(colorbarSettings.borderCustomColor, colorbarSettings.borderColor) : null}
                strokeWidth={colorbarSettings.borderWidth / devicePixelRatio}
            />
        );

        let ticks = [];
        let numbers = [];
        if (colorbarSettings.tickVisible || colorbarSettings.numberVisible) {
            const texts = frame.colorbarStore.texts;
            const positions = frame.colorbarStore.positions;

            for (let i = 0; i < positions.length; i++) {
                if (colorbarSettings.tickVisible) {
                    // to avoid blurry ticks when width <= 1px, offset to .5 px position
                    const position = positions[i] - (colorbarSettings.tickWidth * appStore.imageRatio <= 1 && positions[i] - Math.floor(positions[i]) - 0.5 / devicePixelRatio);
                    let tickPoints = [colorbarSettings.rightBorderPos - colorbarSettings.tickLen, position, colorbarSettings.rightBorderPos, position];
                    if (colorbarSettings.position !== "right") {
                        // rotate to horizontal by swapping
                        tickPoints = [tickPoints[1], tickPoints[0], tickPoints[3], tickPoints[2]];
                        if (colorbarSettings.position === "top") {
                            // reflect over x-axis
                            tickPoints[1] = colorbarSettings.rightBorderPos + colorbarSettings.tickLen;
                        }
                    }
                    ticks.push(<Line points={tickPoints} stroke={getColor(colorbarSettings.tickCustomColor, colorbarSettings.tickColor)} strokeWidth={colorbarSettings.tickWidth / devicePixelRatio} key={i.toString()} />);
                }
                if (colorbarSettings.numberVisible) {
                    let numberXPos = colorbarSettings.rightBorderPos + colorbarSettings.textGap;
                    let numberYPos = positions[i] - colorbarSettings.height / 2;
                    if (colorbarSettings.position !== "right") {
                        // rotate to horizontal by swapping
                        [numberXPos, numberYPos] = [numberYPos, numberXPos];
                        if (colorbarSettings.position === "top") {
                            numberYPos = colorbarSettings.rightBorderPos - colorbarSettings.textGap - colorbarSettings.numberFontSize;
                        }
                    } else {
                        // adjust for rotation
                        switch (colorbarSettings.numberRotation) {
                            case 90:
                                numberXPos += colorbarSettings.numberFontSize;
                                break;
                            case 0:
                                numberYPos = positions[i] - colorbarSettings.numberFontSize / 2;
                                break;
                            case -90:
                                numberYPos = positions[i] + colorbarSettings.height / 2;
                                break;
                            default:
                                break;
                        }
                    }
                    numbers.push(
                        <Text
                            text={texts[i]}
                            x={numberXPos}
                            y={numberYPos}
                            width={colorbarSettings.numberRotation !== 0 || colorbarSettings.position !== "right" ? colorbarSettings.height : null}
                            align={"center"}
                            fill={getColor(colorbarSettings.numberCustomColor, colorbarSettings.numberColor)}
                            fontFamily={this.astFonts[colorbarSettings.numberFont].family}
                            fontStyle={`${this.astFonts[colorbarSettings.numberFont].style} ${this.astFonts[colorbarSettings.numberFont].weight}`}
                            fontSize={colorbarSettings.numberFontSize}
                            rotation={colorbarSettings.position === "right" ? colorbarSettings.numberRotation : 0}
                            key={i.toString()}
                        />
                    );
                }
            }
        }

        const frameUnit = frame.requiredUnit === undefined || !frame.requiredUnit.length ? "arbitrary units" : frame.requiredUnit;
        if (colorbarSettings.position === "right") {
            // adjust for rotation
            switch (colorbarSettings.labelRotation) {
                case 90:
                    labelXPos += colorbarSettings.labelFontSize;
                    break;
                case -90:
                    labelYPos += colorbarSettings.height;
                    break;
                default:
                    break;
            }
        }
        const label = colorbarSettings.labelVisible ? (
            <Text
                text={colorbarSettings.labelCustomText ? frame.colorbarLabelCustomText : frameUnit}
                x={labelXPos}
                y={labelYPos}
                width={colorbarSettings.height}
                align={"center"}
                fill={getColor(colorbarSettings.labelCustomColor, colorbarSettings.labelColor)}
                fontFamily={this.astFonts[colorbarSettings.labelFont].family}
                fontSize={colorbarSettings.labelFontSize}
                fontStyle={`${this.astFonts[colorbarSettings.labelFont].style} ${this.astFonts[colorbarSettings.labelFont].weight}`}
                rotation={colorbarSettings.position === "right" ? colorbarSettings.labelRotation : 0}
                key={"0"}
            />
        ) : null;

        const hoverBar =
            colorbarSettings.interactive && this.isHovering ? (
                <Line points={hoverBarPosition} stroke={colorbarSettings.customColor ? getColorForTheme(colorbarSettings.color) : getColorForTheme(appStore.overlayStore.global.color)} strokeWidth={1 / devicePixelRatio} />
            ) : null;

        const hoverInfo =
            colorbarSettings.interactive && this.isHovering ? (
                <div className={"colorbar-info"}>
                    <ProfilerInfoComponent info={[`Colorscale: ${this.hoverInfoText} ${frame.requiredUnit}`]} />
                </div>
            ) : null;

        return (
            <React.Fragment>
                <Stage className={"colorbar-stage"} width={stageWidth} height={stageHeight} style={{left: stageLeft, top: stageTop}} onMouseEnter={this.onMouseEnter} onMouseMove={this.handleMouseMove} onMouseLeave={this.onMouseLeave}>
                    <Layer ref={this.layerRef}>
                        {colorbar}
                        {ticks}
                        {numbers}
                        {label}
                    </Layer>
                    <Layer>{hoverBar}</Layer>
                </Stage>
                {hoverInfo}
            </React.Fragment>
        );
    }
}
