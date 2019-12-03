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
            <Overlay className={Classes.OVERLAY_SCROLL_CONTAINER} canEscapeKeyClose={true} canOutsideClickClose={false} isOpen={appStore.splashScreenVisible} usePortal={true} onClose={this.handleClose}>
                <div className={className}>
                    <img src={logoPng} width={180}/>
                    <Spinner intent={Intent.PRIMARY} size={30} value={null} />
                    <p>
                        {logStore.newestMsg}
                    </p>
                </div>
            </Overlay>
        );
    }
}