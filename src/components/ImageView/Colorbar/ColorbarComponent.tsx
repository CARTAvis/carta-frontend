import * as React from "react";
import {observer} from "mobx-react";
import {action, observable, makeObservable} from "mobx";
import {Layer, Line, Rect, Stage, Text} from "react-konva";
import {Font} from "../ImageViewSettingsPanel/ImageViewSettingsPanelComponent"
import {ProfilerInfoComponent} from "components/Shared";
import {AppStore, dayPalette, nightPalette} from "stores";
import {fonts} from "ast_wrapper";
import "./ColorbarComponent.scss";

export interface ColorbarComponentProps {
    height: number;
    left: number;
}

@observer
export class ColorbarComponent extends React.Component<ColorbarComponentProps> {
    
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

        let scaledPos = (frame.renderHeight + yOffset - point.y) / frame.renderHeight;
 
        this.setHoverInfoText((frame.renderConfig.scaleMinVal + scaledPos * (frame.renderConfig.scaleMaxVal - frame.renderConfig.scaleMinVal)).toFixed(5));
        this.setCursorY(point.y);
    };
    
    private getColor = (): string => {
        const appStore = AppStore.Instance;
        const colorId = appStore.overlayStore.global.color
        return appStore.darkTheme ? nightPalette[colorId] : dayPalette[colorId];
    }

    private getRounding = (): number => {
        const appStore = AppStore.Instance;
        const max = appStore.activeFrame.renderConfig.scaleMaxVal;
        const min = appStore.activeFrame.renderConfig.scaleMinVal;
        const tickNum = appStore.overlayStore.colorbar.tickNum;
        const dy = Math.log10((max - min) / (tickNum + 1));
        return dy > 0 ? 0 : Math.ceil(-dy) + 1;
    }

    private renderColorbar = () => {
        const appStore = AppStore.Instance;
        const frame = appStore.activeFrame;
        const colorbarSettings = appStore.overlayStore.colorbar;
        const yOffset = appStore.overlayStore.padding.top;
        return (
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
                onMouseEnter={this.onMouseEnter}
                onMouseMove={this.handleMouseMove}
                onMouseLeave={this.onMouseLeave}
            />
        )
    };

    private renderTicksNumbers = () => {
        const appStore = AppStore.Instance;
        const frame = appStore.activeFrame;
        const colorbarSettings = appStore.overlayStore.colorbar;
        const yOffset = appStore.overlayStore.padding.top;

        const indexArray = Array.from(Array(colorbarSettings.tickNum).keys())
        let scaledArray = indexArray.map(x => (x + 1) / (colorbarSettings.tickNum + 1));
        const yPosArray = scaledArray.map(x => yOffset + frame.renderHeight * (1 - x));

        let text_dy = (frame.renderConfig.scaleMaxVal - frame.renderConfig.scaleMinVal) / (colorbarSettings.tickNum + 1);    
        let texts = indexArray.map(x => (frame.renderConfig.scaleMinVal + text_dy * (x + 1)).toFixed(this.getRounding()));

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
                {colorbarSettings.tickVisible ? ticks : null}
                {colorbarSettings.numberVisible ? numbers : null}
            </React.Fragment>
        );
    };

    private renderTitle = () => {
        const appStore = AppStore.Instance;
        const frame = appStore.activeFrame;
        const colorbarSettings = appStore.overlayStore.colorbar;
        const yOffset = appStore.overlayStore.padding.top;
        return (
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
        );
    };

    private renderHoverBar = () => {
        const colorbarSettings = AppStore.Instance.overlayStore.colorbar;
        return (
            <Line
                points={[colorbarSettings.offset, this.cursorY, colorbarSettings.rightBorderPos, this.cursorY]}
                stroke={this.getColor()}
                strokeWidth={0.5}
            />
        );
    };

    private renderHoverInfo = () => {
        const frame = AppStore.Instance.activeFrame;
        return (
            <div className={"colorbar-info"}>
                <ProfilerInfoComponent info={[`Colorscale: ${this.hoverInfoText} ${frame.unit}`]}/>
            </div>
        );
 
    };

    render() {
        const colorbarSettings = AppStore.Instance.overlayStore.colorbar;
        return (
            <React.Fragment>
                <Stage
                    className={"colorbar-stage"}
                    width={colorbarSettings.stageWidth}
                    height={this.props.height}
                    style={{left: this.props.left}}
                >
                    <Layer>
                        {this.renderColorbar()}
                        {colorbarSettings.tickVisible || colorbarSettings.numberVisible ? this.renderTicksNumbers() : null}
                        {colorbarSettings.labelVisible ? this.renderTitle() : null}
                    </Layer>
                    <Layer>
                        {colorbarSettings.showHoverInfo && this.showHoverInfo ? this.renderHoverBar() : null}
                    </Layer>
                </Stage>
                {colorbarSettings.showHoverInfo && this.showHoverInfo ? this.renderHoverInfo() : null}
            </React.Fragment>
        );
    }
}