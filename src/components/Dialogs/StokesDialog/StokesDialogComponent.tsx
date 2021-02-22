import * as React from "react";
import {observer} from "mobx-react";
import {action, computed, makeObservable, observable} from "mobx";
import {AnchorButton, Button, FormGroup, IDialogProps, Intent, MenuItem, PopoverPosition} from "@blueprintjs/core";
import {Select, IItemRendererProps} from "@blueprintjs/select";
import {DraggableDialogComponent} from "components/Dialogs";
// import {FileInfoComponent, FileInfoType} from "components/FileInfo/FileInfoComponent";
import {AppStore, BrowserMode, HelpType} from "stores";
import {CustomIcon} from "icons/CustomIcons";
import {CARTA} from "carta-protobuf";
// import "./FileInfoDialogComponent.scss";

// enum Stokes {
//     None = 0,
//     I = 1,
//     Q = 2,
//     U = 3,
//     V = 4,
// }

@observer
export class StokesDialogComponent extends React.Component {
    // @observable stokesQ: string;
    // private static readonly StokesType = ["None", "I", "Q", "U", "V"];
    @observable stokes: Map<string, CARTA.StokesType>;

    @action setStokes = (fileName: string, type: CARTA.StokesType) => {
        this.stokes.set(fileName, type);
    }

    @computed get fileNames(): string[] {
        const appStore = AppStore.Instance;
        const fileBrowserStore = appStore.fileBrowserStore;
        let fileNames = [];
        fileBrowserStore?.selectedFiles?.forEach(file => {
            fileNames.push(file.fileInfo.name);
        });
        return fileNames;
    }

    constructor(props){
        super(props);
        makeObservable(this);
        this.stokes = new Map();
    }

    render() {
        const appStore = AppStore.Instance;
        const fileBrowserStore = appStore.fileBrowserStore;
        // console.log(fileBrowserStore.selectedFiles)
        // console.log(this.stokes)

        let className = "stokes-dialog";
        if (appStore.darkTheme) {
            className += " bp3-dark";
        }

        let stokeItems = [
            CARTA.StokesType.STOKES_TYPE_NONE, 
            CARTA.StokesType.I, 
            CARTA.StokesType.Q, 
            CARTA.StokesType.U, 
            CARTA.StokesType.V
        ];

        const file1 = this.fileNames[0];
        const file2 = this.fileNames[1];
        const file3 = this.fileNames[2];
        const file4 = this.fileNames[3];

        const dialogProps: IDialogProps = {
            icon: <CustomIcon icon={"stokes"}/>,
            className: className,
            backdropClassName: "minimal-dialog-backdrop",
            canOutsideClickClose: false,
            lazy: true,
            isOpen: appStore.dialogStore.stokesDialogVisible,
            onClose: appStore.dialogStore.hideStokesDialog,
            title: "Stokes hypercube configuration",
        };

        return (
            <DraggableDialogComponent dialogProps={dialogProps} helpType={HelpType.FILE_INFO} minWidth={400} minHeight={400} defaultWidth={800} defaultHeight={600} enableResizing={true}>
                <div className="bp3-dialog-body">
                    <FormGroup  inline={true} label={file1}>
                        <Select 
                            className="bp3-fill"
                            filterable={false}
                            items={stokeItems} 
                            activeItem={this.stokes.get(file1)}
                            onItemSelect={type => this.setStokes(file1, type)}
                            itemRenderer={this.renderPopOver}
                            popoverProps={{popoverClassName: "catalog-select", minimal: true , position: PopoverPosition.AUTO_END}}
                        >
                            <Button text={this.getLabelFromValue(this.stokes.get(file1))} rightIcon="double-caret-vertical"/>
                        </Select>
                    </FormGroup>
                    <FormGroup  inline={true} label={file2}>
                        <Select 
                            className="bp3-fill"
                            filterable={false}
                            items={stokeItems} 
                            activeItem={this.stokes.get(file2)}
                            onItemSelect={type => this.setStokes(file2, type)}
                            itemRenderer={this.renderPopOver}
                            popoverProps={{popoverClassName: "catalog-select", minimal: true , position: PopoverPosition.AUTO_END}}
                        >
                            <Button text={this.getLabelFromValue(this.stokes.get(file2))} rightIcon="double-caret-vertical"/>
                        </Select>
                    </FormGroup>
                    <FormGroup  inline={true} label={file3}>
                        <Select 
                            className="bp3-fill"
                            filterable={false}
                            items={stokeItems} 
                            activeItem={this.stokes.get(file3)}
                            onItemSelect={type => this.setStokes(file3, type)}
                            itemRenderer={this.renderPopOver}
                            popoverProps={{popoverClassName: "catalog-select", minimal: true , position: PopoverPosition.AUTO_END}}
                        >
                            <Button text={this.getLabelFromValue(this.stokes.get(file3))} rightIcon="double-caret-vertical"/>
                        </Select>
                    </FormGroup>
                    <FormGroup  inline={true} label={file4}>
                        <Select 
                            className="bp3-fill"
                            filterable={false}
                            items={stokeItems} 
                            activeItem={this.stokes.get(file4)}
                            onItemSelect={type => this.setStokes(file4, type)}
                            itemRenderer={this.renderPopOver}
                            popoverProps={{popoverClassName: "catalog-select", minimal: true , position: PopoverPosition.AUTO_END}}
                        >
                            <Button text={this.getLabelFromValue(this.stokes.get(file4))} rightIcon="double-caret-vertical"/>
                        </Select>
                    </FormGroup>

                    <AnchorButton
                        intent={Intent.NONE}
                        disabled={appStore.fileLoading || !fileBrowserStore.selectedFile || !fileBrowserStore.fileInfoResp || fileBrowserStore.loadingInfo}
                        onClick={appStore.dialogStore.hideStokesDialog}
                        text={"Cancel"}
                    />

                    <AnchorButton
                        intent={Intent.PRIMARY}
                        disabled={appStore.fileLoading || !fileBrowserStore.selectedFile || !fileBrowserStore.fileInfoResp || fileBrowserStore.loadingInfo}
                        onClick={this.loadSelectedFiles}
                        text={"Load"}
                    />
                </div>
            </DraggableDialogComponent>
        );
    }

