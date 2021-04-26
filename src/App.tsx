import * as React from "react";

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
                    <Alert
                        icon={alertStore.alertIcon}
                        className={darkTheme ? "bp3-dark" : ""}
                        isOpen={alertStore.alertVisible}
                        onClose={alertStore.dismissAlert}
                        canEscapeKeyCancel={true}
                    >
                        <p>{alertStore.alertText}</p>
                    </Alert>
                );
            case AlertType.Interactive:
                return (
                    <Alert
                        icon={alertStore.alertIcon}
                        className={darkTheme ? "bp3-dark" : ""}
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
                        className={darkTheme ? "bp3-dark" : ""}
                        isOpen={alertStore.alertVisible}
                        confirmButtonText="Retry"
                        intent={Intent.DANGER}
                        onClose={alertStore.handleInteractiveAlertClosed}
                        canEscapeKeyCancel={false}
                    >
                        <p>{alertStore.interactiveAlertText}</p>
                    </Alert>
                );
            default:
                return null;
        }
    };

    public render() {
        const appStore = AppStore.Instance;
        let className = "App";
        let glClassName = "gl-container-app";
        if (appStore.darkTheme) {
            className += " bp3-dark";
            glClassName += " dark-theme";
        }

        const alertComponent = this.renderAlertComponent(appStore.alertStore, appStore.darkTheme);

        return (
            <div className={className}>
                <UIControllerComponent/>
                {alertComponent}
                <TaskProgressDialogComponent progress={undefined} timeRemaining={0} isOpen={appStore.resumingSession} cancellable={false} text={"Resuming session..."}/>
                <div className={glClassName} ref={ref => appStore.setAppContainer(ref)}>
                    <ReactResizeDetector handleWidth handleHeight onResize={this.onContainerResize} refreshMode={"throttle"} refreshRate={200}>
                    </ReactResizeDetector>
                </div>
                <HotkeyTargetContainer/>
                <FloatingWidgetManagerComponent/>
            </div>
        );
    }
}