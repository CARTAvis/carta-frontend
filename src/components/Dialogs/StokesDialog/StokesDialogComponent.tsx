import * as React from "react";
import {observer} from "mobx-react";
import {action, computed, makeObservable, observable, reaction} from "mobx";
import {AnchorButton, Button, IDialogProps, Intent, MenuItem, PopoverPosition} from "@blueprintjs/core";
import {Cell, Column, SelectionModes, Table} from "@blueprintjs/table";
import {Select, IItemRendererProps} from "@blueprintjs/select";
import {DraggableDialogComponent} from "components/Dialogs";
import {AppStore, BrowserMode, HelpType} from "stores";
import {CARTA} from "carta-protobuf";
import "./StokesDialogComponent.scss";

@observer
export class StokesDialogComponent extends React.Component {
    @observable stokes: Map<string, CARTA.IStokesFile>;
    @observable stokesHeader: Map<string, CARTA.IFileInfoExtended>;

    @action updateStokesType = (fileName: string, type: CARTA.StokesType) => {
        let currentStoke = this.stokes.get(fileName);
        if (currentStoke.stokesType !== type) {
            this.stokes.forEach((stokeFile, stokeFileName) => {
                if (stokeFileName !== fileName && stokeFile.stokesType === type) {
                    this.stokes.get(stokeFileName).stokesType = CARTA.StokesType.STOKES_TYPE_NONE;
                }
            });
            const stoke: CARTA.IStokesFile = {
                directory: currentStoke.directory,
                file: currentStoke.file,
                hdu: currentStoke.hdu,
                stokesType: type
            };
            this.stokes.set(fileName, stoke);
        }
    };

    @action setStokes = (fileName: string, stoke: CARTA.IStokesFile) => {
        this.stokes.set(fileName, stoke);
    };

    @action setStokesHeader = (fileName: string, fileInfoExtended: CARTA.IFileInfoExtended) => {
        this.stokesHeader.set(fileName, fileInfoExtended);
    };

    @computed get fileNames(): string[] {
        let files = [];
        this.stokes.forEach((type, file) => {
            files.push(file);
        });
        return files;
    }

    @computed get stokesDialogVisible(): boolean {
        return AppStore.Instance.dialogStore.stokesDialogVisible;
    }

    @computed get noneType(): boolean {
        let load = true;
        this.stokes.forEach(file => {
            if (file.stokesType === CARTA.StokesType.STOKES_TYPE_NONE) {
                load = false;
            }
        });
        return load;
    }

    constructor(props) {
        super(props);
        makeObservable(this);
        this.stokes = new Map();
        this.stokesHeader = new Map();

        reaction(
            () => this.stokesDialogVisible,
            stokesDialogVisible => {
                if (stokesDialogVisible) {
                    const fileBrowserStore = AppStore.Instance.fileBrowserStore;
                    this.stokes = new Map();
                    fileBrowserStore.selectedFiles.forEach(file => {
                        AppStore.Instance.fileBrowserStore
                            .getConcatFilesHeader(AppStore.Instance.fileBrowserStore.fileList.directory, file.fileInfo.name, file.hdu)
                            .then(response => {
                                // In fileInfoExtended: { [k: string]: CARTA.IFileInfoExtended }, sometimes k is " "
                                const k = Object.keys(response.info)[0];
                                const stoke: CARTA.IStokesFile = {
                                    directory: fileBrowserStore.fileList.directory,
                                    file: file.fileInfo.name,
                                    hdu: file.hdu,
                                    stokesType: this.getStokeType(response.info[k], response.file)
                                };
                                this.setStokes(file.fileInfo.name, stoke);
                            })
                            .catch(err => {
                                console.log(err);
                            });
                    });
                }
            }
        );
    }

    render() {
        const appStore = AppStore.Instance;
        const fileBrowserStore = appStore.fileBrowserStore;

        let className = "stokes-dialog";
        if (appStore.darkTheme) {
            className += " bp3-dark";
        }

        let stokeItems = [CARTA.StokesType.STOKES_TYPE_NONE, CARTA.StokesType.I, CARTA.StokesType.Q, CARTA.StokesType.U, CARTA.StokesType.V];

        const files = this.fileNames;

        const fileName = (
            <Column
                key={"FileName"}
                name={"File name"}
                cellRenderer={(rowIndex, columnIndex) => (
                    <Cell className="header-table-cell" key={`cell_${columnIndex}_${rowIndex}`} interactive={true}>
                        {this.fileNames[rowIndex]}
                    </Cell>
                )}
            />
        );

        const stokesDropDown = (
            <Column
                key={"Stokes"}
                name={"Stokes"}
                cellRenderer={rowIndex => {
                    const file = files[rowIndex];
                    return (
                        <Cell className="cell-dropdown-menu" key={`cell_drop_down_${rowIndex}`} interactive={true}>
                            <Select
                                filterable={false}
                                items={stokeItems}
                                activeItem={this.stokes.get(file).stokesType}
                                onItemSelect={type => this.updateStokesType(file, type)}
                                itemRenderer={this.renderPopOver}
                                popoverProps={{popoverClassName: "catalog-select", minimal: true, position: PopoverPosition.AUTO_END}}
                            >
                                <Button className="bp3-minimal catalog-represent-as-select-button" text={this.getLabelFromValue(this.stokes.get(file).stokesType)} rightIcon="double-caret-vertical" />
                            </Select>
                        </Cell>
                    );
                }}
            />
        );

        const dialogProps: IDialogProps = {
            icon: "git-merge",
            className: className,
            backdropClassName: "minimal-dialog-backdrop",
            canOutsideClickClose: false,
            lazy: true,
            isOpen: appStore.dialogStore.stokesDialogVisible,
            onClose: appStore.dialogStore.hideStokesDialog,
            title: "Merging Stokes hypercube"
        };

        return (
            <DraggableDialogComponent dialogProps={dialogProps} helpType={HelpType.STOKES} minWidth={300} minHeight={250} defaultWidth={602} defaultHeight={300} enableResizing={true}>
                <div className="bp3-dialog-body">
                    <Table
                        className={"file-table"}
                        numRows={this.stokes.size}
                        enableRowHeader={false}
                        enableRowReordering={false}
                        selectionModes={SelectionModes.NONE}
                        defaultRowHeight={30}
                        minRowHeight={20}
                        minColumnWidth={30}
                        columnWidths={[470, 90]}
                        enableRowResizing={false}
                    >
                        {[fileName, stokesDropDown]}
                    </Table>
                </div>
                <div className="bp3-dialog-footer">
                    <div className="bp3-dialog-footer-actions">
                        <AnchorButton
                            intent={Intent.NONE}
                            disabled={appStore.fileLoading || !fileBrowserStore.selectedFile || !fileBrowserStore.fileInfoResp || fileBrowserStore.loadingInfo}
                            onClick={AppStore.Instance.dialogStore?.hideStokesDialog}
                            text={"Cancel"}
                        />
                        <AnchorButton
                            intent={Intent.PRIMARY}
                            disabled={appStore.fileLoading || !fileBrowserStore.selectedFile || !fileBrowserStore.fileInfoResp || fileBrowserStore.loadingInfo || !this.noneType}
                            onClick={this.loadSelectedFiles}
                            text={"Load"}
                        />
                    </div>
                </div>
            </DraggableDialogComponent>
        );
    }

