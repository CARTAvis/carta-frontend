import * as React from "react";
import {observer} from "mobx-react";
import {action, observable, makeObservable} from "mobx";
import {Layer, Line, Rect, Stage, Text} from "react-konva";
import {Font} from "../ImageViewSettingsPanel/ImageViewSettingsPanelComponent"
import {ProfilerInfoComponent} from "components/Shared";
import {AppStore} from "stores";
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

        const scaledPos = (frame.renderHeight + yOffset - point.y) / frame.renderHeight;
        this.setHoverInfoText((frame.renderConfig.scaleMinVal + scaledPos * (frame.renderConfig.scaleMaxVal - frame.renderConfig.scaleMinVal)).toExponential(5));
        this.setCursorY(point.y);
    };

    render() {
        const appStore = AppStore.Instance;
        const frame = appStore.activeFrame;
        const colorbarSettings = appStore.overlayStore.colorbar;
        const yOffset = appStore.overlayStore.padding.top;
        const color = appStore.getASTColor;

        // to avoid blurring, add 0.5 px offset to colorbar with width <= 1px when necessary
        const isOnePixBorder = colorbarSettings.borderWidth <= 1;
        const colorbar = (
            <Rect
                x={colorbarSettings.offset + (isOnePixBorder && (this.props.left % 1 === 0) ? 0.5 / devicePixelRatio : 0)}
                y={yOffset - (isOnePixBorder && (yOffset % 1 === 0) ? 0.5 / devicePixelRatio : 0)}
                width={colorbarSettings.width}
                height={frame.renderHeight + (isOnePixBorder && (frame.renderHeight % 1 !== 0) ? ((yOffset % 1 === 0) ? 0.5 : -0.5) / devicePixelRatio : 0)}
                fillLinearGradientStartPoint={{x: 0, y: yOffset}}
                fillLinearGradientEndPoint={{x: 0, y: yOffset + frame.renderHeight}}
                fillLinearGradientColorStops={frame.renderConfig.colorscaleArray}
                stroke={colorbarSettings.borderVisible ? appStore.getASTColor : null}
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
                    ticks.push(
                        <Line
                            points={[colorbarSettings.rightBorderPos - colorbarSettings.tickLen, positions[i], colorbarSettings.rightBorderPos, positions[i]]}
                            stroke={color}
                            strokeWidth={colorbarSettings.tickWidth / devicePixelRatio}
                            key={i.toString()}
                        />
                    );
                }
                if (colorbarSettings.numberVisible) {
                    numbers.push(
                        <Text
                            text={texts[i]}
                            x={colorbarSettings.rightBorderPos + colorbarSettings.textGap}
                            y={colorbarSettings.numberRotated ? positions[i] + frame.renderHeight / 2 : positions[i] - colorbarSettings.numberFontSize / 2}
                            width={colorbarSettings.numberRotated ? frame.renderHeight : null}
                            align={"center"}
                            fill={color}
                            fontFamily={this.astFonts[colorbarSettings.numberFont].family}
                            fontStyle={`${this.astFonts[colorbarSettings.numberFont].style} ${this.astFonts[colorbarSettings.numberFont].weight}`}
                            fontSize={colorbarSettings.numberFontSize}
                            rotation={colorbarSettings.numberRotated ? -90 : 0}
                            key={i.toString()}
                        />
                    );
                }
            }
        }

        const label = colorbarSettings.labelVisible ? (
            <Text
                text={colorbarSettings.labelCustomText ? colorbarSettings.labelText : frame.unit}
                x={colorbarSettings.rightBorderPos + colorbarSettings.numberWidth + colorbarSettings.textGap}
                y={yOffset + frame.renderHeight}
                width={frame.renderHeight}
                align={"center"}
                fill={appStore.getASTColor}
                fontFamily={this.astFonts[colorbarSettings.labelFont].family}
                fontSize={colorbarSettings.labelFontSize}
                fontStyle={`${this.astFonts[colorbarSettings.labelFont].style} ${this.astFonts[colorbarSettings.labelFont].weight}`}
                rotation={-90}
                key={'0'}
            />
        ) : null;

        const hoverBar = colorbarSettings.showHoverInfo && this.showHoverInfo ? (
            <Line
                points={[colorbarSettings.offset, this.cursorY, colorbarSettings.rightBorderPos, this.cursorY]}
                stroke={appStore.getASTColor}
                strokeWidth={1 / devicePixelRatio}
            />
        ) : null;

        const hoverInfo = colorbarSettings.showHoverInfo && this.showHoverInfo ? (
            <div className={"colorbar-info"}>
                <ProfilerInfoComponent info={[`Colorscale: ${this.hoverInfoText} ${frame.unit}`]}/>
            </div>
        ) : null;

        return (
            <React.Fragment>
                <Stage
                    className={"colorbar-stage"}
                    width={colorbarSettings.stageWidth}
                    height={this.props.height}
                    style={{left: this.props.left}}
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