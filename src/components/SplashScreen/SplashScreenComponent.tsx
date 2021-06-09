import * as React from "react";
import {observer} from "mobx-react";
import {Classes, Intent, Overlay, Spinner} from "@blueprintjs/core";
import {AppStore} from "stores";
import {CARTA_INFO} from "models";
import logoPng from "static/carta_logo.png";
import "./SplashScreenComponent.scss";

@observer
export class SplashScreenComponent extends React.Component {
    public render() {
        const appStore = AppStore.Instance;

        let className = "splash-screen";
        if (appStore.darkTheme) {
            className += " bp3-dark";
        }

        return (
            <Overlay
                className={Classes.OVERLAY_SCROLL_CONTAINER}
                autoFocus={true}
                canEscapeKeyClose={false}
                canOutsideClickClose={false}
                isOpen={appStore.splashScreenVisible}
                usePortal={true}
            >
                <div className={className}>
                    <div className={"image-div"}>
                        <img src={logoPng} width={150} />
                    </div>
                    <div className={"appInfo-div"}>
                        <h1>
                            {CARTA_INFO.acronym} {CARTA_INFO.version} ({CARTA_INFO.date})
                        </h1>
                        <p>{CARTA_INFO.fullName}</p>
                    </div>
                    <Spinner intent={Intent.PRIMARY} size={30} value={null} />
                    <div className={"loadingInfo-div"}>
                        <p>{appStore.logStore.newestMsg}</p>
                    </div>
                </div>
            </Overlay>
        );
    }
}
