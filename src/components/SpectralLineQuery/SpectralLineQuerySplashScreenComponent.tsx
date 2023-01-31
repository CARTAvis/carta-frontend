import * as React from "react";
import {AnchorButton, ButtonGroup, Intent, Position, Spinner} from "@blueprintjs/core";
import {Tooltip2} from "@blueprintjs/popover2";
import classNames from "classnames";
import {observer} from "mobx-react";
import splatalogueLogoPng from "static/splatalogue_logo.png";

import {AppStore} from "stores";
import {SplataloguePingStatus} from "stores/Widgets";

import "./SpectralLineQuerySplashScreenComponent.scss";

@observer
export class SpectralLineQuerySplashScreenComponent extends React.Component<{splataloguePingStatus: SplataloguePingStatus; onReload: () => void}> {
    public render() {
        const appStore = AppStore.Instance;

        const className = classNames("spectral-line-query-splash-screen", {"bp3-dark": appStore.darkTheme});

        return (
            <div className={className}>
                <div className={"content"}>
                    <a href="https://splatalogue.online/" target="_blank" rel="noopener noreferrer">
                        <img src={splatalogueLogoPng} width={250} />
                    </a>
                    <a href="https://splatalogue.online/" target="_blank" rel="noopener noreferrer">
                        https://splatalogue.online/
                    </a>
                    {this.props.splataloguePingStatus === SplataloguePingStatus.Checking ? (
                        <Spinner intent={Intent.PRIMARY} size={30} value={null} />
                    ) : (
                        <ButtonGroup vertical={false}>
                            <Tooltip2 content="Reconnect to Splatalogue" position={Position.BOTTOM}>
                                <AnchorButton icon="repeat" onClick={this.props.onReload} />
                            </Tooltip2>
                        </ButtonGroup>
                    )}
                    <div className={"loadingInfo-div"}>
                        <p>
                            {this.props.splataloguePingStatus === SplataloguePingStatus.Checking
                                ? "Checking Splatalogue status..."
                                : "Connecting to Splatalogue failed! The service might be offline or your internet connection is interrupted. Please check and try again."}
                        </p>
                    </div>
                </div>
            </div>
        );
    }
}
