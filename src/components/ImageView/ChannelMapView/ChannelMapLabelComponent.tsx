import * as React from "react";
import {fonts} from "ast_wrapper";
import classNames from "classnames";
import {observer} from "mobx-react";
import type {ImageItem} from "models";

import {Font} from "components/Shared";
import {AppStore, ChannelMapStore, type OverlaySettings} from "stores";
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
    private readonly fonts: Font[] = fonts.map((x, i) => new Font(x, i));

    render() {
        const channelMapStore = AppStore.Instance.channelMapStore;
        const frame = channelMapStore.displayedFrame;

        const channelText = channelMapStore.shouldShowChannelString ? this.props.channel : "";

        let spectralString = "";
        let velocityString = "";
        if ((channelMapStore.shouldShowFrequencyString || channelMapStore.shouldShowVelocityString) && frame) {
            ({spectralString, velocityString} = frame.getFreqWithChannel(this.props.channel));
        }

        if (channelMapStore.shouldShowFrequencyString) {
            spectralString = spectralString.replace(/^[^:]+:\s*/, "");
            if (!channelMapStore.shouldShowFrequencyStringUnit) {
                spectralString = spectralString.replace(/\s+[^ ]*$/, "");
            }
        } else {
            spectralString = "";
        }

        if (channelMapStore.shouldShowVelocityString) {
            velocityString = velocityString.replace(/^[^:]+:\s*/, "");
            if (!channelMapStore.shouldShowVelocityStringUnit) {
                velocityString = velocityString.replace(/\s+[^ ]*$/, "");
            }
        } else {
            velocityString = "";
        }

        const className = classNames("channel-map-label-span", {docked: this.props.docked});
        const font = this.fonts[channelMapStore.font];
        const hightlightBorderWidth = 2;

        return (
            <span
                className={className}
                style={{
                    color: channelMapStore.hasCustomColor ? getColorForTheme(channelMapStore.color) : getColorForTheme(ChannelMapStore.DEFAULT_LABEL_COLOR),
                    position: "absolute",
                    top: (this.props.top || 0) - 0.5 - hightlightBorderWidth,
                    left: (this.props.left || 0) + 0.5 - hightlightBorderWidth,
                    width: this.props.width + hightlightBorderWidth * 2,
                    height: this.props.height + hightlightBorderWidth * 2,
                    zIndex: 2,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    padding: "5px",
                    border: `${hightlightBorderWidth}px solid ${this.props.highlighted ? "red" : "transparent"}`,
                    fontFamily: font.family,
                    fontWeight: font.weight,
                    fontStyle: font.style,
                    fontSize: channelMapStore.fontSize
                }}
                id="channel-map-label-span"
            >
                <div>{channelText}</div>
                <div>{spectralString}</div>
                <div>{velocityString}</div>
            </span>
        );
    }
}
