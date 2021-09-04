import * as React from "react";
import {observer} from "mobx-react";
import {RootMenuComponent, SplashScreenComponent, HelpDrawerComponent} from "components";
import {
    AboutDialogComponent,
    FileBrowserDialogComponent,
    PreferenceDialogComponent,
    RegionDialogComponent,
    SaveLayoutDialogComponent,
    FileInfoDialogComponent,
    ContourDialogComponent,
    DebugExecutionDialogComponent,
    ExternalPageDialogComponent,
    StokesDialogComponent,
    CatalogQueryDialogComponent
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
                <FileInfoDialogComponent />
                <FileBrowserDialogComponent />
                <PreferenceDialogComponent />
                <SaveLayoutDialogComponent />
                <DebugExecutionDialogComponent />
                <AboutDialogComponent />
                <ExternalPageDialogComponent />
                <HelpDrawerComponent />
                <StokesDialogComponent />
                <SplashScreenComponent />
            </React.Fragment>
        );
    }
}
