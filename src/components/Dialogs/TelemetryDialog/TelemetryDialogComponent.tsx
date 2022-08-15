import * as React from "react";
import classNames from "classnames";
import {makeObservable, observable} from "mobx";
import {observer} from "mobx-react";
import {Button, Classes, Dialog, Intent} from "@blueprintjs/core";
import {AppStore} from "stores";
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
        const consentRequired = appStore.telemetryService.consentRequired;
        const classes = classNames("telemetry-dialog", {"bp4-dark": appStore.darkTheme});

        return (
            <Dialog icon="data-connection" canOutsideClickClose={false} isCloseButtonShown={false} lazy={true} isOpen={appReady && consentRequired} className={classes} canEscapeKeyClose={false} title="CARTA Usage Data">
                <div className={Classes.DIALOG_BODY}>
                    <div className="image-div">
                        <img src={"carta_logo.png"} width={80} alt={"carta logo"} />
                        <div className="consent-note">
                            <p>
                                CARTA would like to collect anonymous usage data, in order to help the development team prioritize additional features and platforms. No personal or scientific information will be collected. Please see our{" "}
                                <a rel="noopener noreferrer" href="https://cartavis.org/telemetry" target="_blank">
                                    data collection policy
                                </a>{" "}
                                for more details.
                            </p>
                        </div>
                        <div className="button-grid">
                            <Button intent={Intent.PRIMARY} onClick={this.optInClicked}>
                                Yes, send usage data
                            </Button>
                            <Button intent={Intent.PRIMARY} onClick={this.optOutClicked}>
                                No, do not send usage data
                            </Button>
                            <div className="opt-note">Metrics include session duration, number and size of images opened.</div>
                            <div className="opt-note">Only an anonymous opt-out message will be submitted.</div>
                        </div>
                    </div>
                </div>
            </Dialog>
        );
    }
}
