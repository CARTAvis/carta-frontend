import * as React from "react";
import {Alert, Classes, Intent} from "@blueprintjs/core";
import classNames from "classnames";
import {observer} from "mobx-react";

import {FlexLayoutContainer, FloatingWidgetManagerComponent, UIControllerComponent} from "components";
import {TaskProgressDialogComponent} from "components/Dialogs";
import {ResizeDetector} from "components/Shared";
import {AlertType} from "enums";
import {ApiService} from "services";
import {AlertStore, AppStore} from "stores";

import {HotkeyTargetContainer} from "./HotkeyWrapper";

import "./App.scss";
import "./layout-base.scss";
import "./layout-theme.scss";

@observer
export class App extends React.Component {
    private appContainerRef: React.MutableRefObject<HTMLDivElement | null> = React.createRef<HTMLDivElement>();

    // FlexLayout resize handler
    onContainerResize = (width, height) => {
        // FlexLayout handles resizing automatically through CSS
        // No manual intervention needed like GoldenLayout
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

    private setAppContainerRef = (ref: HTMLDivElement | null) => {
        this.appContainerRef.current = ref;
        if (ref) {
            AppStore.Instance.setAppContainer(ref);
        }
    };

    public render() {
        const appStore = AppStore.Instance;
        const className = classNames("App", {[Classes.DARK]: appStore.darkTheme});
        const flexClassName = classNames("flex-container-app", {"dark-theme": appStore.darkTheme});

        const alertComponent = this.renderAlertComponent(appStore.alertStore, appStore.darkTheme);

        return (
            <div className={className}>
                <UIControllerComponent />
                {alertComponent}
                <TaskProgressDialogComponent
                    progress={0}
                    timeRemaining={0}
                    isOpen={appStore.resumingSession || appStore.loadingWorkspace}
                    cancellable={false}
                    text={appStore.resumingSession ? "Resuming session..." : "Loading workspace..."}
                />
                <ResizeDetector onResize={this.onContainerResize} throttleTime={200} targetRef={this.appContainerRef}>
                    <div className={flexClassName} ref={this.setAppContainerRef}>
                        <FlexLayoutContainer darkTheme={appStore.darkTheme} />
                    </div>
                </ResizeDetector>
                <HotkeyTargetContainer />
                <FloatingWidgetManagerComponent />
            </div>
        );
    }
}
