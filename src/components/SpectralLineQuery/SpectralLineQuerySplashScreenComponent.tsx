import * as React from "react";
import {observer} from "mobx-react";
import {AnchorButton, ButtonGroup, Classes, Intent, Overlay, Position, Spinner} from "@blueprintjs/core";
import {Tooltip2} from "@blueprintjs/popover2";
import {AppStore} from "stores";
import {SplataloguePingStatus} from "stores/widgets";
import splatalogueLogoPng from "static/splatalogue_logo.png";
import "./SpectralLineQuerySplashScreenComponent.scss";

@observer
export class SpectralLineQuerySplashScreenComponent extends React.Component<{splataloguePingStatus: SplataloguePingStatus, onReload: () => void, onClose: () => void}> {
    public render() {
        const appStore = AppStore.Instance;

        let className = "spectral-line-query-splash-screen";
        if (appStore.darkTheme) {
            className += " bp3-dark";
        }

        return (
            <Overlay className={Classes.OVERLAY_SCROLL_CONTAINER} autoFocus={true} canEscapeKeyClose={false} canOutsideClickClose={false} isOpen={this.props.splataloguePingStatus !== SplataloguePingStatus.Success} usePortal={false}>
                <div className={className}>
                    <a href="https://splatalogue.online/" target="_blank" rel="noopener noreferrer"><img src={splatalogueLogoPng} width={250}/></a>
                    <a href="https://splatalogue.online/" target="_blank" rel="noopener noreferrer">https://splatalogue.online/</a>
                    {this.props.splataloguePingStatus === SplataloguePingStatus.Checking ?
                        <Spinner intent={Intent.PRIMARY} size={30} value={null}/> :
                        <ButtonGroup vertical={false}>
                            <Tooltip2 content="Reconnect to Splatalogue" position={Position.BOTTOM}>
                                <AnchorButton icon="repeat" onClick={this.props.onReload}/>
                            </Tooltip2>
                            <Tooltip2 content="Close Spectral Line Query widget" position={Position.BOTTOM}>
                                <AnchorButton icon="cross" onClick={this.props.onClose}/>
                            </Tooltip2>
                        </ButtonGroup>
                    }
                    <div className={"loadingInfo-div"}>
                        <p>{this.props.splataloguePingStatus === SplataloguePingStatus.Checking ? "Checking Splatalogue status..." : "Connecting to Splatalogue failed! Please try again."}</p>
                    </div>
                </div>
            </Overlay>
        );
    }
}
