import * as React from "react";
import {observer} from "mobx-react";
import {AnchorButton, H6, IDialogProps, Intent, NonIdealState, Pre, Tooltip} from "@blueprintjs/core";
import "./FileBrowserDialogComponent.css";
import {CARTA} from "carta-protobuf";
import FileInfo = CARTA.FileInfo;
import {FileListComponent} from "./FileList/FileListComponent";
import {AppStore} from "../../../stores/AppStore";
import {DraggableDialogComponent} from "../DraggableDialog/DraggableDialogComponent";
import {FileBrowserStore} from "../../../stores/FileBrowserStore";

@observer
export class FileBrowserDialogComponent extends React.Component<{ appStore: AppStore }> {
    public render() {
        const fileBrowserStore = this.props.appStore.fileBrowserStore;
        let headerInfo = this.getHeaderInfo(fileBrowserStore);
        let customizedInfo = this.genCustomizedInfo(fileBrowserStore);

        let className = "file-browser-dialog";
        if (this.props.appStore.darkTheme) {
            className += " bp3-dark";
        }

        const dialogProps: IDialogProps = {
            icon: "folder-open",
            className: className,
            backdropClassName: "minimal-dialog-backdrop",
            canOutsideClickClose: false,
            lazy: true,
            isOpen: fileBrowserStore.fileBrowserDialogVisible,
            onClose: fileBrowserStore.hideFileBrowser,
            title: "File Browser",
        };

        return (
            <DraggableDialogComponent dialogProps={dialogProps} minWidth={300} minHeight={300} defaultWidth={600} defaultHeight={450} enableResizing={true}>
                <div className="bp3-dialog-body" style={{display: "flex"}}>
                    <div className="file-list-pane">
                        <FileListComponent
                            files={fileBrowserStore.fileList}
                            selectedFile={fileBrowserStore.selectedFile}
                            selectedHDU={fileBrowserStore.selectedHDU}
                            onFileClicked={(file: FileInfo, hdu: string) => fileBrowserStore.selectFile(file, hdu)}
                            onFileDoubleClicked={(file: FileInfo, hdu: string) => this.loadFile(file.name, hdu)}
                            onFolderClicked={(folder: string) => fileBrowserStore.selectFolder(folder)}
                        />
                    </div>
                    <div className="file-info-pane">
                        <H6>File Information</H6>
                        {!fileBrowserStore.fileInfoExtended &&
                        <NonIdealState className="non-ideal-state-file" icon="document" title="No file selected" description="Select a file from the list on the left"/>
                        }
                        {fileBrowserStore.fileInfoExtended &&
                        <Pre className="file-info-pre">{customizedInfo}</Pre>
                        }
                    </div>
                </div>
                <div className="bp3-dialog-footer">
                    <div className="bp3-dialog-footer-actions">
                        <AnchorButton intent={Intent.NONE} onClick={fileBrowserStore.hideFileBrowser} text="Close"/>
                        {fileBrowserStore.appendingFrame ? (
                            <Tooltip content={"Append this file as a new frame"}>
                                <AnchorButton intent={Intent.PRIMARY} disabled={!fileBrowserStore.selectedFile} onClick={this.loadSelectedFile} text="Load as frame"/>
                            </Tooltip>
                        ) : (
                            <Tooltip content={"Close any existing frames and load this file"}>
                                <AnchorButton intent={Intent.PRIMARY} disabled={!fileBrowserStore.selectedFile} onClick={this.loadSelectedFile} text="Load"/>
                            </Tooltip>
                        )}
                    </div>
                </div>
            </DraggableDialogComponent>
        );
    }

    loadSelectedFile = () => {
        const fileBrowserStore = this.props.appStore.fileBrowserStore;
        this.loadFile(fileBrowserStore.selectedFile.name, fileBrowserStore.selectedHDU);
    };

    loadFile(file: string, hdu: string) {
        const fileBrowserStore = this.props.appStore.fileBrowserStore;
        const frames = this.props.appStore.frames;
        if (!fileBrowserStore.appendingFrame || !frames.length) {
            this.props.appStore.openFile(fileBrowserStore.fileList.directory, file, hdu);
        }
        else {
            this.props.appStore.appendFile(fileBrowserStore.fileList.directory, file, hdu);
        }
    }

