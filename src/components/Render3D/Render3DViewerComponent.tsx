import React, {useEffect, useRef} from "react"; // , useState
import { Canvas, extend, useFrame, useThree} from "@react-three/fiber";
import { max } from "lodash";
// import glsl from "babel-plugin-glsl/macro";
import {action, autorun, observable} from "mobx";
import {observer} from "mobx-react";
import * as THREE from 'three';
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

import { ResizeDetector } from "components/Shared";
import {AppStore, DefaultWidgetConfig, WidgetsStore} from "stores"; // AppStore, , WidgetsStore 
import { Render3DDataStore } from "stores/Render3DDataStore/Render3DDataStore";

interface Render3DViewerDialogProps {
    id: string;
    docked: boolean;
    floatingSettingsId?: string;
}

// Extend Three.js with OrbitControls
extend({ OrbitControls });

// Custom component for controls
const Controls = () => {
    const { camera, gl } = useThree();
    const controls = useRef<OrbitControls | null>(null);

    useEffect(() => {
        controls.current = new OrbitControls(camera, gl.domElement);
        controls.current.enableDamping = true;
        controls.current.dampingFactor = 0.1;
        controls.current.rotateSpeed = 1;
        controls.current.zoomSpeed = 1.2;

        return () => controls.current?.dispose();
    }, [camera, gl]);

    useFrame(() => controls.current?.update());

    return null; // This component does not render anything
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

    @observable width: number;
    @observable height: number;
    @observable depth: number;
    // @observable index: number;

    // this.width = render3DData.width;
    // this.height = render3DData.height;
    // this.depth = render3DData.depth

    @observable widgetId: string;
    @observable render3DData: Render3DDataStore;
    
    @observable panelWidth: number;
    @observable panelHeight: number;

    @action onResize = (width: number, height: number) => {
        this.panelWidth = width;
        this.panelHeight = height;
    };

    constructor(props: Render3DViewerDialogProps) {
        super(props);
        // makeObservable(this); // makeObservable make RandomTexture not work
        this.widgetId = props.id.match(/render-3d-\d+/)[0];

        autorun(() => {
            const widgetId = this.props.id.match(/render-3d-\d+/)[0];
            const widgetStore = WidgetsStore?.Instance.render3DWidgets?.get(widgetId);
            console.log("regionid: ", widgetStore.effectiveRegionId);
            console.log("frameid: ", widgetStore.effectiveFrame.frameInfo.fileId);
            console.log("render3d: ", AppStore?.Instance.render3D);
            console.log("render3D keys:", Array.from(AppStore?.Instance.render3D?.keys() || []));
            console.log("render3D.get(0):", AppStore?.Instance.render3D?.get(0));
    
            console.log("render3d effectiveregion: ", AppStore.Instance.render3D.get(widgetStore.effectiveFrame.frameInfo.fileId));
    
            this.render3DData = AppStore?.Instance.render3D?.get(widgetStore?.effectiveFrame?.frameInfo.fileId)?.get(widgetStore.effectiveRegionId);
            
            if (this.render3DData) {

                console.log("renderdata: ", this.render3DData.datacube);

            }
            
        });
    }    

    @action generate3DTexture() {
        if (!this.render3DData) {
            return;
        }
        
        // for (let i = 0; i < this.render3DData.datacube.length; i++) {
        //     this.render3DData.datacube[i] = (this.render3DData.datacube[i] - this.getMin()) / (this.getMax() - this.getMin());
        // }

        const texture = new THREE.Data3DTexture(this.render3DData.datacube, this.render3DData.width, this.render3DData.height, this.render3DData.depth);
        texture.format = THREE.RedFormat;
        texture.type = THREE.FloatType;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.unpackAlignment = 1;
        texture.needsUpdate = true;
        return texture;
    }

    @action generateRandomTexture() {

        this.width = 50;
        this.height = 100;
        this.depth = 50;

        // const size = 50;
        const data = new Float32Array(this.width * this.height * this.depth);
        for (let i = 0; i < data.length; i++) {
            data[i] = Math.random();
        }

        const texture = new THREE.Data3DTexture(data, this.width, this.height, this.depth);
        texture.format = THREE.RedFormat;
        texture.type = THREE.FloatType;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.unpackAlignment = 1;
        texture.needsUpdate = true;
        return texture;
    }

    @action VolumeShaderMaterial = new THREE.ShaderMaterial({
        uniforms: {
            uTexture: { value: this.generateRandomTexture() },
        },
        vertexShader: `
            varying vec3 vUv;
            void main() {
            vUv = position * 0.5 + 0.5;  // Normalize from [-0.5,0.5] to [0,1]
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            precision highp sampler3D;
            uniform sampler3D uTexture;
            varying vec3 vUv;
        
            void main() {
            float intensity = texture(uTexture, vUv).r;
            gl_FragColor = vec4(vec3(intensity), intensity);
            }
        `,
        transparent: true,
        });
     
    VolumeRenderer: React.FC = () => {
        const meshRef = useRef<THREE.Mesh>(null);
        const { gl } = useThree();
    
        useEffect(() => {
        gl.getContext().getExtension("OES_texture_float");
        }, [gl]);
    
        return (
        <mesh ref={meshRef} material={this.VolumeShaderMaterial}>
            <boxGeometry args={[this.width/max([this.width,max([this.height, this.depth])]),
                                this.height/max([this.width,max([this.height, this.depth])]),
                                this.depth/max([this.width,max([this.height, this.depth])])]} />
        </mesh>
        );
    };

    render() {
        // const frame = WidgetsStore?.Instance.render3DWidgets?.get(this.props.id)?.render3DFrame;

        return (
          <div className="render-3d-viewer-widget">
                <ResizeDetector onResize={this.onResize} throttleTime={33}>
                    <div className="render-3d-canvas" >
                        <Canvas
                            // camera={{ position: [2, 2, 2] }}
                            style={{ width: "100%", height: "100%" }} >

                            <ambientLight />
                            <Controls />
                            <this.VolumeRenderer/>
                        </Canvas>
                    </div>
                </ResizeDetector>
            </div>
        );
    }
}
