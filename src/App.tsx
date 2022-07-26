import * as React from "react";
import classNames from "classnames";
import {observer} from "mobx-react";
import ReactResizeDetector from "react-resize-detector";
import {Alert, Intent} from "@blueprintjs/core";
import {FloatingWidgetManagerComponent, UIControllerComponent} from "./components";
import {TaskProgressDialogComponent} from "./components/Dialogs";
import {AlertStore, AlertType, AppStore} from "./stores";
import {HotkeyTargetContainer} from "./HotkeyWrapper";
import "./App.scss";
import "./layout-base.scss";
import "./layout-theme.scss";

@observer
export class App extends React.Component {
    // GoldenLayout resize handler
    onContainerResize = (width, height) => {
        const appStore = AppStore.Instance;
        if (appStore.layoutStore.dockedLayout) {
            appStore.layoutStore.dockedLayout.updateSize(width, height);
        }
    };

    private renderAlertComponent = (alertStore: AlertStore, darkTheme: boolean) => {
        switch (alertStore.alertType) {
            case AlertType.Info:
                return (
                    <Alert icon={alertStore.alertIcon} className={classNames({"bp3-dark": darkTheme})} isOpen={alertStore.alertVisible} onClose={alertStore.dismissAlert} canEscapeKeyCancel={true}>
                        <p>{alertStore.alertText}</p>
                    </Alert>
                );
            case AlertType.Interactive:
                return (
                    <Alert
                        icon={alertStore.alertIcon}
                        className={classNames({"bp3-dark": darkTheme})}
                        isOpen={alertStore.alertVisible}
                        confirmButtonText="OK"
                        cancelButtonText="Cancel"
                        intent={Intent.DANGER}
                        onClose={alertStore.handleInteractiveAlertClosed}
                    >
                        <p>{alertStore.interactiveAlertText}</p>
                    </Alert>
                );
            case AlertType.Retry:
                return (
                    <Alert
                        icon={alertStore.alertIcon}
                        className={classNames({"bp3-dark": darkTheme})}
                        isOpen={alertStore.alertVisible}
                        confirmButtonText="Retry"
                        intent={Intent.DANGER}
                        onClose={alertStore.handleInteractiveAlertClosed}
                        canEscapeKeyCancel={false}
                    >
                        <p>{alertStore.interactiveAlertText}</p>
                    </Alert>
                );
            case AlertType.NewRelease:
                return (
                    <Alert
                        icon={<img src="carta_logo.png" width={50} />}
                        className={classNames("new-release", {"bp3-dark": darkTheme})}
                        isOpen={alertStore.alertVisible}
                        confirmButtonText="OK"
                        cancelButtonText="Don't show again"
                        intent={Intent.PRIMARY}
                        onClose={alertStore.handleInteractiveAlertClosed}
                    >
                        <p>A new CARTA release is available now!</p>
                        <p>
                            Visit our{" "}
                            <a href="https://cartavis.org" rel="noopener noreferrer" target="_blank">
                                official website
                            </a>{" "}
                            for more details.
                        </p>
                    </Alert>
                );
            default:
                return null;
        }
    };

    public render() {
        const appStore = AppStore.Instance;
        const className = classNames("App", {"bp3-dark": appStore.darkTheme});
        const glClassName = classNames("gl-container-app", {"dark-theme": appStore.darkTheme});

        const alertComponent = this.renderAlertComponent(appStore.alertStore, appStore.darkTheme);

        return (
            <div className={className}>
                <UIControllerComponent />
                {alertComponent}
                <TaskProgressDialogComponent progress={undefined} timeRemaining={0} isOpen={appStore.resumingSession} cancellable={false} text={"Resuming session..."} />
                <div className={glClassName} ref={ref => appStore.setAppContainer(ref)}>
                    <ReactResizeDetector handleWidth handleHeight onResize={this.onContainerResize} refreshMode={"throttle"} refreshRate={200}></ReactResizeDetector>
                </div>
                <HotkeyTargetContainer />
                <FloatingWidgetManagerComponent />
            </div>
        );
    }
}
