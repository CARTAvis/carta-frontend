import * as React from "react";
import {observer} from "mobx-react";
import {action, observable, makeObservable} from "mobx";
import {Layer, Line, Rect, Stage, Text} from "react-konva";
import {ProfilerInfoComponent} from "components/Shared";
import {AppStore} from "stores";
import {fonts} from "ast_wrapper";
import {Font} from "../ImageViewSettingsPanel/ImageViewSettingsPanelComponent"
import {getColorForTheme} from "utilities";
import "./ColorbarComponent.scss";

@observer
export class ColorbarComponent extends React.Component {
    
    @observable hoverInfoText: string =  "";
    @observable showHoverInfo: boolean = false;
    @observable cursorY: number = -1;
    private astFonts: Font[] = fonts.map((x, i) => (new Font(x, i)));

    constructor(props) {
        super(props);
        makeObservable(this);
    }

    @action setHoverInfoText = (text: string) => {
        this.hoverInfoText = text;
    };

    @action onMouseEnter = () => {
        this.showHoverInfo = true;
    };

    @action onMouseLeave = () => {
        this.showHoverInfo = false;
    };

    @action setCursorY = (y: number) => {
        this.cursorY = y;
    };

    private handleMouseMove = (event) => {
        const stage = event.target.getStage();
        const point = stage.getPointerPosition();

        const appStore = AppStore.Instance;
        const frame = appStore.activeFrame;
        const yOffset = appStore.overlayStore.padding.top;

        const scaledPos = (frame.renderHeight + yOffset - point.y) / frame.renderHeight;
        this.setHoverInfoText((frame.renderConfig.scaleMinVal + scaledPos * (frame.renderConfig.scaleMaxVal - frame.renderConfig.scaleMinVal)).toExponential(5));
        this.setCursorY(point.y);
    };