    private loadSelectedFiles = async () => {
        let stokeFiles = [];
        this.stokes.forEach(file => {
            stokeFiles.push(file);
        });
        await this.loadFile(stokeFiles)
            .then(() => AppStore.Instance.activeFrame?.setStokesFiles(stokeFiles))
            .catch(() => {
                AppStore.Instance.activeFrame?.setStokesFiles([]);
            });
    };

    private loadFile = async (files: CARTA.StokesFile[]) => {
        const appStore = AppStore.Instance;
        const fileBrowserStore = appStore.fileBrowserStore;

        // Ignore load if in export mode
        if (fileBrowserStore.browserMode === BrowserMode.RegionExport) {
            return;
        }

        if (fileBrowserStore.browserMode === BrowserMode.File) {
            const frames = appStore.frames;
            if (!fileBrowserStore.appendingFrame || !frames.length) {
                await appStore.openConcatFile(files, fileBrowserStore.fileList.directory, files[0].hdu);
            } else {
                await appStore.appendConcatFile(files, fileBrowserStore.fileList.directory, files[0].hdu);
            }
        }

        fileBrowserStore.saveStartingDirectory();
    };

    private getLabelFromValue = (value: CARTA.StokesType) => {
        switch (value) {
            case 1:
                return "I";
            case 2:
                return "Q";
            case 3:
                return "U";
            case 4:
                return "V";
            default:
                return "None";
        }
    };

    private renderPopOver = (stokesType: CARTA.StokesType, itemProps: IItemRendererProps) => {
        const label = this.getLabelFromValue(stokesType);
        return <MenuItem key={`${stokesType}: ${label}`} text={label} onClick={itemProps.handleClick} active={itemProps.modifiers.active} />;
    };

    private getStokeType = (fileInfoExtended: CARTA.IFileInfoExtended, file: string): CARTA.StokesType => {
        let type = this.getTypeFromHeader(fileInfoExtended?.headerEntries);
        if (type === CARTA.StokesType.STOKES_TYPE_NONE) {
            type = this.getTypeFromName(file);
        }
        return type;
    };

    private getTypeFromHeader(headers: CARTA.IHeaderEntry[]): CARTA.StokesType {
        let CRVAL: CARTA.IHeaderEntry = {};
        let type = CARTA.StokesType.STOKES_TYPE_NONE;
        const CTYPE = headers?.find(obj => {
            return obj.value.toUpperCase() === "STOKES";
        });

        if (CTYPE) {
            if (CTYPE.name.includes("1")) {
                CRVAL = headers.find(obj => {
                    return obj.name === "CRVAL1";
                });
            } else if (CTYPE.name.includes("2")) {
                CRVAL = headers.find(obj => {
                    return obj.name === "CRVAL2";
                });
            } else if (CTYPE.name.includes("3")) {
                CRVAL = headers.find(obj => {
                    return obj.name === "CRVAL3";
                });
            } else if (CTYPE.name.includes("4")) {
                CRVAL = headers.find(obj => {
                    return obj.name === "CRVAL4";
                });
            }
        }

        switch (CRVAL?.numericValue) {
            case 1:
                type = CARTA.StokesType.I;
                break;
            case 2:
                type = CARTA.StokesType.Q;
                break;
            case 3:
                type = CARTA.StokesType.U;
                break;
            case 4:
                type = CARTA.StokesType.V;
                break;
            default:
                break;
        }
        return type;
    }

    private getTypeFromName(fileName: string): CARTA.StokesType {
        let type = CARTA.StokesType.STOKES_TYPE_NONE;
        const separators = [".", "_"];
        separators.forEach(separator => {
            const words = fileName.split(separator);
            words.forEach(word => {
                switch (word) {
                    case "I":
                        type = CARTA.StokesType.I;
                        break;
                    case "Q":
                        type = CARTA.StokesType.Q;
                        break;
                    case "U":
                        type = CARTA.StokesType.U;
                        break;
                    case "V":
                        type = CARTA.StokesType.V;
                        break;
                    default:
                        break;
                }
            });
        });
        return type;
    }
}
