import * as React from "react";
import * as ReactDOM from "react-dom";
import ReactResizeDetector from "react-resize-detector";
import {Alert, Button, Classes, Intent} from "@blueprintjs/core";
import classNames from "classnames";
import {observer} from "mobx-react";

import {FloatingWidgetComponent, FloatingWidgetManagerComponent, getWidgetContent, UIControllerComponent} from "components";
import {TaskProgressDialogComponent} from "components/Dialogs";
import {ApiService} from "services";
import {AlertStore, AlertType, AppStore} from "stores";

import {HotkeyTargetContainer} from "./HotkeyWrapper";

import "./App.scss";
import "./layout-base.scss";
import "./layout-theme.scss";

const PipRenderer = observer(() => {
    const appStore = AppStore.Instance;
    const className = classNames("App", {[Classes.DARK]: appStore.darkTheme});

    const w = appStore.widgetsStore.floatingWidgets?.[0];
    if (!w) {
        return null;
    }

    return (
        <div className={className} style={{zIndex: 100}}>
            <FloatingWidgetComponent isSelected={true} key={"pip"} widgetConfig={w} zIndex={1} showPinButton={false} floatingWidgets={1} pinnedWindow={true}>
                {getWidgetContent(w)}
            </FloatingWidgetComponent>
        </div>
    );
});

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
                    <Alert icon={alertStore.alertIcon} className={classNames({[Classes.DARK]: darkTheme})} isOpen={alertStore.alertVisible} onClose={alertStore.dismissAlert} canEscapeKeyCancel={true}>
                        <p>{alertStore.alertText}</p>
                    </Alert>
                );
            case AlertType.Interactive:
                return (
                    <Alert
                        icon={alertStore.alertIcon}
                        className={classNames({[Classes.DARK]: darkTheme})}
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
                const cancelProps =
                    alertStore.showDashboardLink && ApiService.RuntimeConfig?.dashboardAddress
                        ? {
                              cancelButtonText: "Open CARTA Dashboard",
                              onCancel: () => window.open(ApiService.RuntimeConfig.dashboardAddress, "_blank")
                          }
                        : {};

                return (
                    <Alert
                        icon={alertStore.alertIcon}
                        className={classNames({[Classes.DARK]: darkTheme})}
                        isOpen={alertStore.alertVisible}
                        confirmButtonText="Retry"
                        {...cancelProps}
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

    async openWindow() {
        const appStore = AppStore.Instance;
        const pipWindow = await appStore.layoutStore.activatePip();
        if (pipWindow) {
            ReactDOM.render(<PipRenderer />, pipWindow.document.getElementById("pip-root") as HTMLElement);
        }
    }

    public render() {
        const appStore = AppStore.Instance;
        const className = classNames("App", {[Classes.DARK]: appStore.darkTheme});
        const glClassName = classNames("gl-container-app", {"dark-theme": appStore.darkTheme});

        const alertComponent = this.renderAlertComponent(appStore.alertStore, appStore.darkTheme);

        return (
            <div className={className}>
                {!appStore.layoutStore.pipActive && (
                    <div className="pip-button">
                        <Button icon="trophy" onClick={this.openWindow} />
                    </div>
                )}
                <UIControllerComponent />
                {alertComponent}
                <TaskProgressDialogComponent
                    progress={undefined}
                    timeRemaining={0}
                    isOpen={appStore.resumingSession || appStore.loadingWorkspace}
                    cancellable={false}
                    text={appStore.resumingSession ? "Resuming session..." : "Loading workspace..."}
                />
                <div className={glClassName} ref={ref => appStore.setAppContainer(ref)}>
                    <ReactResizeDetector handleWidth handleHeight onResize={this.onContainerResize} refreshMode={"throttle"} refreshRate={200}></ReactResizeDetector>
                </div>
                <HotkeyTargetContainer />
                <FloatingWidgetManagerComponent />
            </div>
        );
    }
}
