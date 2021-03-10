import * as React from "react";

import {observer} from "mobx-react";
import ReactResizeDetector from "react-resize-detector";
import {Alert, Intent} from "@blueprintjs/core";
import {UIControllerComponent, FloatingWidgetManagerComponent} from "./components";
import {TaskProgressDialogComponent} from "./components/Dialogs";
import {AppStore} from "./stores";
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

    public render() {
        const appStore = AppStore.Instance;
        let className = "App";
        let glClassName = "gl-container-app";
        if (appStore.darkTheme) {
            className += " bp3-dark";
            glClassName += " dark-theme";
        }

        return (
            <div className={className}>
                <UIControllerComponent/>
                <Alert icon={appStore.alertStore.alertIcon} className={appStore.darkTheme ? "bp3-dark" : ""} isOpen={appStore.alertStore.alertVisible} onClose={appStore.alertStore.dismissAlert} canEscapeKeyCancel={true}>
                    <p>{appStore.alertStore.alertText}</p>
                </Alert>
                <Alert
                    icon={appStore.alertStore.alertIcon}
                    className={appStore.darkTheme ? "bp3-dark" : ""}
                    isOpen={appStore.alertStore.interactiveAlertVisible}
                    confirmButtonText="OK"
                    cancelButtonText="Cancel"
                    intent={Intent.DANGER}
                    onClose={appStore.alertStore.handleInteractiveAlertClosed}
                    canEscapeKeyCancel={true}
                >
                    <p>{appStore.alertStore.interactiveAlertText}</p>
                </Alert>
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