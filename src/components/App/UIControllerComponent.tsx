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
    FittingDialogComponent
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
                <CodeSnippetDialogComponent />
                <AboutDialogComponent />
                <ExternalPageDialogComponent />
                <HelpDrawerComponent />
                <StokesDialogComponent />
                <TelemetryDialogComponent />
                <SplashScreenComponent />
                <FittingDialogComponent />
            </React.Fragment>
        );
    }
}