    render() {
        const appStore = AppStore.Instance;
        const frame = appStore.activeFrame;
        const colorbarSettings = appStore.overlayStore.colorbar;
        const yOffset = appStore.overlayStore.padding.top;

        let getColor = (customColor: boolean, color: string): string => {
            return customColor ? getColorForTheme(color) : (colorbarSettings.customColor ? getColorForTheme(colorbarSettings.color) : getColorForTheme(appStore.overlayStore.global.color));
        };

        // to avoid blurry border when width <= 1px, add 0.5 px offset to the colorbar if necessary
        const isOnePixBorder = colorbarSettings.borderWidth <= 1;
        let isIntPosition = (position: number): boolean => {
            return (position * devicePixelRatio) % 1 === 0;
        };

        const colorbar = (
            <Rect
                x={colorbarSettings.offset + (isOnePixBorder && (isIntPosition(appStore.overlayStore.padding.left + appStore.overlayStore.renderWidth) ? 0.5 / devicePixelRatio : 0))}
                y={yOffset - (isOnePixBorder && (isIntPosition(yOffset) ? 0.5 / devicePixelRatio : 0))}
                width={colorbarSettings.width}
                height={frame.renderHeight + (isOnePixBorder && (!isIntPosition(frame.renderHeight) ? (isIntPosition(yOffset) ? 0.5 : -0.5) / devicePixelRatio : 0))}
                fillLinearGradientStartPoint={{x: 0, y: yOffset}}
                fillLinearGradientEndPoint={{x: 0, y: yOffset + frame.renderHeight}}
                fillLinearGradientColorStops={frame.renderConfig.colorscaleArray}
                stroke={colorbarSettings.borderVisible ? getColor(colorbarSettings.borderCustomColor, colorbarSettings.borderColor) : null}
                strokeWidth={colorbarSettings.borderWidth / devicePixelRatio}
                onMouseEnter={this.onMouseEnter}
                onMouseMove={this.handleMouseMove}
                onMouseLeave={this.onMouseLeave}
            />
        );

        let ticks = [];
        let numbers = [];
        if (colorbarSettings.tickVisible || colorbarSettings.numberVisible) {
            const texts = colorbarSettings.texts;
            const positions = colorbarSettings.positions;
    
            for (let i = 0; i < positions.length; i++) {
                if (colorbarSettings.tickVisible) {
                    // to avoid blurry ticks when width <= 1px, offset to .5 px position 
                    const position = positions[i] - ((colorbarSettings.tickWidth <= 1) && (positions[i] - Math.floor(positions[i]) - 0.5 / devicePixelRatio));
                    ticks.push(
                        <Line
                            points={[colorbarSettings.rightBorderPos - colorbarSettings.tickLen, position, colorbarSettings.rightBorderPos, position]}
                            stroke={getColor(colorbarSettings.tickCustomColor, colorbarSettings.tickColor)}
                            strokeWidth={colorbarSettings.tickWidth / devicePixelRatio}
                            key={i.toString()}
                        />
                    );
                }
                if (colorbarSettings.numberVisible) {
                    numbers.push(
                        <Text
                            text={texts[i]}
                            x={colorbarSettings.rightBorderPos + colorbarSettings.textGap + (colorbarSettings.numberRotation === 90 ? colorbarSettings.numberFontSize : 0)}
                            y={colorbarSettings.numberRotation === 0 ? positions[i] - colorbarSettings.numberFontSize / 2 : positions[i] - frame.renderHeight / 2 * colorbarSettings.numberRotation / 90}
                            width={colorbarSettings.numberRotation === 0 ? null : frame.renderHeight}
                            align={"center"}
                            fill={getColor(colorbarSettings.numberCustomColor, colorbarSettings.numberColor)}
                            fontFamily={this.astFonts[colorbarSettings.numberFont].family}
                            fontStyle={`${this.astFonts[colorbarSettings.numberFont].style} ${this.astFonts[colorbarSettings.numberFont].weight}`}
                            fontSize={colorbarSettings.numberFontSize}
                            rotation={colorbarSettings.numberRotation}
                            key={i.toString()}
                        />
                    );
                }
            }
        }

        const frameUnit = frame.unit === undefined || !frame.unit.length ? "arbitrary units" : frame.unit;
        const label = colorbarSettings.labelVisible ? (
            <Text
                text={colorbarSettings.labelCustomText ? frame.colorbarLabelCustomText : frameUnit}
                x={colorbarSettings.rightBorderPos + colorbarSettings.numberWidth + colorbarSettings.textGap + (colorbarSettings.labelRotation === 90 ? colorbarSettings.numberFontSize : 0)}
                y={yOffset + (colorbarSettings.labelRotation === -90 ? frame.renderHeight : 0)}
                width={frame.renderHeight}
                align={"center"}
                fill={getColor(colorbarSettings.labelCustomColor, colorbarSettings.labelColor)}
                fontFamily={this.astFonts[colorbarSettings.labelFont].family}
                fontSize={colorbarSettings.labelFontSize}
                fontStyle={`${this.astFonts[colorbarSettings.labelFont].style} ${this.astFonts[colorbarSettings.labelFont].weight}`}
                rotation={colorbarSettings.labelRotation}
                key={'0'}
            />
        ) : null;
        
        const hoverBar = colorbarSettings.showHoverInfo && this.showHoverInfo ? (
            <Line
                points={[colorbarSettings.offset, this.cursorY, colorbarSettings.rightBorderPos, this.cursorY]}
                stroke={colorbarSettings.customColor ? getColorForTheme(colorbarSettings.color) : getColorForTheme(appStore.overlayStore.global.color)}
                strokeWidth={1 / devicePixelRatio}
            />
        ) : null;

        const hoverInfo = colorbarSettings.showHoverInfo && this.showHoverInfo ? (
            <div className={"colorbar-info"}>
                <ProfilerInfoComponent info={[`Colorscale: ${this.hoverInfoText} ${frame.unit}`]}/>
            </div>
        ) : null;

        let top;
        switch(colorbarSettings.position) {
            case("bottom"):
                top = appStore.overlayStore.padding.top + appStore.overlayStore.renderHeight + appStore.overlayStore.numberWidth + appStore.overlayStore.labelWidth;
                break;
            case("top"):
                top = appStore.overlayStore.title.show ? appStore.overlayStore.padding.top - colorbarSettings.totalWidth - appStore.overlayStore.base : 0;
                break;
            case("right"):
            default:
                top = 0;
                break;
        }

        return (
            <React.Fragment>
                <Stage
                    className={"colorbar-stage"}
                    width={colorbarSettings.position === "right" ? colorbarSettings.stageWidth : appStore.overlayStore.viewWidth}
                    height={colorbarSettings.position === "right" ? appStore.overlayStore.viewHeight : colorbarSettings.stageWidth}
                    style={{
                        left: colorbarSettings.position === "right" ? appStore.overlayStore.padding.left + appStore.overlayStore.renderWidth : 0,
                        top: top
                    }}
                >
                    <Layer>
                        {colorbar}
                        {ticks}
                        {numbers}
                        {label}
                    </Layer>
                    <Layer>
                        {hoverBar}
                    </Layer>
                </Stage>
                {hoverInfo}
            </React.Fragment>
        );
    }
}