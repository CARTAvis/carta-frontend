import * as React from "react";
import {observer} from "mobx-react";

import {HelpDrawerComponent, RootMenuComponent, SplashScreenComponent} from "components";
import {
    AboutDialogComponent,
    CatalogQueryDialogComponent,
    CodeSnippetDialogComponent,
    ContourDialogComponent,
    DistanceMeasuringDialog,
    ExternalPageDialogComponent,
    FileBrowserDialogComponent,
    FileInfoDialogComponent,
    FittingDialogComponent,
    PreferenceDialogComponent,
    RegionDialogComponent,
    SaveLayoutDialogComponent,
    StokesDialogComponent,
    TelemetryDialogComponent,
    VectorOverlayDialogComponent,
    WorkspaceDialogComponent
} from "components/Dialogs";

@observer
export class UIControllerComponent extends React.Component {
    render() {
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
                <WorkspaceDialogComponent />
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
