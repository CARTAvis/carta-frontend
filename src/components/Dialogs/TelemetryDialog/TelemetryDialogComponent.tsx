import * as React from "react";
import {makeObservable, observable} from "mobx";
import {observer} from "mobx-react";
import {AnchorButton, Classes, Dialog, DialogProps, Intent} from "@blueprintjs/core";
import {AppStore} from "stores";
import {CARTA_INFO} from "models";
import {TelemetryMode, TelemetryService} from "services";
import "./TelemetryDialogComponent.scss";

@observer
export class TelemetryDialogComponent extends React.Component {
    @observable allowUsageStats: boolean = true;

    constructor(props: any) {
        super(props);
        makeObservable(this);
    }

    optInClicked = async () => {
        await TelemetryService.Instance.optIn(this.allowUsageStats ? TelemetryMode.Usage : TelemetryMode.Minimal);
    };

    optOutClicked = async () => {
        await TelemetryService.Instance.optOut();
    };

    public render() {
        const appStore = AppStore.Instance;
        const appReady = appStore.apiService?.authenticated;
        const consentShown = appStore.preferenceStore.telemetryConsentShown;

        const dialogProps: DialogProps = {
            icon: "info-sign",
            canOutsideClickClose: false,
            isCloseButtonShown: false,
            lazy: true,
            isOpen: appReady && !consentShown,
            className: "telemetry-dialog",
            canEscapeKeyClose: false,
            title: "CARTA Usage Collection"
        };

        return (
            <Dialog {...dialogProps}>
                <div className={Classes.DIALOG_BODY}>
                    <div className={"image-div"}>
                        <img src={"carta_logo.png"} width={80} alt={"carta logo"} />
                        <h3>
                            {CARTA_INFO.acronym} {CARTA_INFO.version} ({CARTA_INFO.date})
                        </h3>
                        <p>{CARTA_INFO.fullName}</p>
                    </div>
                </div>
                <div className={Classes.DIALOG_FOOTER}>
                    <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                        <AnchorButton intent={Intent.SUCCESS} onClick={this.optInClicked} text="Yes" />
                        <AnchorButton intent={Intent.DANGER} onClick={this.optOutClicked} text="No" />
                    </div>
                </div>
            </Dialog>
        );
    }
}
