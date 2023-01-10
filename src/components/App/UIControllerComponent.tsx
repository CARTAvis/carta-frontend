import * as React from "react";
import {observer} from "mobx-react";
import {HelpDrawerComponent, RootMenuComponent, SplashScreenComponent} from "components";
import {
    AboutDialogComponent,
    CatalogQueryDialogComponent,
    CodeSnippetDialogComponent,
    ContourDialogComponent,
    ExternalPageDialogComponent,
    FileBrowserDialogComponent,
    FileInfoDialogComponent,
    PreferenceDialogComponent,
    RegionDialogComponent,
    SaveLayoutDialogComponent,
    StokesDialogComponent,
    TelemetryDialogComponent,
    VectorOverlayDialogComponent,
    FittingDialogComponent,
    DistanceMeasuringDialog
} from "components/Dialogs";
import {WorkspaceDialogComponent} from "../Dialogs/WorkspaceDialog/WorkspaceDialogComponent";
import {AppStore} from "stores";

@observer
export class UIControllerComponent extends React.Component {
    render() {
        const appStore = AppStore.Instance;

        return (
            <React.Fragment>
                <RootMenuComponent />
                <RegionDialogComponent />
                <CatalogQueryDialogComponent />
                <ContourDialogComponent />
                <VectorOverlayDialogComponent />
                <FileInfoDialogComponent />
                <FileBrowserDialogComponent />
                <PreferenceDialogComponent />
                <SaveLayoutDialogComponent />
                {appStore.dialogStore.saveWorkspaceDialogVisible ? <WorkspaceDialogComponent /> : null}
                <CodeSnippetDialogComponent />
                <AboutDialogComponent />
                <ExternalPageDialogComponent />
                <HelpDrawerComponent />
                <StokesDialogComponent />
                <TelemetryDialogComponent />
                <SplashScreenComponent />
                <FittingDialogComponent />
                <DistanceMeasuringDialog />
            </React.Fragment>
        );
    }
}
