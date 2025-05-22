import * as React from "react";
import classNames from "classnames";
import {observer} from "mobx-react";

import {ImageItem} from "models";
import {AppStore, OverlayStore} from "stores";
import {getColorForTheme} from "utilities";

export class ChannelMapLabelComponentProps {
    overlaySettings: OverlayStore;
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
    render() {
        const channelMapStore = AppStore.Instance.channelMapStore;
        const frame = channelMapStore.displayedFrame;

        const channelText = channelMapStore.showChannelString ? this.props.channel : "";

        let spectralString = "";
        let velocityString = "";
        if (channelMapStore.showSpectralString || channelMapStore.showVelocityString) {
            ({spectralString, velocityString} = frame.getFreqWithChannel(this.props.channel));
        }

        if (channelMapStore.showSpectralString) {
            spectralString = spectralString.replace(/^[^:]+:\s*/, "");
            if (!channelMapStore.showSpectralStringUnit) {
                spectralString = spectralString.replace(/\s+[^ ]*$/, "");
            }
        } else {
            spectralString = "";
        }

        if (channelMapStore.showVelocityString) {
            velocityString = velocityString.replace(/^[^:]+:\s*/, "");
            if (!channelMapStore.showVelocityStringUnit) {
                velocityString = velocityString.replace(/\s+[^ ]*$/, "");
            }
        } else {
            velocityString = "";
        }

        const className = classNames("channel-map-label-span", {docked: this.props.docked});

        return (
            <span
                className={className}
                style={{
                    color: getColorForTheme(this.props.overlaySettings.global.color),
                    position: "absolute",
                    top: (this.props.top || 0) - 3,
                    left: (this.props.left || 0) - 3,
                    width: this.props.width + 6,
                    height: this.props.height + 6,
                    zIndex: 2,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    padding: "5px",
                    border: `${this.props.highlighted ? "3px solid red" : "none"}`
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