    getHeaderInfo = (fileBrowserStore: FileBrowserStore): string => {
        let headerInfo = "";

        // get all headers from header entry
        if (fileBrowserStore.fileInfoExtended) {
            fileBrowserStore.fileInfoExtended.headerEntries.forEach(header => {
                headerInfo += `${header.name} = ${header.value}\n`;
            });
        }
        return headerInfo;
    }

    // generate human readable format for File information
    genCustomizedInfo = (fileBrowserStore: FileBrowserStore): string => {
        let customizedInfo = "";
        let necessary = [
            "NAXIS", "NAXIS1", "NAXIS2", "NAXIS3", "NAXIS4",
            "BMAJ", "BMIN", "BPA", "BUNIT",
            "EQUINOX", "RADESYS", "SPECSYS", "VELREF",
            "CTYPE1", "CRVAL1", "CDELT1", "CUNIT1",
            "CTYPE2", "CRVAL2", "CDELT2", "CUNIT2",
            "CTYPE3", "CRVAL3", "CDELT3", "CUNIT3",
            "CTYPE4", "CRVAL4", "CDELT4", "CUNIT4",
            "CRPIX1", "CRPIX2", "CRPIX3", "CRPIX4"
        ];

        if (fileBrowserStore.fileInfoExtended) {
            // initialize (key, value) hash
            let headers = {};
            necessary.forEach((element) => {
                headers[element] = "";
            });

            // assign value from header entries
            fileBrowserStore.fileInfoExtended.headerEntries.forEach(header => {
                headers[header.name] = header.value;
            });

            // post-processing of some customized entries
            let stokes = "NA", channels = "NA";
            if (headers["NAXIS"] > 2) {
                if (headers["CTYPE3"].match(/STOKES/i)) {
                    stokes = headers["NAXIS3"];
                }
                else if (headers["CTYPE4"].match(/STOKES/i)) {
                    stokes = headers["NAXIS4"];
                }
                if (headers["CTYPE3"].match(/(VOPT)/i)) {
                    channels = headers["NAXIS3"];
                }
                else if (headers["CTYPE4"].match(/(VOPT)/i)) {
                    channels = headers["NAXIS4"];
                }
            }
            
            // customize pixSize
            let pixSize = (headers["CDELT1"] === headers["CDELT2"] ? 
                        `${headers["CDELT1"]}, ${headers["CUNIT1"]}` : 
                        `${headers["CDELT1"]}, ${headers["CUNIT1"]}, ${headers["CDELT2"]}, ${headers["CUNIT2"]}`);
            
            // customize restoring beam
            let bmaj = headers["BMAJ"], bmin = headers["BMIN"], unit = headers["CUNIT1"];
            if (headers["CTYPE1"].match(/ra/i) && unit.match(/deg/i)) { bmaj *= 3600; bmin *= 3600; }
            
            // customized equinox
            let equinox = headers["EQUINOX"];
            if (headers["RADESYS"].match(/FK4/i)) { equinox = "B" + equinox; }
            else if (headers["RADESYS"].match(/FK5/i)) { equinox = "J" + equinox; }

            // fill in needed entries for readable format
            customizedInfo +=
            `- image dimension = [${headers["NAXIS1"]}, ${headers["NAXIS2"]}, ${stokes}, ${channels}]\n` +
            `- number of channels = ${stokes}\n` +
            `- number of Stokes = ${channels}\n` +
            `- pixel unit = ${headers["BUNIT"]}\n` +
            `- pixel size = ${pixSize}\n` +
            `- restoring beam = ${bmaj} x ${bmin}, ${headers["BPA"]} ${headers["CUNIT1"]}\n` +
            `- coordinate type = ${headers["CTYPE1"]}, ${headers["CTYPE2"]}\n` +
            `- image reference coordinate: [${headers["CRPIX1"]},${headers["CRPIX2"]}] [${headers["CRVAL1"]} ${headers["CUNIT1"]},${headers["CRVAL2"]} ${headers["CUNIT2"]}]\n` +
            `- celestial frame = ${headers["RADESYS"]}, ${equinox}\n` +
            `- spectral frame = ${headers["SPECSYS"]}\n` +
            `- velocity definition = ${headers["VELREF"]}\n` +
            `- frequency range = \n` +
            `- velocity range = \n`;
        }

        return customizedInfo;
    }
}