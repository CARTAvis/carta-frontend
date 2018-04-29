import * as React from "react";
import * as GoldenLayout from "golden-layout";
import {ItemConfigType} from "golden-layout";
import * as AST from "./wrappers/ast_wrapper";
import "./App.css";
import {PlaceholderComponent} from "./components/Placeholder/PlaceholderComponent";
import {RootMenuComponent} from "./components/Menu/RootMenuComponent";
import {ImageViewComponent} from "./components/ImageView/ImageViewComponent";
import {AppState} from "./AppState";
import {observer} from "mobx-react";

@observer
class App extends React.Component<{ appState: AppState }> {

    goldenLayout: GoldenLayout;
    layoutContents: ItemConfigType[];

    constructor(props: { appState: AppState }) {
        super(props);
        this.layoutContents = [{
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
                        props: {label: "Animation placeholder"}
                    }, {
                        type: "react-component",
                        component: "placeholder",
                        title: "Color map",
                        props: {label: "Color map placeholder"}
                    }]
                }]
            }, {
                type: "column",
                content: [{
                    type: "react-component",
                    component: "placeholder",
                    title: "X Profile: Cursor",
                    props: {label: "Graph placeholder"}
                }, {
                    type: "react-component",
                    component: "placeholder",
                    title: "Y Profile: Cursor",
                    props: {label: "Graph placeholder"}
                }, {
                    type: "react-component",
                    component: "placeholder",
                    title: "Z Profile: Cursor",
                    props: {label: "Graph placeholder"}
                }, {
                    type: "stack",
                    height: 33.3,
                    content: [{
                        type: "react-component",
                        component: "placeholder",
                        title: "Histogram: Region #1",
                        props: {label: "Histogram placeholder"}
                    }, {
                        type: "react-component",
                        component: "placeholder",
                        title: "Statistics: Region #1",
                        props: {label: "Statistics placeholder"}
                    }]
                }]
            }]
        }];

        this.goldenLayout = new GoldenLayout({
            settings: {
                showPopoutIcon: false
            },
            content: this.layoutContents
        });
        this.goldenLayout.registerComponent("placeholder", PlaceholderComponent);
        this.goldenLayout.registerComponent("image-view", ImageViewComponent);

        AST.onReady.then(() => {
            // We will eventually read the header from a file. Suppressing linting error for now
            // tslint:disable-next-line
            const initResult = AST.initFrame("SIMPLE  =                    T / conforms to FITS standard                      BITPIX  =                  -32 / array data type                                NAXIS   =                    3 / number of array dimensions                     NAXIS1  =                 5850                                                  NAXIS2  =                 1074                                                  NAXIS3  =                    1                                                  OBJECT  = 'GALFACTS_N4 Stokes I'                                  /  Object nameCTYPE1  = 'RA---CAR'           /  1st axis type                                 CRVAL1  =           333.750000 /  Reference pixel value                         CRPIX1  =              2925.50 /  Reference pixel                               CDELT1  =           -0.0166667 /  Pixel size in world coordinate units          CROTA1  =               0.0000 /  Axis rotation in degrees                      CTYPE2  = 'DEC--CAR'           /  2nd axis type                                 CRVAL2  =             0.000000 /  Reference pixel value                         CRPIX2  =             -1181.50 /  Reference pixel                               CDELT2  =            0.0166667 /  Pixel size in world coordinate units          CROTA2  =               0.0000 /  Axis rotation in degrees                      CTYPE3  = 'FREQ'               /  3rd axis type                                 CRVAL3  =    1524717952.000000 /  Reference pixel value                         CRPIX3  =                 1.00 /  Reference pixel                               CDELT3  =      -420000.0000000 /  Pixel size in world coordinate units          CROTA3  =               0.0000 /  Axis rotation in degrees                      EQUINOX =              2000.00 /  Equinox of coordinates (if any)               BUNIT   = 'Kelvin'                                 /  Units of pixel data valuesHISTORY Image was compressed by CFITSIO using scaled integer quantization:      HISTORY   q = 2.000000 / quantized level scaling parameter                      HISTORY 'SUBTRACTIVE_DITHER_1' / Pixel Quantization Algorithm                   CHECKSUM= '4LTe5LRd4LRd4LRd'   / HDU checksum updated 2017-06-01T10:19:12       DATASUM = '159657855'          / data unit checksum updated 2017-06-01T10:19:12 END                                                                             ");
            console.log(initResult);
            this.props.appState.astReady = true;
        });
    }

    public componentDidMount() {
        this.goldenLayout.init();
    }

    public render() {

        return (
            <div className="App">
                <RootMenuComponent/>
            </div>
        );
    }
}

export default App;
