import * as React from "react";
import * as GoldenLayout from "golden-layout";
import {ItemConfigType} from "golden-layout";
import * as AST from "ast_wrapper";
import "./App.css";
import {PlaceholderComponent} from "./components/Placeholder/PlaceholderComponent";
import {RootMenuComponent} from "./components/Menu/RootMenuComponent";
import {ImageViewComponent} from "./components/ImageView/ImageViewComponent";
import {OverlaySettingsDialogComponent} from "./components/Dialogs/OverlaySettings/OverlaySettingsDialogComponent";
import {AppState} from "./states/AppState";
import {observer} from "mobx-react";
import {LabelType, OverlayState, SystemType} from "./states/OverlayState";
import {CARTA} from "carta-protobuf";
import {SpatialProfileState} from "./states/SpatialProfileState";
import {SpatialProfilerComponent} from "./components/SpatialProfiler/SpatialProfilerComponent";
import DevTools from "mobx-react-devtools";
import {BackendService} from "./services/BackendService";
import {FileBrowserDialogComponent} from "./components/Dialogs/FileBrowser/FileBrowserDialogComponent";
import {FileBrowserState} from "./states/FileBrowserState";
import {URLConnectDialogComponent} from "./components/Dialogs/URLConnect/URLConnectDialogComponent";

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
                    component: "spatial-profiler",
                    title: "X Profile: Cursor",
                    id: "spatialprofile0",
                    props: {
                        label: "X Profile (Cursor)",
                        dataSourceId: -1,
                        profileCoordinate: "x",
                        appState: this.props.appState
                    }
                }, {
                    type: "react-component",
                    component: "spatial-profiler",
                    title: "Y Profile: Cursor",
                    id: "spatialprofile1",
                    props: {
                        label: "Y Profile (Cursor)",
                        dataSourceId: -1,
                        profileCoordinate: "y",
                        appState: this.props.appState
                    }
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
        layout.registerComponent("spatial-profiler", SpatialProfilerComponent);

        appState.layoutSettings.layout = layout;

        let overlayState = new OverlayState();
        overlayState.system = SystemType.Native;
        overlayState.labelType = LabelType.Exterior;
        overlayState.border.visible = true;
        overlayState.color = 4;
        overlayState.width = 1;
        overlayState.tolerance = 0.02;
        overlayState.title.visible = false;
        overlayState.title.gap = 0.02;
        overlayState.title.color = 4;
        overlayState.title.text = "A custom AST plot";
        overlayState.grid.visible = true;
        overlayState.grid.color = 3;
        overlayState.extra = "Format(1) = d.1, Format(2) = d.1";
        overlayState.title.font = 2;
        overlayState.axes.labelFontSize = 15;
        overlayState.axes.labelFont = 1;
        overlayState.axes.numberFontSize = 10;

        appState.overlayState = overlayState;

        AST.onReady.then(() => {
            // We will eventually read the header from a file. Suppressing linting error for now
            // tslint:disable-next-line
            const initResult = AST.initFrame("SIMPLE  =                    T / conforms to FITS standard                      BITPIX  =                  -32 / array data type                                NAXIS   =                    2 / number of array dimensions                     NAXIS1  =                 5850                                                  NAXIS2  =                 1074                                                  NAXIS3  =                    1                                                  OBJECT  = 'GALFACTS_N4 Stokes I'                                  /  Object nameCTYPE1  = 'RA---CAR'           /  1st axis type                                 CRVAL1  =           333.750000 /  Reference pixel value                         CRPIX1  =              2925.50 /  Reference pixel                               CDELT1  =           -0.0166667 /  Pixel size in world coordinate units          CROTA1  =               0.0000 /  Axis rotation in degrees                      CTYPE2  = 'DEC--CAR'           /  2nd axis type                                 CRVAL2  =             0.000000 /  Reference pixel value                         CRPIX2  =             -1181.50 /  Reference pixel                               CDELT2  =            0.0166667 /  Pixel size in world coordinate units          CROTA2  =               0.0000 /  Axis rotation in degrees                      EQUINOX =              2000.00 /  Equinox of coordinates (if any)               BUNIT   = 'Kelvin'                                 /  Units of pixel data valuesHISTORY Image was compressed by CFITSIO using scaled integer quantization:      HISTORY   q = 2.000000 / quantized level scaling parameter                      HISTORY 'SUBTRACTIVE_DITHER_1' / Pixel Quantization Algorithm                   CHECKSUM= '4LTe5LRd4LRd4LRd'   / HDU checksum updated 2017-06-01T10:19:12       DATASUM = '159657855'          / data unit checksum updated 2017-06-01T10:19:12 END                                                                             ");
            if (!initResult) {
                console.error("Problem loading AST library");
            }
            else {
                appState.astReady = true;
                appState.wcsInfo = initResult;
            }
        });

        // Spatial profile data test: Cursor
        let spatialProfileTest = new SpatialProfileState();
        spatialProfileTest.channel = 0;
        spatialProfileTest.stokes = 0;
        spatialProfileTest.fileId = 0;
        spatialProfileTest.regionId = -1;
        spatialProfileTest.x = 50;
        spatialProfileTest.y = 25;
        spatialProfileTest.profiles = [{
            start: 0,
            end: 99,
            coordinate: "x",
            values: new Float32Array([
                3.5388799, 3.5388799, 3.5388799, 3.5388799, 3.5388799, 3.5388799, 3.5388799, 3.5388799, 3.5388799, 3.4591336, 3.4561,
                3.4072924, 3.3721337, 3.3832974, 3.4105334, 3.4524047, 3.4580958, 3.4375236, 3.4199784, 3.4393167, 3.4584327, 3.4354074,
                3.4113927, 3.4119952, 3.4215453, 3.4216359, 3.4213932, 3.4325855, 3.4327922, 3.398506, 3.399336, 3.437289, 3.4664133, 3.4839017,
                3.4926062, 3.493307, 3.4989746, 3.4689262, 3.4236014, 3.41666, 3.4301221, 3.4599838, 3.465103, 3.4571815, 3.4482892, 3.4676614,
                3.496216, 3.5149648, 3.524428, 3.5305812, 3.5366623, 3.5252733, 3.5099807, 3.5153043, 3.5147445, 3.5075433, 3.4916546, 3.491599,
                3.5145745, 3.6262999, 3.974516, 4.168722, 4.255072, 4.140615, 3.8385026, 3.6227393, 3.5287037, 3.5015194, 3.506729, 3.605974,
                3.6752694, 3.572344, 3.5049593, 3.6320043, 3.7007551, 3.7074296, 3.7284214, 3.71259, 3.5978725, 3.6083283, 3.6992102, 3.6576242,
                3.557638, 3.5043185, 3.5170414, 3.601478, 3.7584405, 3.8834133, 3.8931904, 3.814434, 3.6640775, 3.5430145, 3.5342467, 3.5469003,
                3.5544434, 3.5179012, 3.4899187, 3.4986625, 3.5043032, 3.5049388])
        }, {
            start: 0,
            end: 99,
            coordinate: "y",
            values: new Float32Array([
                3.4649298, 3.4667826, 3.4629383, 3.466211, 3.4725702, 3.4732285, 3.4746306, 3.4783895, 3.478682, 3.4795306, 3.4864075, 3.4880533,
                3.4830766, 3.4778461, 3.4737396, 3.4744494, 3.4713385, 3.472508, 3.4888499, 3.5189433, 3.5597272, 3.5714843, 3.545362, 3.507979,
                3.4646971, 3.4514968, 3.456988, 3.467615, 3.5172741, 3.5968275, 3.6836078, 3.826141, 3.9673371, 4.0046005, 3.9301507, 3.7608857,
                3.5661457, 3.487837, 3.4686396, 3.4595885, 3.4436076, 3.4299421, 3.4464827, 3.4818513, 3.509606, 3.5292587, 3.536447, 3.522934,
                3.493671, 3.4837656, 3.4992337, 3.5113368, 3.5172505, 3.518542, 3.5195243, 3.5194263, 3.5064735, 3.482475, 3.4564917, 3.4352887,
                3.4251409, 3.417951, 3.4148626, 3.41891, 3.4224284, 3.4267948, 3.435942, 3.4396746, 3.438761, 3.4439719, 3.4420073, 3.4346523,
                3.4311812, 3.4243217, 3.4254432, 3.4329243, 3.43806, 3.4335177, 3.4192092, 3.417901, 3.4213035, 3.4223235, 3.4333832, 3.4351563,
                3.4341018, 3.4453797, 3.4654388, 3.4729166, 3.470188, 3.4677384, 3.468177, 3.4676323, 3.470549, 3.4872558, 3.5295255, 3.5618677,
                3.5519793, 3.5231485, 3.5053034, 3.5028384])
        }];
        appState.spatialProfiles.set(spatialProfileTest.regionId, spatialProfileTest);
        appState.backendService = new BackendService();
        appState.backendService.loggingEnabled = true;
        appState.fileBrowserState = new FileBrowserState(appState.backendService);

        const wsURL = `${location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.hostname}/socket`;
        console.log(`Connecting to defaullt URL: ${wsURL}`);
        appState.backendService.connect(wsURL, "1234").subscribe(sessionId => {
            console.log(`Connected with session ID ${sessionId}`);
        }, err => console.log(err));
    }

    public componentDidMount() {
        this.props.appState.layoutSettings.layout.init();
    }

    public render() {
        const appState = this.props.appState;
        return (
            <div className="App">
                <DevTools/>
                <RootMenuComponent appState={appState}/>
                <OverlaySettingsDialogComponent appState={appState}/>
                <URLConnectDialogComponent appState={appState}/>
                <FileBrowserDialogComponent fileBrowserState={appState.fileBrowserState}/>
            </div>
        );
    }
}

export default App;