    private loadSelectedFiles = async () => {
        const appStore = AppStore.Instance;
        const fileBrowserStore = appStore.fileBrowserStore;
        let stokeFiles = [];
        fileBrowserStore.selectedFiles.forEach(file => {
            const stokeFile = new CARTA.StokesFile({
                directory: fileBrowserStore.fileList.directory,
                file: file.fileInfo.name,
                hdu: file.hdu,
                stokesType: this.stokes.get(file.fileInfo.name)
            });
            stokeFiles.push(stokeFile);
        });

        try {
            await this.loadFile(stokeFiles);
        }
        catch (err){
            console.log(err);
        }
        // else {
        //     await this.loadFile({fileInfo: fileBrowserStore.selectedFile, hdu: fileBrowserStore.selectedHDU});
        // }
    };

    private loadFile = async (files: CARTA.StokesFile[], forceAppend: boolean = false) => {
        const appStore = AppStore.Instance;
        const fileBrowserStore = appStore.fileBrowserStore;

        // Ignore load if in export mode
        if (fileBrowserStore.browserMode === BrowserMode.RegionExport) {
            return;
        }

        // stokes with i, q, v, u VS single one?
        if (fileBrowserStore.browserMode === BrowserMode.File) {
            // const frames = appStore.frames;
            // if (!(forceAppend || fileBrowserStore.appendingFrame) || !frames.length) {
                await appStore.openConctaStokes(files, fileBrowserStore.fileList.directory, files[0].hdu);
            // } else {
            //     await appStore.appendFile(fileBrowserStore.fileList.directory, file.fileInfo.name, file.hdu);
            // }
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
    }

    private renderPopOver = (stokesType: CARTA.StokesType, itemProps: IItemRendererProps) => {
        const label = this.getLabelFromValue(stokesType);
        return (
            <MenuItem
                key={`${stokesType}: ${label}`}
                text={label}
                onClick={itemProps.handleClick}
                active={itemProps.modifiers.active}
            />
        );
    }
}