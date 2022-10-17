import * as React from "react";
import classNames from "classnames";
import {observer} from "mobx-react";
import {Classes, Intent, Overlay, Spinner} from "@blueprintjs/core";
import {AppStore} from "stores";
import {CARTA_INFO} from "models";
import {ApiService} from "services";
import "./SplashScreenComponent.scss";

@observer
export class SplashScreenComponent extends React.Component {
    public render() {
        const appStore = AppStore.Instance;
        const className = classNames("splash-screen", {"bp3-dark": appStore.darkTheme});

        return (
            <Overlay className={Classes.OVERLAY_SCROLL_CONTAINER} autoFocus={false} canEscapeKeyClose={false} canOutsideClickClose={false} isOpen={appStore.splashScreenVisible && !appStore.alertStore.alertVisible} usePortal={true}>
                <div className={className}>
                    <div className={"image-div"}>
                        <img src="carta_logo.png" width={150} />
                    </div>
                    <div className={"app-info-div"}>
                        <h1>
                            {CARTA_INFO.acronym} {CARTA_INFO.version} ({CARTA_INFO.date})
                        </h1>
                        <p>{CARTA_INFO.fullName}</p>
                    </div>
                    <Spinner intent={Intent.PRIMARY} size={30} />
                    <div className={"loading-info-div"}>
                        <p>{appStore.logStore.newestMsg}</p>
                    </div>
                    {ApiService.RuntimeConfig?.dashboardAddress ? (
                        <div className="dashboard-info-div">
                            <a href={ApiService.RuntimeConfig.dashboardAddress}>Connection problems? Open the CARTA dashboard</a>
                        </div>
                    ) : null}
                </div>
            </Overlay>
        );
    }
}
