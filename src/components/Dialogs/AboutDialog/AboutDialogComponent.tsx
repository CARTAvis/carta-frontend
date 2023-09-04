import * as React from "react";
import {AnchorButton, Classes, IDialogProps, Intent} from "@blueprintjs/core";
import {observer} from "mobx-react";

import {DraggableDialogComponent} from "components/Dialogs";
import {year, CARTA_INFO} from "models";
import {DialogStore} from "stores";

import "./AboutDialogComponent.scss";

@observer
export class AboutDialogComponent extends React.Component {
    public render() {
        const dialogStore = DialogStore.Instance;

        const dialogProps: IDialogProps = {
            icon: "info-sign",
            backdropClassName: "minimal-dialog-backdrop",
            canOutsideClickClose: true,
            lazy: true,
            isOpen: dialogStore.aboutDialogVisible,
            onClose: dialogStore.hideAboutDialog,
            className: "about-dialog",
            canEscapeKeyClose: true,
            title: "About CARTA"
        };

        return (
            <DraggableDialogComponent dialogProps={dialogProps} defaultWidth={620} defaultHeight={705} enableResizing={false}>
                <div className={Classes.DIALOG_BODY}>
                    <div className={"image-div"}>
                        <img src="carta_logo.png" width={80} />
                        <h3>
                            {CARTA_INFO.acronym} {CARTA_INFO.version} ({CARTA_INFO.date})
                        </h3>
                        <p>{CARTA_INFO.fullName}</p>
                    </div>
                    <h3>Development team:</h3>
                    <p>The development of the CARTA project is a joint effort from:</p>
                    <ul>
                        <li>
                            <a href="https://www.asiaa.sinica.edu.tw/" rel="noopener noreferrer" target="_blank">
                                Academia Sinica, Institute of Astronomy and Astrophysics (ASIAA)
                            </a>
                        </li>
                        <li>
                            <a href="https://idia.ac.za/" rel="noopener noreferrer" target="_blank">
                                Inter-University Institute for Data Intensive Astronomy (IDIA)
                            </a>
                        </li>
                        <li>
                            <a href="https://science.nrao.edu/" rel="noopener noreferrer" target="_blank">
                                National Radio Astronomy Observatory (NRAO)
                            </a>
                        </li>
                        <li>
                            <a href="https://www.ualberta.ca/physics" rel="noopener noreferrer" target="_blank">
                                Department of Physics, University of Alberta
                            </a>
                        </li>
                    </ul>
                    <h3>Useful links:</h3>
                    <ul>
                        <li>
                            Source code for CARTA is available on{" "}
                            <a href="https://github.com/cartavis" rel="noopener noreferrer" target="_blank">
                                GitHub
                            </a>
                        </li>
                        {/* tslint:disable-next-line:max-line-length */}
                        <li>
                            Please report bugs or suggestions to the{" "}
                            <a href="mailto:support@carta.freshdesk.com" rel="noopener noreferrer" target="_blank">
                                CARTA helpdesk
                            </a>{" "}
                            or file a{" "}
                            <a href="https://github.com/CARTAvis/carta/issues" rel="noopener noreferrer" target="_blank">
                                GitHub issue
                            </a>
                        </li>
                        <li>
                            Documentation is available{" "}
                            <a href="https://carta.readthedocs.io/en/4.0" rel="noopener noreferrer" target="_blank">
                                online
                            </a>
                        </li>
                        <li>
                            User data collection policy is available{" "}
                            <a href="https://cartavis.org/telemetry" rel="noopener noreferrer" target="_blank">
                                here
                            </a>
                        </li>
                    </ul>
                    <h3>License</h3>
                    <p className={Classes.TEXT_SMALL}>
                        Copyright (C) 2018-{build_year} ASIAA, IDIA, NRAO, and Department of Physics, University of Alberta. This program is free software; you can redistribute it and/or modify it under the terms of the&#160;
                        <a href="http://www.gnu.org/copyleft/gpl.html" rel="noopener noreferrer" target="_blank">
                            GNU General Public License version 3
                        </a>
                        &#160; as published by the Free Software Foundation.
                    </p>
                </div>
                <div className={Classes.DIALOG_FOOTER}>
                    <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                        <AnchorButton intent={Intent.NONE} onClick={dialogStore.hideAboutDialog} text="Close" />
                    </div>
                </div>
            </DraggableDialogComponent>
        );
    }
}
