import {observer} from "mobx-react";

import {TaskProgressDialogComponent} from "components/Dialogs";
import {AppStore} from "stores";
import {getFileSizeDisplay} from "utilities";

/**
 * Progress of the pending remote file download, shared by the HiPS and SIA tabs. Kept out of the
 * query panels so their forms do not re-render on every progress message.
 */
export const DownloadProgressDialog = observer(() => {
    const appStore = AppStore.Instance;
    const downloaded = appStore.downloadedBytes > 0 ? getFileSizeDisplay(appStore.downloadedBytes) : "";
    const total = appStore.totalBytes > 0 ? getFileSizeDisplay(appStore.totalBytes) : "";
    return (
        <TaskProgressDialogComponent
            isOpen={appStore.isDownloadingRemoteFile}
            progress={appStore.taskProgress >= 0 ? appStore.taskProgress : NaN}
            timeRemaining={appStore.estimatedTaskRemainingTime || 0}
            cancellable={false}
            text="Downloading image"
            contentText={downloaded && (total ? `${downloaded} of ${total}` : `${downloaded} downloaded`)}
        />
    );
});
