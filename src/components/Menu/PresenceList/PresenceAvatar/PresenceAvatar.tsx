import {CSSProperties} from "react";
import * as React from "react";
import {Position} from "@blueprintjs/core";
import {Tooltip2} from "@blueprintjs/popover2";
import {observer} from "mobx-react";

import {UserPresence} from "services";

import {AppStore} from "../../../../stores";

import "./PresenceAvatar.scss";

interface PresenceAvatarProps {
    presence: UserPresence;
    size?: number;
}

export const PresenceAvatar = observer(({presence, size}: PresenceAvatarProps) => {
    const style: CSSProperties = {};
    if (size) {
        style.width = size;
        style.height = size;
        style.lineHeight = size;
        style.fontSize = size / 2;
    }
    if (presence.color) {
        style.backgroundColor = presence.color;
    }

    let activeFile = AppStore.Instance.frames?.find(f => f.replicatedId === presence.cursor?.id);

    return (
        <Tooltip2
            content={
                <span>
                    {presence.name}
                    <br />
                    <i>
                        <small>
                            Viewing {activeFile?.filename ?? "Unknown file"}
                            <br /> Click to jump to their view
                        </small>
                    </i>
                </span>
            }
            position={Position.BOTTOM}
        >
            <div className="presence-avatar" style={style}>
                <p>{presence.name?.[0] ?? "?"}</p>
            </div>
        </Tooltip2>
    );
});
