import * as React from "react";
import classNames from "classnames";
import {observer} from "mobx-react";

import {ImageItem} from "models";
import {AppStore, OverlaySettings} from "stores";
import {getColorForTheme} from "utilities";

export class ChannelMapLabelComponentProps {
    overlaySettings: OverlaySettings;
    image: ImageItem;
    docked: boolean;
    top: number;
    left: number;
    width: number;
    height: number;
    channel: number;
    highlighted: boolean;
}

@observer
export class ChannelMapLabelComponent extends React.Component<ChannelMapLabelComponentProps> {
    private spanRef = React.createRef<HTMLSpanElement>();

    componentDidMount() {
        this.updateFontSize();
    }

    componentDidUpdate() {
        this.updateFontSize();
    }

    updateFontSize() {
        if (this.spanRef.current) {
            const spanWidth = this.spanRef.current.offsetWidth;
            const fontSize = spanWidth * 0.1;
            this.spanRef.current.style.fontSize = `${fontSize}px`;
        }
    }

    render() {
        const frame = AppStore.Instance.activeFrame;
        const channelMapStore = AppStore.Instance.channelMapStore;
        const {spectralString, velocityString} = frame.getFreqWithChannel(this.props.channel);

        const channelText = channelMapStore.showChannelString ? `${channelMapStore.showChannelStringLabel ? "Channel: " : ""}${this.props.channel}` : "";
        const spectralLabelMatch = spectralString.match(/^[^:]+:\s*/);
        const spectralLabel = channelMapStore.showSpectralStringLabel && spectralLabelMatch ? spectralLabelMatch[0] : "";
        const spectralValue = spectralString.replace(/^[^:]+:\s*/, "");
        const spectralText = channelMapStore.showSpectralString ? `${spectralLabel}${spectralValue}` : "";

        const velocityLabelMatch = velocityString.match(/^[^:]+:\s*/);
        const velocityLabel = channelMapStore.showVelocityStringLabel && velocityLabelMatch ? velocityLabelMatch[0] : "";
        const velocityValue = velocityString.replace(/^[^:]+:\s*/, "");
        const velocityText = channelMapStore.showVelocityString ? `${velocityLabel}${velocityValue}` : "";

        const className = classNames("channel-map-label-span", {docked: this.props.docked});
        const hightlightBorderWidth = 2;

        return (
            <span
                ref={this.spanRef}
                className={className}
                style={{
                    color: getColorForTheme(this.props.overlaySettings.global.color),
                    position: "absolute",
                    top: (this.props.top || 0) - 0.5 - hightlightBorderWidth,
                    left: (this.props.left || 0) + 0.5 - hightlightBorderWidth,
                    width: this.props.width + hightlightBorderWidth * 2,
                    height: this.props.height + hightlightBorderWidth * 2,
                    zIndex: 2,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    paddingLeft: `${this.props.width * 0.02}px`,
                    border: `${hightlightBorderWidth}px solid ${this.props.highlighted ? "red" : "transparent"}`
                }}
                id="channel-map-label-span"
            >
                <div>{channelText}</div>
                <div>{spectralText}</div>
                <div>{velocityText}</div>
            </span>
        );
    }
}
