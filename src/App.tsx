import * as React from "react";
import {Alert, Classes, Intent} from "@blueprintjs/core";
import classNames from "classnames";
import {observer} from "mobx-react";

import {FloatingWidgetManagerComponent, UIControllerComponent} from "components";
import {TaskProgressDialogComponent} from "components/Dialogs";
import {ResizeDetector} from "components/Shared";
import {AlertType} from "enums";
import {ApiService} from "services";
import {type AlertStore, AppStore} from "stores";

import {HotkeyService, HotkeysRegistrar} from "./HotkeyWrapper";

import "./App.scss";
import "./layout-base.scss";
import "./layout-theme.scss";

@observer
export class App extends React.Component {
    private appContainerRef: React.MutableRefObject<HTMLDivElement | null> = React.createRef<HTMLDivElement>();

    // GoldenLayout resize handler
    onContainerResize = (width, height) => {
        const appStore = AppStore.Instance;
        if (appStore.layoutStore.dockedLayout) {
            appStore.layoutStore.dockedLayout.updateSize(width, height);
        }
    };

    private renderAlertComponent = (alertStore: AlertStore, isDarkTheme: boolean) => {
        switch (alertStore.alertType) {
            case AlertType.Info:
                return (
                    <Alert icon={alertStore.alertIcon} className={classNames({[Classes.DARK]: isDarkTheme})} isOpen={alertStore.isAlertVisible} onClose={alertStore.dismissAlert} canEscapeKeyCancel={true}>
                        <p>{alertStore.alertText}</p>
                    </Alert>
                );
            case AlertType.Interactive:
                return (
                    <Alert
                        icon={alertStore.alertIcon}
                        className={classNames({[Classes.DARK]: isDarkTheme})}
                        isOpen={alertStore.isAlertVisible}
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
                    alertStore.shouldShowDashboardLink && ApiService.runtimeConfig?.dashboardAddress
                        ? {
                              cancelButtonText: "Open CARTA Dashboard",
                              onCancel: () => window.open(ApiService.runtimeConfig.dashboardAddress, "_blank")
                          }
                        : {};

                return (
                    <Alert
                        icon={alertStore.alertIcon}
                        className={classNames({[Classes.DARK]: isDarkTheme})}
                        isOpen={alertStore.isAlertVisible}
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

    private setAppContainerRef = (ref: HTMLDivElement | null) => {
        this.appContainerRef.current = ref;
        AppStore.Instance.setAppContainer(ref);
    };

    public render() {
        const appStore = AppStore.Instance;
        const className = classNames("App", {[Classes.DARK]: appStore.isDarkTheme});
        const glClassName = classNames("gl-container-app", {"dark-theme": appStore.isDarkTheme});

        const alertComponent = this.renderAlertComponent(appStore.alertStore, appStore.isDarkTheme);

        return (
            <div className={className}>
                <UIControllerComponent />
                {alertComponent}
                <TaskProgressDialogComponent
                    progress={0}
                    timeRemaining={0}
                    isOpen={appStore.isResumingSession || appStore.isLoadingWorkspace}
                    cancellable={false}
                    text={appStore.isResumingSession ? "Resuming session..." : "Loading workspace..."}
                />
                <ResizeDetector onResize={this.onContainerResize} throttleTime={200} targetRef={this.appContainerRef}>
                    <div className={glClassName} ref={this.setAppContainerRef} />
                </ResizeDetector>
                <HotkeysRegistrar />
                <HotkeyService />
                <FloatingWidgetManagerComponent />
            </div>
        );
    }
}
