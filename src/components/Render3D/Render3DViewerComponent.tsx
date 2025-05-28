import React, {useEffect, useRef} from "react"; // , useState
import { Canvas, extend, useFrame, useThree} from "@react-three/fiber";
import {action, autorun, computed, observable} from "mobx";
import {observer} from "mobx-react";
import allMaps from "static/allmaps.png";
import * as THREE from 'three';
import { TrackballControls } from "three/examples/jsm/controls/TrackballControls";
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';

import { ResizeDetector } from "components/Shared";
// import {VolumeWebGLService} from "services";
import {AppStore, DefaultWidgetConfig, WidgetsStore} from "stores"; // AppStore, , WidgetsStore 
import { FrameStore, } from "stores/Frame";
import { Render3DDataStore } from "stores/Render3DDataStore/Render3DDataStore";
import {getPercentiles} from "utilities";

import {volumeShaders} from "../../services/GLSL";

interface Render3DViewerDialogProps {
    id: string;
    docked: boolean;
    floatingSettingsId?: string;
}

// Extend Three.js with OrbitControls
extend({ TrackballControls });

// Custom component for controls
const Controls = () => {
    const { camera, gl } = useThree();
    const controls = useRef<TrackballControls | null>(null);

    useEffect(() => {
        controls.current = new TrackballControls(camera, gl.domElement);
        controls.current.enableDamping = true;
        controls.current.dampingFactor = 0.1;
        controls.current.rotateSpeed = 1;
        controls.current.zoomSpeed = 1.2;

        return () => controls.current?.dispose();
    }, [camera, gl]);

    useFrame(() => controls.current?.update());

    return null;
};


@observer
export class Render3DViewerComponent extends React.Component<Render3DViewerDialogProps> {
    public static get WIDGET_CONFIG(): DefaultWidgetConfig {
        return {
            id: "render-3d-viewer",
            type: "render-3d-viewer",
            minWidth: 300,
            minHeight: 300,
            defaultWidth: 600,
            defaultHeight: 600,
            title: "3D Rendering Viewer",
            isCloseable: true,
            parentId: "render-3d",
            parentType: "render-3d"
        };
    }

    // private readonly gl: WebGL2RenderingContext | null;

    @observable width: number;
    @observable height: number;
    @observable depth: number;

    @observable texture: THREE.Data3DTexture;
    @observable cmapTexture: THREE.DataTexture;
    @observable cmapIndex: number;
    @observable minVal: number;
    @observable maxVal: number;
    // @observable zScale: number;

    // this.width = render3DData.width;
    // this.height = render3DData.height;
    // this.depth = render3DData.depth

    @observable widgetId: string;
    @observable render3DData: Render3DDataStore;
    
    @observable panelWidth: number;
    @observable panelHeight: number;

    @observable frame: FrameStore;

    @action onResize = (width: number, height: number) => {
        this.panelWidth = width;
        this.panelHeight = height;
    };

    // these are not the absolute min and max values, but the percentiles of the histogram
    @computed get minValue() {
        if (this.minVal === undefined && this.frame && this.frame.renderConfig.isoSurfaceHistogram) {
            return getPercentiles(this.frame.renderConfig.isoSurfaceHistogram, [0.0005])[0];
        } else {
            return this.minVal;
        }
    }

    @computed get maxValue() {
        if (this.maxVal === undefined && this.frame && this.frame.renderConfig.isoSurfaceHistogram) {
            return getPercentiles(this.frame.renderConfig.isoSurfaceHistogram, [99.9995])[0];
        } else {
            return this.maxVal;
        }
    }

    constructor(props: Render3DViewerDialogProps) {
        super(props);
        // makeObservable(this); // makeObservable make RandomTexture not work
        this.widgetId = props.id.match(/render-3d-\d+/)[0];  
        // this.gl = VolumeWebGLService.Instance.gl;
        this.cmapTexture = new THREE.TextureLoader().load( allMaps );
        this.cmapTexture.magFilter = THREE.NearestFilter;
        this.cmapTexture.minFilter = THREE.NearestFilter;
        // console.log("cmaptexture: ", this.cmapTexture);
        // this.zScale = 1;
        
        autorun(() => {
            const widgetId = this.props.id.match(/render-3d-\d+/)[0];
            const widgetStore = WidgetsStore?.Instance.render3DWidgets?.get(widgetId);
            this.frame = widgetStore?.effectiveFrame;
            // console.log("frame: ", this.frame.renderConfig);
            // console.log("regionid: ", widgetStore.effectiveRegionId);
            // console.log("frameid: ", widgetStore.effectiveFrame.frameInfo.fileId);
            // console.log("viewerid: ", widgetStore.render3DViewerId);
            // console.log("render3d: ", AppStore?.Instance.render3D);
            // console.log("render3D keys:", Array.from(AppStore?.Instance.render3D?.keys() || []));
            // console.log("render3D.get(0):", AppStore?.Instance.render3D?.get(0));
            // console.log("render3d effectiveregion: ", AppStore.Instance.render3D.get(widgetStore.effectiveFrame.frameInfo.fileId));
            // console.log("render3d viewerid: ", AppStore.Instance.render3D.get(widgetStore.effectiveFrame.frameInfo.fileId)?.get(widgetStore.render3DViewerId));

            // this.render3DData = AppStore?.Instance.render3D?.get(widgetStore?.effectiveFrame?.frameInfo.fileId)?.get(widgetStore.effectiveRegionId)?.get(widgetStore.render3DViewerId);

            this.render3DData = AppStore?.Instance.render3D?.get(widgetStore?.render3DViewerId);

            // console.log("width: ", this.render3DData?.width);
            // console.log("height: ", this.render3DData?.height);
            // console.log("depth: ", this.render3DData?.depth);
            
        });
    }

