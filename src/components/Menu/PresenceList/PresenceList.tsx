import {observer} from "mobx-react";

import {UserPresence} from "services";
import {AppStore} from "stores";

import {PresenceAvatar} from "./PresenceAvatar/PresenceAvatar";

import "./PresenceAvatar.scss";

interface PresenceListProps {
    users?: UserPresence[];
    size?: number;
}

export const PresenceList = observer(({users, size}: PresenceListProps) => {
    // Don't show the current user in the list
    const otherUsers = users?.filter(u => u.id !== AppStore.Instance.workspaceService.userId);

    if (!otherUsers?.length) {
        return null;
    }

    return (
        <div className="presence-list">
            {otherUsers.map(u => (
                <PresenceAvatar presence={u} size={size} key={u.id} />
            ))}
        </div>
    );
});
