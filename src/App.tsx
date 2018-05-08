import * as React from "react";
import * as GoldenLayout from "golden-layout";
import {ItemConfigType} from "golden-layout";
import * as AST from "ast_wrapper";
import "./App.css";
import {PlaceholderComponent} from "./components/Placeholder/PlaceholderComponent";
import {RootMenuComponent} from "./components/Menu/RootMenuComponent";
import {ImageViewComponent} from "./components/ImageView/ImageViewComponent";
import {OverlaySettingsDialogComponent} from "./components/Dialogs/OverlaySettings/OverlaySettingsDialogComponent";
import {AppState} from "./Models/AppState";
import {observer} from "mobx-react";
import {LabelType, OverlaySettings, SystemType} from "./Models/OverlaySettings";
import {Control} from "carta-protobuf";

@observer
class App extends React.Component<{ appState: AppState }> {

    constructor(props: { appState: AppState }) {
        super(props);

        const appState = this.props.appState;

        const initialLayout: ItemConfigType[] = [{
            type: "row",
            content: [{
                type: "column",
                content: [{
                    type: "react-component",
                    component: "image-view",
                    title: "Image.fits",
                    height: 80,
                    id: "imageView",
                    isClosable: false,
                    props: {appState: this.props.appState}
                }, {
                    type: "stack",
                    content: [{
                        type: "react-component",
                        component: "placeholder",
                        title: "Animation",
                        id: "animation",
                        props: {label: "Animation placeholder"}
                    }, {
                        type: "react-component",
                        component: "placeholder",
                        title: "Color map",
                        id: "colormap",
                        props: {label: "Color map placeholder"}
                    }]
                }]
            }, {
                type: "column",
                content: [{
                    type: "react-component",
                    component: "placeholder",
                    title: "X Profile: Cursor",
                    id: "spatialprofile0",
                    props: {label: "Graph placeholder"}
                }, {
                    type: "react-component",
                    component: "placeholder",
                    title: "Y Profile: Cursor",
                    id: "spatialprofile1",
                    props: {label: "Graph placeholder"}
                }, {
                    type: "react-component",
                    component: "placeholder",
                    title: "Z Profile: Cursor",
                    id: "spectralprofile0",
                    props: {label: "Graph placeholder"}
                }, {
                    type: "stack",
                    height: 33.3,
                    content: [{
                        type: "react-component",
                        component: "placeholder",
                        title: "Histogram: Region #1",
                        id: "histogram0",
                        props: {label: "Histogram placeholder"}
                    }, {
                        type: "react-component",
                        component: "placeholder",
                        title: "Statistics: Region #1",
                        id: "statistics0",
                        props: {label: "Statistics placeholder"}
                    }]
                }]
            }]
        }];

        const layout = new GoldenLayout({
            settings: {
                showPopoutIcon: false
            },
            content: initialLayout
        });

        layout.registerComponent("placeholder", PlaceholderComponent);
        layout.registerComponent("image-view", ImageViewComponent);

        appState.layoutSettings.layout = layout;

        let settings = new OverlaySettings();
        settings.system = SystemType.Native;
        settings.labelType = LabelType.Exterior;
        settings.border.visible = true;
        settings.color = 4;
        settings.width = 1;
        settings.tolerance = 0.02;
        settings.title.visible = true;
        settings.title.gap = 0.02;
        settings.title.color = 4;
        settings.title.text = "A custom AST plot";
        settings.grid.visible = true;
        settings.grid.color = 3;
        settings.extra = "Format(1) = d";
        appState.overlaySettings = settings;

        AST.onReady.then(() => {
            // We will eventually read the header from a file. Suppressing linting error for now
            // tslint:disable-next-line
            const initResult = AST.initFrame("SIMPLE  =                    T / conforms to FITS standard                      BITPIX  =                  -32 / array data type                                NAXIS   =                    2 / number of array dimensions                     NAXIS1  =                 5850                                                  NAXIS2  =                 1074                                                  NAXIS3  =                    1                                                  OBJECT  = 'GALFACTS_N4 Stokes I'                                  /  Object nameCTYPE1  = 'RA---CAR'           /  1st axis type                                 CRVAL1  =           333.750000 /  Reference pixel value                         CRPIX1  =              2925.50 /  Reference pixel                               CDELT1  =           -0.0166667 /  Pixel size in world coordinate units          CROTA1  =               0.0000 /  Axis rotation in degrees                      CTYPE2  = 'DEC--CAR'           /  2nd axis type                                 CRVAL2  =             0.000000 /  Reference pixel value                         CRPIX2  =             -1181.50 /  Reference pixel                               CDELT2  =            0.0166667 /  Pixel size in world coordinate units          CROTA2  =               0.0000 /  Axis rotation in degrees                      EQUINOX =              2000.00 /  Equinox of coordinates (if any)               BUNIT   = 'Kelvin'                                 /  Units of pixel data valuesHISTORY Image was compressed by CFITSIO using scaled integer quantization:      HISTORY   q = 2.000000 / quantized level scaling parameter                      HISTORY 'SUBTRACTIVE_DITHER_1' / Pixel Quantization Algorithm                   CHECKSUM= '4LTe5LRd4LRd4LRd'   / HDU checksum updated 2017-06-01T10:19:12       DATASUM = '159657855'          / data unit checksum updated 2017-06-01T10:19:12 END                                                                             ");
            if (initResult !== 0) {
                console.error("Problem loading AST library");
            }
            appState.astReady = true;
        });

        // ProtoBuf test
        let registerViewerMessage = Control.RegisterViewer.create({
            sessionId: "test"
        });

        let validMessage = Control.RegisterViewer.verify({
            sessionId: "test"
        });

        console.log({validMessage, registerViewerMessage});
    }

    public componentDidMount() {
        this.props.appState.layoutSettings.layout.init();
    }

    public render() {
        const appState = this.props.appState;
        return (
            <div className="App">
                <RootMenuComponent appState={appState}/>
                <OverlaySettingsDialogComponent appState={appState}/>
            </div>
        );
    }
}

export default App;