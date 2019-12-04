import * as React from "react";
import {observer} from "mobx-react";
import {Classes, Intent, Overlay, Spinner} from "@blueprintjs/core";
import {AppStore} from "stores";
import * as logoPng from "static/carta_logo.png";
import "./SplashScreenComponent.css";

@observer
export class SplashScreenComponent extends React.Component<{ appStore: AppStore }> {
    private handleClose = () => {
        this.props.appStore.hideSplashScreen();
    };

    public render() {
        const appStore = this.props.appStore;
        const logStore = this.props.appStore.logStore;

        let className = "splash-screen";
        if (appStore.darkTheme) {
            className += " bp3-dark";
        }

        return (
            <Overlay className={Classes.OVERLAY_SCROLL_CONTAINER} autoFocus={true} canEscapeKeyClose={true} canOutsideClickClose={false} isOpen={appStore.splashScreenVisible} usePortal={true} onClose={this.handleClose}>
                <div className={className}>
                    <div className={"image-div"}>
                        <img src={logoPng} width={180}/>
                        <h1>CARTA 1.3.0 (20191204)</h1>
                        <p>Cube Analysis and Rendering Tool for Astronomy</p>
                    </div>
                    <Spinner intent={Intent.PRIMARY} size={30} value={null}/>
                    <p>{logStore.newestMsg}</p>
                </div>
            </Overlay>
        );
    }
}