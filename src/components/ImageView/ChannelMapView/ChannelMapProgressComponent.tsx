import * as React from "react";
import {Card, Classes, Intent, Overlay2, ProgressBar} from "@blueprintjs/core";
import classNames from "classnames";
import {observer} from "mobx-react";

import {TileService} from "services";
import {AppStore} from "stores";

import "./ChannelMapProgressComponent.scss";

export const ChannelMapProgressComponent: React.FC = observer(() => {
    const tileService = TileService.Instance;
    const appStore = AppStore.Instance;
    const totalTiles = tileService.channelMapTotalTiles;
    const renderedTiles = Math.min(tileService.channelMapRenderedTiles, totalTiles);
    const isOpen = totalTiles > 0 && renderedTiles < totalTiles;

    return (
        <Overlay2 autoFocus={false} canEscapeKeyClose={false} canOutsideClickClose={false} enforceFocus={false} hasBackdrop={false} isOpen={isOpen} transitionDuration={0}>
            <Card className={classNames("channel-map-progress-card", {[Classes.DARK]: appStore.isDarkTheme})} data-testid="channel-map-progress">
                <div className="channel-map-progress-label">
                    <span>Channel map tiles</span>
                    <span>
                        {renderedTiles} / {totalTiles}
                    </span>
                </div>
                <ProgressBar intent={Intent.PRIMARY} value={renderedTiles / totalTiles} />
            </Card>
        </Overlay2>
    );
});
