import * as React from "react";
import axios, {CancelTokenSource} from "axios";
// import {makeObservable} from "mobx";
import {observer} from "mobx-react";
// import axios from "axios";
import {AnchorButton, Classes, IDialogProps, Intent, Overlay, Spinner} from "@blueprintjs/core";
import {AppStore, CatalogOnlineQueryConfigStore, HelpType} from "stores";
import {DraggableDialogComponent} from "components/Dialogs";

@observer
export class CatalogQueryDialogComponent extends React.Component {
    private cancelTokenSource: CancelTokenSource;

    constructor(props: any) {
        super(props);
        // makeObservable(this);
        this.cancelTokenSource = axios.CancelToken.source();
    }

    public render() {
        const appStore = AppStore.Instance;
        const configStore = CatalogOnlineQueryConfigStore.Instance;

        let className = "catalog-query-dialog";
        if (appStore.darkTheme) {
            className += " bp3-dark";
        }

        const dialogProps: IDialogProps = {
            icon: "geosearch",
            className: className,
            backdropClassName: "minimal-dialog-backdrop",
            canOutsideClickClose: false,
            lazy: true,
            isOpen: appStore.dialogStore.catalogQueryDialogVisible,
            onClose: appStore.dialogStore.hideCatalogQueryDialog,
            title: "Online Catalog Query"
        };

        return (
            <DraggableDialogComponent dialogProps={dialogProps} helpType={HelpType.STOKES} minWidth={300} minHeight={250} defaultWidth={602} defaultHeight={300} enableResizing={true}>
                <div className="bp3-dialog-body">
                <Overlay className={Classes.OVERLAY_SCROLL_CONTAINER} autoFocus={true} canEscapeKeyClose={false} canOutsideClickClose={false} isOpen={configStore.isQuerying} usePortal={false}>
                    <div className="query-loading-overlay">
                        <Spinner intent={Intent.PRIMARY} size={30} value={null} />
                    </div>
                </Overlay>
                </div>
                <div className="bp3-dialog-footer">
                    <div className="bp3-dialog-footer-actions">
                        <AnchorButton
                            intent={Intent.SUCCESS}
                            disabled={configStore.isQuerying}
                            onClick={() => this.query()}
                            text={"Query"}
                        />
                        <AnchorButton
                            intent={Intent.WARNING}
                            disabled={!configStore.isQuerying}
                            onClick={() => this.cancelQuery()}
                            text={"Cancel"}
                        />
                        {/* <AnchorButton
                            intent={Intent.PRIMARY}
                            // disabled={appStore.fileLoading || !fileBrowserStore.selectedFile || !fileBrowserStore.fileInfoResp || fileBrowserStore.loadingInfo || !this.noneType}
                            // onClick={this.loadSelectedFiles}
                            text={"Load"}
                        />
                         <AnchorButton
                            intent={Intent.NONE}
                            // disabled={appStore.fileLoading || !fileBrowserStore.selectedFile || !fileBrowserStore.fileInfoResp || fileBrowserStore.loadingInfo}
                            onClick={AppStore.Instance.dialogStore?.hideCatalogQueryDialog}
                            text={"Close"}
                        /> */}
                    </div>
                </div>
            </DraggableDialogComponent>
        );
    }

    private query = () => {
        const configStore = CatalogOnlineQueryConfigStore.Instance;
        const baseUrl = "https://simbad.u-strasbg.fr/simbad/sim-tap/sync?request=doQuery&lang=adql&format=json&query=";
        const query = "SELECT Top 10000 * FROM basic WHERE CONTAINS(POINT('ICRS',ra,dec),CIRCLE('ICRS',250.423475,36.4613194444444,10))=1 AND ra IS NOT NULL AND dec IS NOT NULL";
        console.log("ooo", this.cancelTokenSource)
        configStore.setQueryStatus(true);
        
        AppStore.Instance.appendOnlineCatalog(baseUrl, query, this.cancelTokenSource)
        .then(catalogFileId => {
            console.log(catalogFileId)
            configStore.setQueryStatus(false);
        })
        .catch(error => {
            configStore.setQueryStatus(false);
            if(axios.isCancel(error)){
                this.cancelTokenSource = axios.CancelToken.source();
            } else {
                console.log(error);
            }
        });
    }

    private cancelQuery = () => {
        this.cancelTokenSource.cancel("Query canceled");
    }
}