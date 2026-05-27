import {Classes, type DialogProps, Tab, Tabs} from "@blueprintjs/core";
import classNames from "classnames";
import {observer} from "mobx-react";

import {DraggableDialogComponent} from "components/Dialogs";
import {DialogId, HelpType, OnlineDataQueryDialogTabs} from "enums";
import {AppStore} from "stores";

import {CatalogQueryComponent} from "./CatalogOnlineQueryComponent";
import {HipsQueryComponent} from "./HipsQueryComponent";

import "./OnlineDataQueryDialogComponent.scss";

const DEFAULT_WIDTH = 600;
const DEFAULT_HEIGHT = 550;
const MIN_WIDTH = 450;
const MIN_HEIGHT = 200;

export const OnlineDataQueryDialogComponent = observer(() => {
    const appStore = AppStore.Instance;
    const className = classNames("online-data-query-dialog", {[Classes.DARK]: appStore.isDarkTheme});
    const dialogProps: DialogProps = {
        icon: "geosearch",
        className: className,
        backdropClassName: "minimal-dialog-backdrop",
        canOutsideClickClose: false,
        lazy: true,
        isOpen: appStore.dialogStore.dialogVisible.get(DialogId.OnlineDataQuery) || false,
        title: "Online Data Query"
    };

    return (
        <DraggableDialogComponent
            dialogProps={dialogProps}
            helpType={HelpType.ONLINE_CATALOG_QUERY}
            defaultWidth={DEFAULT_WIDTH}
            defaultHeight={DEFAULT_HEIGHT}
            minWidth={MIN_WIDTH}
            minHeight={MIN_HEIGHT}
            isResizingEnabled={true}
            dialogId={DialogId.OnlineDataQuery}
        >
            <div className={Classes.DIALOG_BODY}>
                <Tabs id="onlineQueryDialogTabs">
                    <Tab id={OnlineDataQueryDialogTabs.Catalog} title="Catalog" panel={<CatalogQueryComponent />} />
                    <Tab id={OnlineDataQueryDialogTabs.Hips} title="HiPS Survey" panel={<HipsQueryComponent />} />
                </Tabs>
            </div>
        </DraggableDialogComponent>
    );
});
