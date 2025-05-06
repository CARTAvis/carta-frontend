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
    @observable zscale: number = 1;

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

    @computed get minValue() {
        if (this.minVal === undefined && this.frame && this.frame.renderConfig.isoSurfaceHistogram) {
            return getPercentiles(this.frame.renderConfig.isoSurfaceHistogram, [0.1])[0];
        } else {
            return this.minVal;
        }
    }

    @computed get maxValue() {
        if (this.maxVal === undefined && this.frame && this.frame.renderConfig.isoSurfaceHistogram) {
            return getPercentiles(this.frame.renderConfig.isoSurfaceHistogram, [99.9])[0];
        } else {
            return this.maxVal;
        }
    }

    @computed get range() {
        return this.maxValue - this.minValue;
    }

    constructor(props: Render3DViewerDialogProps) {
        super(props);
        // makeObservable(this); // makeObservable make RandomTexture not work
        this.widgetId = props.id.match(/render-3d-\d+/)[0];  
        // this.gl = VolumeWebGLService.Instance.gl;
        this.cmapTexture = new THREE.TextureLoader().load( allMaps );
        this.cmapIndex = 8;
        console.log("cmaptexture: ", this.cmapTexture);
        
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

            this.render3DData = AppStore?.Instance.render3D?.get(widgetStore?.effectiveFrame?.frameInfo.fileId)?.get(widgetStore.effectiveRegionId)?.get(widgetStore.render3DViewerId);

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
            console.log("lastSlice: ", lastSlice);
            this.generate3DTexture();
            return this.texture;
        }, [lastSlice]);

        const parameters = {
            minThreshold: this.minValue,
            maxThreshold: this.maxValue,
            opacity: 0.5,
            range: 0.1,
            steps: 100,
        };

        function update() {

            // material.uniforms.threshold.value = parameters.threshold;
            material.uniforms.uOpacity.value = parameters.opacity;
            // material.uniforms.range.value = parameters.range;
            material.uniforms.uSteps.value = parameters.steps;
            material.uniforms.uMinThreshold.value = parameters.minThreshold;
            material.uniforms.uMaxThreshold.value = parameters.maxThreshold;

        }

        const gui = new GUI();
        // gui.add( parameters, 'threshold', 0, 1, 0.01 ).onChange( update );
        gui.add( parameters, 'opacity', 0, 100.0, 0.01 ).onChange( update );
        // gui.add( parameters, 'range', 0, 1, 0.01 ).onChange( update );
        gui.add( parameters, 'steps', 0, 200, 1 ).onChange( update );
        gui.add( parameters, 'minThreshold', this.minVal, this.maxVal, 0.00001).onChange( update );
        gui.add( parameters, 'maxThreshold', this.minVal, this.maxVal, 0.00001).onChange( update );

        useEffect(() => {
            gl.getContext().getExtension("OES_texture_float");
    
            // Generate the texture when render3DData changes
            this.generate3DTexture();
            console.log("minMAX values: ", this.minValue, this.maxValue)
    
            // Create or update the shader material
            if (material) {
                material.uniforms.uDataTexture.value = this.texture;
                material.uniforms.uDataTexture.value.needsUpdate = true;
                material.uniforms.uFrame ++
            } else {
                // check how to load 2d image from threejs.
                const newMaterial = new THREE.ShaderMaterial({
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
                        uCmapIndex: { value: this.cmapIndex },
                        uNumCmaps: { value: 79 }, // 79 cmaps?
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
                    args={[ 1,1,this.zscale
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
                            // camera={{ position: [2, 2, 2] }}
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
