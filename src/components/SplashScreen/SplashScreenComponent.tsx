import * as React from "react";
import {observer} from "mobx-react";
import {Classes, Overlay} from "@blueprintjs/core";
import {AppStore} from "stores";
import "./SplashScreenComponent.css";

@observer
export class SplashScreenComponent extends React.Component<{ appStore: AppStore }> {
    private handleClose = () => {
        this.props.appStore.hideSplashScreen();
    };

    public render() {
        const appStore = this.props.appStore;
        let className = "splash-screen";
        if (appStore.darkTheme) {
            className += " bp3-dark";
        }

        return (
            <Overlay className={Classes.OVERLAY_SCROLL_CONTAINER} canEscapeKeyClose={true} canOutsideClickClose={false} isOpen={appStore.splashScreenVisible} usePortal={true} onClose={this.handleClose}>
                <div className={className}>
                    <p>
                            CARTA
                    </p>
                </div>
            </Overlay>
        );
    }
}