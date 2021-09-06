import * as React from "react";
import classNames from "classnames";
import {observer} from "mobx-react";
import {Classes, Intent, Overlay, Spinner} from "@blueprintjs/core";
import {AppStore} from "stores";
import {CARTA_INFO} from "models";
import "./SplashScreenComponent.scss";

@observer
export class SplashScreenComponent extends React.Component {
    public render() {
        const appStore = AppStore.Instance;
        const className = classNames("splash-screen", {"bp3-dark": appStore.darkTheme});

        return (
            <Overlay className={Classes.OVERLAY_SCROLL_CONTAINER} autoFocus={false} canEscapeKeyClose={false} canOutsideClickClose={false} isOpen={appStore.splashScreenVisible} usePortal={true}>
                <div className={className}>
                    <div className={"image-div"}>
                        <img src="carta_logo.png" width={150} />
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
