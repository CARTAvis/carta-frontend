import React, {useEffect, useRef} from "react"; // , useState
import { Canvas, extend, useFrame, useThree} from "@react-three/fiber";
// import glsl from "babel-plugin-glsl/macro";
import {action, autorun, observable} from "mobx";
import {observer} from "mobx-react";
import * as THREE from 'three';
import { TrackballControls } from "three/examples/jsm/controls/TrackballControls";

import { ResizeDetector } from "components/Shared";
import {AppStore, DefaultWidgetConfig, WidgetsStore} from "stores"; // AppStore, , WidgetsStore 
import { Render3DDataStore } from "stores/Render3DDataStore/Render3DDataStore";

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

    @observable width: number;
    @observable height: number;
    @observable depth: number;
    // @observable index: number;

    @observable texture: THREE.Data3DTexture;

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
            
        });
    }

    @action generate3DTexture() {
        if (!this.render3DData) {
    
            this.width = 0;
            this.height = 0;
            this.depth = 0;
    
            this.texture = new THREE.Data3DTexture(new Float32Array(), 0, 0, 0);

        } else {

            this.width = this.render3DData.width;
            this.height = this.render3DData.height;
            this.depth = this.render3DData.depth;

            console.log("render3DData: ", this.render3DData);
    
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

        console.log("texture: ", this.texture);
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

        useEffect(() => {
            gl.getContext().getExtension("OES_texture_float");
    
            // Generate the texture when render3DData changes
            this.generate3DTexture();
    
            // Create or update the shader material
            if (material) {
                material.uniforms.uTexture.value = this.texture;
                material.uniforms.uTexture.value.needsUpdate = true;
            } else {
                const newMaterial = new THREE.ShaderMaterial({
                    uniforms: {
                        uTexture: { value: this.texture },
                    },
                    vertexShader: /* glsl */`
                        varying vec3 vUv;
                        void main() {
                            vUv = position * 0.5 + 0.5;  // Normalize from [-0.5,0.5] to [0,1]
                            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                        }
                    `,
                    fragmentShader: /* glsl */`
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
                setMaterial(newMaterial);
            }
        }, [gl, material, computedTexture]); // Runs when render3DData changes
    
        return material ? (
            <mesh ref={meshRef} material={material}>
                <boxGeometry
                    args={[
                        this.width / Math.max(this.width, Math.max(this.height, this.depth)),
                        this.height / Math.max(this.width, Math.max(this.height, this.depth)),
                        this.depth / Math.max(this.width, Math.max(this.height, this.depth)),
                    ]}
                />
            </mesh>
        ) : null;
    });

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