    @action generate3DTexture() {
        if (!this.render3DData) {
    
            this.width = 0;
            this.height = 0;
            this.depth = 0;
    
            this.texture = new THREE.Data3DTexture(new Float32Array(), 0, 0, 0);

            console.log("No render3DData available");

        } else {

            this.width = this.render3DData.width;
            this.height = this.render3DData.height;
            this.depth = this.render3DData.depth;

            // console.log("render3DData: ", this.render3DData);
    
            this.texture = new THREE.Data3DTexture(
                this.render3DData.datacube,
                this.render3DData.width,
                this.render3DData.height,
                this.render3DData.depth
            );
        }
    
        this.texture.format = THREE.RedFormat;
        this.texture.type = THREE.FloatType;
        this.texture.minFilter = THREE.LinearFilter;
        this.texture.magFilter = THREE.LinearFilter;
        this.texture.unpackAlignment = 1;
        this.texture.needsUpdate = true;

        // console.log("texture: ", this.texture);
    }

    VolumeRenderer: React.FC = observer(() => {
        const meshRef = useRef<THREE.Mesh>(null);
        const { gl } = useThree();
        const [material, setMaterial] = React.useState<THREE.ShaderMaterial | null>(null);
        const lastSlice = this.render3DData?.lastSlice;

        const computedTexture = React.useMemo(() => {
            if (this.render3DData) {
                if (lastSlice === this.render3DData.depth - 1) {
                    console.log("Full texture loaded");
                } else if (lastSlice%20 === 0) {
                    console.log("Loading texture");
                }
            }
            this.generate3DTexture();
            return this.texture;
        }, [lastSlice]);

        const parameters = {
            minThreshold: this.minValue,
            maxThreshold: this.maxValue,
            // range: 0.1,
            // steps: 100,
            colorMap: 0,
            scaleType: 0,
            // zScale: 1,
            inverted: false,
            alpha: 1000.0,
            gamma: 1.0,

        };

        const cmaps = {'accent': 0, 'afmhot': 1, 'autumn': 2, 'binary': 3, 'Blues': 4, 'bone': 5, 'BrBG': 6, 'brg': 7, 'BuGn': 8, 'BuPu': 9, 'bwr': 10, 'CMRmap': 11, 'cool': 12, 'coolwarm': 13, 'copper': 14, 'cubehelix': 15, 'dark2': 16, 'flag': 17, 'gist_earth': 18, 'gist_gray': 19, 'gist_heat': 20, 'gist_ncar': 21, 'gist_rainbow': 22, 'gist_stern': 23, 'gist_yarg': 24, 'GnBu': 25, 'gnuplot': 26, 'gnuplot2': 27, 'gray': 28, 'greens': 29, 'greys': 30, 'hot': 31, 'hsv': 32, 'inferno': 33, 'jet': 34, 'magma': 35, 'nipy_spectral': 36, 'ocean': 37, 'oranges': 38, 'OrRd': 39, 'paired': 40, 'pastel1': 41, 'pastel2': 42, 'pink': 43, 'PiYG': 44, 'plasma': 45, 'PRGn': 46, 'prism': 47, 'PuBu': 48, 'PuBuGn': 49, 'PuOr': 50, 'PuRd': 51, 'purples': 52, 'rainbow': 53, 'RdBu': 54, 'RdGy': 55, 'RdPu': 56, 'RdYlBu': 57, 'RdYlGn': 58, 'reds': 59, 'seismic': 60, 'set1': 61, 'set2': 62, 'set3': 63, 'spectral': 64, 'spring': 65, 'summer': 66, 'tab10': 67, 'tab20': 68, 'tab20b': 69, 'tab20c': 70, 'terrain': 71, 'viridis': 72, 'winter': 73, 'Wistia': 74, 'YlGn': 75, 'YlGnBu': 76, 'YlOrBr': 77, 'YlOrRd': 78};

        const scaleType = {'Linear': 0, 'Log': 1, 'Sqrt': 2, 'Square': 3, 'Power': 4, 'Gamma': 5};

        function update() {

            // material.uniforms.threshold.value = parameters.threshold;
            // material.uniforms.range.value = parameters.range;
            // material.uniforms.uSteps.value = parameters.steps;
            material.uniforms.uMinThreshold.value = parameters.minThreshold;
            material.uniforms.uMaxThreshold.value = parameters.maxThreshold;
            material.uniforms.uCmapIndex.value = parameters.colorMap;
            material.uniforms.uScaleType.value = parameters.scaleType;
            material.uniforms.uInverted.value = parameters.inverted ? 1 : 0;
            material.uniforms.uAlpha.value = parameters.alpha;
            material.uniforms.uGamma.value = parameters.gamma;
        }

        const gui = new GUI();
        // gui.add( parameters, 'threshold', 0, 1, 0.01 ).onChange( update );
        // gui.add( parameters, 'range', 0, 1, 0.01 ).onChange( update );
        // gui.add( parameters, 'steps', 0, 200, 1 ).onChange( update );
        gui.add( parameters, 'minThreshold', this.minValue, this.maxValue).onChange( update );
        gui.add( parameters, 'maxThreshold', this.minValue, this.maxValue).onChange( update );
        gui.add( parameters, 'colorMap', cmaps).onChange( update );
        gui.add( parameters, 'scaleType', scaleType).onChange( update );
        // gui.add( parameters, 'zScale', 0, 10).onChange( update );
        gui.add( parameters, 'inverted').onChange( update );
        gui.add( parameters, 'alpha').onChange( update );
        gui.add( parameters, 'gamma', 0.1, 2.0).onChange( update );

        useEffect(() => {
            gl.getContext().getExtension("OES_texture_float");
    
            // Generate the texture when render3DData changes
            this.generate3DTexture();
            // console.log("minMAX values: ", this.minValue, this.maxValue)
    
            // Create or update the shader material
            if (material) {
                material.uniforms.uDataTexture.value = this.texture;
                material.uniforms.uDataTexture.value.needsUpdate = true;
                material.uniforms.uFrame ++
            } else {
                // check how to load 2d image from threejs.
                const newMaterial = new THREE.ShaderMaterial({
                    side: THREE.BackSide,
                    blending: THREE.NormalBlending,
                    uniforms: {
                        uDataTexture: { value: this.texture },
                        uMinVal: {value: this.minValue},
                        uMaxVal: {value: this.maxValue},
                        uMinThreshold: {value: this.minValue},
                        uMaxThreshold: {value: this.maxValue},
                        // threshold: { value: 0.25 },
                        // range: { value: 0.1 },
                        uOpacity: { value: 0.5 },
                        uSteps: { value: 100 },
                        // uFrame: { value: 0 },
                        uCmapTexture: { value: this.cmapTexture },
                        uCmapIndex: { value: 0 },
                        uNumCmaps: { value: 79 }, // 79 cmaps?
                        uScaleType: { value: 0 },
                        uInverted: { value: 0 },
                        uAlpha: { value: 1000.0 },
                        uGamma: { value: 1.0 },
                    },
                    vertexShader: volumeShaders.vertexShader,
                    fragmentShader: volumeShaders.fragmentShader,
                    transparent: true,
                });
                setMaterial(newMaterial);
            }
        }, [gl, material, computedTexture]); // Runs when render3DData changes
    
        return material ? (
            <mesh ref={meshRef} material={material}>
                <boxGeometry
                    args={[ 1,1,1
                        // this.width / Math.max(this.width, Math.max(this.height, this.depth)),
                        // this.height / Math.max(this.width, Math.max(this.height, this.depth)),
                        // this.depth / Math.max(this.width, Math.max(this.height, this.depth)),
                    ]}
                />
            </mesh>
        ) : null;
    });

    render() {
        // const frame = WidgetsStore?.Instance.render3DWidgets?.get(this.props.id)?.render3DFrame;

        return (
            // the div elements make the canvas smaller, it inherits default size?
        //   <div className="render-3d-viewer-widget">
                <ResizeDetector onResize={this.onResize} throttleTime={33}>
                    {/* <div className="render-3d-canvas" > */}
                        <Canvas
                            camera={{ near: 0.00001, far: 100000}} // position: [2, 2, 2]
                            style={{ width: "100%", height: "100%" }} >
                            
                            <ambientLight />
                            <Controls />
                            <this.VolumeRenderer/>
                        </Canvas>
                    {/* </div> */}
                </ResizeDetector>
            // </div>
        );
    }
}
