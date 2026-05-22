import * as React from "react";
import {Classes, H2, Intent, Overlay2, Spinner} from "@blueprintjs/core";
import classNames from "classnames";
import {observer} from "mobx-react";

import {CARTA_INFO} from "models";
import {ApiService} from "services";
import {AppStore} from "stores";

import "./SplashScreenComponent.scss";

@observer
export class SplashScreenComponent extends React.Component {
    public render() {
        const appStore = AppStore.Instance;
        const className = classNames("splash-screen", {[Classes.DARK]: appStore.isDarkTheme});

        return (
            <Overlay2 className={Classes.OVERLAY_SCROLL_CONTAINER} autoFocus={false} canEscapeKeyClose={false} canOutsideClickClose={false} isOpen={appStore.isSplashScreenVisible && !appStore.alertStore.isAlertVisible} usePortal={true}>
                <div className={className}>
                    <div className={"image-div"}>
                        <img src="carta_logo.png" width={150} />
                    </div>
                    <div className={"app-info-div"}>
                        <H2>
                            {CARTA_INFO.acronym} {CARTA_INFO.version} ({CARTA_INFO.date})
                        </H2>
                        <p>{CARTA_INFO.fullName}</p>
                    </div>
                    <Spinner intent={Intent.PRIMARY} size={30} />
                    <div className={"loading-info-div"}>
                        <p>{appStore.logStore.newestMsg}</p>
                    </div>
                    {ApiService.runtimeConfig?.dashboardAddress ? (
                        <div className="dashboard-info-div">
                            <a href={ApiService.runtimeConfig.dashboardAddress}>Connection problems? Open the CARTA dashboard</a>
                        </div>
                    ) : null}
                </div>
            </Overlay2>
        );
    }
}
