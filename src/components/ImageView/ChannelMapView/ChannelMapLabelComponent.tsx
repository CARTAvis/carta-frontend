import * as React from "react";
import classNames from "classnames";
import {observer} from "mobx-react";

import {ImageItem, ImageType} from "models";
import {AppStore, OverlayStore} from "stores";

export class ChannelMapLabelComponentProps {
    overlaySettings: OverlayStore;
    image: ImageItem;
    docked: boolean;
    top?: number;
    left?: number;
    channel?: number;
}

@observer
export class ChannelMapLabelComponent extends React.Component<ChannelMapLabelComponentProps> {
    canvas: HTMLCanvasElement;

    componentDidMount() {
        this.updateImage();
    }

    componentDidUpdate() {
        this.updateImage();
    }

    updateImage() {
        AppStore.Instance.resetImageRatio();
        const pixelRatio = devicePixelRatio * AppStore.Instance.imageRatio;

        if (this.props.channel !== undefined && this.canvas) {
            requestAnimationFrame(() => {
                const destCanvas = this.canvas.getContext("2d", {willReadFrequently: true});
                const frame = AppStore.Instance.channelMapStore.masterFrame;
                const channelMapStore = AppStore.Instance.channelMapStore;
                this.canvas.width = this.props.overlaySettings.viewWidth * pixelRatio;
                this.canvas.height = this.props.overlaySettings.viewHeight * pixelRatio;
                const {spectralString, velocityString} = frame.getFreqWithChannel(this.props.channel);
                const longestString = Math.max(spectralString.length, velocityString.length);
                const fontSize = this.canvas.width / (longestString * 0.8);
                destCanvas.font = `${fontSize}px Arial`;
                destCanvas.fillStyle = "red";
                destCanvas.textAlign = "left";
                destCanvas.textBaseline = "top";
                const x = this.props.overlaySettings.paddingLeft * devicePixelRatio * AppStore.Instance.imageRatio + 10;
                let y = fontSize * 0.5;

                if (channelMapStore.showChannelString) {
                    destCanvas.fillText(`${channelMapStore.showChannelStringLabel ? "Channel: " : ""}${this.props.channel}`, x, y);
                    y += fontSize * 1.5;
                }
                if (channelMapStore.showSpectralString) {
                    const spectralLabelMatch = spectralString.match(/^[^:]+:\s*/);
                    const spectralLabel = channelMapStore.showSpectralStringLabel && spectralLabelMatch ? spectralLabelMatch[0] : "";
                    const spectralValue = spectralString.replace(/^[^:]+:\s*/, "");
                    destCanvas.fillText(`${spectralLabel}${spectralValue}`, x, y);
                    y += fontSize * 1.5;
                }
                if (channelMapStore.showVelocityString) {
                    const velocityLabelMatch = velocityString.match(/^[^:]+:\s*/);
                    const velocityLabel = channelMapStore.showVelocityStringLabel && velocityLabelMatch ? velocityLabelMatch[0] : "";
                    const velocityValue = velocityString.replace(/^[^:]+:\s*/, "");
                    destCanvas.fillText(`${velocityLabel}${velocityValue}`, x, y);
                    y += fontSize * 1.5;
                }
            });
        }
    }

    updateImageDimensions() {
        if (this.canvas) {
            this.canvas.width = this.props.overlaySettings.viewWidth * devicePixelRatio * AppStore.Instance.imageRatio;
            this.canvas.height = this.props.overlaySettings.viewHeight * devicePixelRatio * AppStore.Instance.imageRatio;
        }
    }

    private getRef = ref => {
        this.canvas = ref;
    };

    render() {
        const frame = this.props.image?.type === ImageType.COLOR_BLENDING ? this.props.image.store?.baseFrame : this.props.image?.store;
        const refFrame = frame.spatialReference ?? frame;
        // changing the frame view, padding or width/height triggers a re-render

        const w = this.props.overlaySettings?.viewWidth;
        const h = this.props.overlaySettings?.viewHeight;
        // Dummy variables for triggering re-render
        /* eslint-disable no-unused-vars, @typescript-eslint/no-unused-vars */
        const styleString = this.props.overlaySettings.styleString;
        const frameView = refFrame.requiredFrameView;
        const framePadding = this.props.overlaySettings.padding;
        const moving = frame.moving;
        const system = this.props.overlaySettings.global.system;
        const globalColor = this.props.overlaySettings.global.color;
        const titleColor = this.props.overlaySettings.title.color;
        const gridColor = this.props.overlaySettings.grid.color;
        const borderColor = this.props.overlaySettings.border.color;
        const oticksColor = this.props.overlaySettings.ticks.color;
        const axesColor = this.props.overlaySettings.axes.color;
        const numbersColor = this.props.overlaySettings.numbers.color;
        const labelsColor = this.props.overlaySettings.labels.color;
        const darktheme = AppStore.Instance.darkTheme;
        const title = this.props.overlaySettings.title.customText ? this.props.image?.store?.titleCustomText : this.props.image?.store?.filename;
        const ratio = AppStore.Instance.imageRatio;
        const titleStyleString = this.props.overlaySettings.title.styleString;
        const gridStyleString = this.props.overlaySettings.grid.styleString;
        const borderStyleString = this.props.overlaySettings.border.styleString;
        const ticksStyleString = this.props.overlaySettings.ticks.styleString;
        const axesStyleString = this.props.overlaySettings.axes.styleString;
        const numbersStyleString = this.props.overlaySettings.numbers.styleString;
        const labelsStyleString = this.props.overlaySettings.labels.styleString;
        const channelMapStartChannel = AppStore.Instance.channelMapStore.startChannel;
        const channelMapNumColumns = AppStore.Instance.channelMapStore.numColumns;
        const channelMapNumRows = AppStore.Instance.channelMapStore.numRows;
        const channelMapMasterFrame = AppStore.Instance.channelMapStore.masterFrame;
        const channelMapChannelNum = AppStore.Instance.channelMapStore.numChannels;
        const channelMapShowChannelString = AppStore.Instance.channelMapStore.showChannelString;
        const channelMapShowChannelStringLabel = AppStore.Instance.channelMapStore.showChannelStringLabel;
        const channelMapShowSpectralString = AppStore.Instance.channelMapStore.showSpectralString;
        const channelMapShowSpectralStringLabel = AppStore.Instance.channelMapStore.showSpectralStringLabel;
        const channelMapShowVelocityString = AppStore.Instance.channelMapStore.showVelocityString;
        const channelMapShowVelocityStringLabel = AppStore.Instance.channelMapStore.showVelocityStringLabel;
        const offsetCoord = frame.isOffsetCoord;
        const offsetWcs = frame.wcsInfoShifted;

        const className = classNames("channel-map-label-canvas", {docked: this.props.docked});

        return (
            <canvas
                className={className}
                style={{position: "absolute", top: this.props.top || 0, left: this.props.left || 0, width: w, height: h, zIndex: 2}}
                id="channel-map-label-canvas"
                ref={this.getRef}
                key={`channel-map-label-canvas-${frame.frameInfo.fileId}-${this.props.channel}`}
            />
        );
    }
}
