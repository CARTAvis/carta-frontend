import React, { useEffect, useRef } from "react";
// import { shaderMaterial } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
// import glsl from "babel-plugin-glsl/macro";
import {action, autorun, observable} from "mobx";
import {observer} from "mobx-react";
import * as THREE from 'three';

import { ResizeDetector } from "components/Shared";
// import {ImagePanelComponent} from "components/ImageView/ImagePanel/ImagePanelComponent";
// import {ImageType} from "models";
import {AppStore, DefaultWidgetConfig, WidgetsStore} from "stores"; // AppStore, , WidgetsStore 
import { Render3DDataStore } from "stores/Render3DDataStore/Render3DDataStore";

interface Render3DViewerDialogProps {
    id: string;
    docked: boolean;
    floatingSettingsId?: string;
}

/**
 * Main Scene
 */
// const VolumeRenderingScene: React.FC = () => {
//   return (
//     <Canvas camera={{ position: [2, 2, 2] }}>
//       <ambientLight intensity={0.5} />
//       <pointLight position={[10, 10, 10]} />
//       <VolumeRenderer />
//     </Canvas>
//   );
// };

// export default VolumeRenderingScene;


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

    // @observable width: number;
    // @observable height: number;
    // @observable depth: number;

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
    
            console.log("renderdata: ", this.render3DData);
        });
    }
    
    /**
     * Generates a 3D texture with random data (replace with actual astronomy data).
     */
    // generate3DTexture() {
    //     const size = 50;
    //     const data = new Float32Array(size * size * size);
    //     for (let i = 0; i < data.length; i++) {
    //     data[i] = Math.random();
    //     }
    
    //     const texture = new THREE.Data3DTexture(data, size, size, size);
    //     texture.format = THREE.RedFormat;
    //     texture.type = THREE.FloatType;
    //     texture.minFilter = THREE.LinearFilter;
    //     texture.magFilter = THREE.LinearFilter;
    //     texture.unpackAlignment = 1;
    //     texture.needsUpdate = true;
    
    //     return texture;
    // }

    

    @action generate3DTexture() {
        if (!this.render3DData) {
            return;
        }
        const texture = new THREE.Data3DTexture(this.render3DData.datacube, this.render3DData.width, this.render3DData.height, this.render3DData.depth);
        texture.format = THREE.RedFormat;
        texture.type = THREE.FloatType;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.unpackAlignment = 1;
        texture.needsUpdate = true;
        return texture;
    }

    generateHalfTexture() {
        const size = 50;
        const data = new Float32Array(size * size * size);
        for (let i = 0; i < data.length; i++) {
            if (i < size * size * size / 2) {
                data[i] = 1.0; // Set half of the data to 1.0
            } else {
                data[i] = 0.0; // Set the other half to 0.0
            }
        }

        const texture = new THREE.Data3DTexture(data, size, size, size);
        texture.format = THREE.RedFormat;
        texture.type = THREE.HalfFloatType;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.unpackAlignment = 1;
        texture.needsUpdate = true;

        return texture;
    }

    // VolumeShaderMaterial = new THREE.ShaderMaterial({
    //     uniforms: {
    //         uTexture: { value: this.generateHalfTexture() },
    //     },
    //     vertexShader: `
    //         varying vec3 vUv;
    //         void main() {
    //         vUv = position * 0.5 + 0.5;  // Normalize from [-0.5,0.5] to [0,1]
    //         gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    //         }
    //     `,
    //     fragmentShader: `
    //         precision highp sampler3D;
    //         uniform sampler3D uTexture;
    //         varying vec3 vUv;
        
    //         void main() {
    //         float intensity = texture(uTexture, vUv).r;
    //         gl_FragColor = vec4(vec3(intensity), intensity);
    //         }
    //     `,
    //     transparent: true,
    //     });

    VolumeShaderMaterial = new THREE.ShaderMaterial({
        uniforms: {
            uTexture: { value: this.generate3DTexture() },
            uCameraPosition: { value: new THREE.Vector3() },
            uBoxMin: { value: new THREE.Vector3(-0.5, -0.5, -0.5) },
            uBoxMax: { value: new THREE.Vector3(0.5, 0.5, 0.5) },
            uSteps: { value: 128 },  // Number of raymarching steps
            uStepSize: { value: 0.01 }  // Step size
        },
        vertexShader: `
            varying vec3 vRayDir;
            void main() {
                vRayDir = normalize(position - cameraPosition);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            precision highp sampler3D;
            uniform sampler3D uTexture;
            uniform vec3 uCameraPosition;
            uniform vec3 uBoxMin;
            uniform vec3 uBoxMax;
            uniform int uSteps;
            uniform float uStepSize;
            varying vec3 vRayDir;
    
            void main() {
                vec3 rayOrigin = uCameraPosition;
                vec3 rayDirection = normalize(vRayDir);
                vec4 accumulatedColor = vec4(0.0);
                float t = 0.0;
    
                for (int i = 0; i < uSteps; i++) {
                    vec3 samplePos = rayOrigin + rayDirection * t;
                    vec3 uv = (samplePos - uBoxMin) / (uBoxMax - uBoxMin);
    
                    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0 || uv.z < 0.0 || uv.z > 1.0) {
                        break;
                    }
    
                    float density = texture(uTexture, uv).r;
                    vec4 colorSample = vec4(vec3(density), density);
                    accumulatedColor.rgb += (1.0 - accumulatedColor.a) * colorSample.a * colorSample.rgb;
                    accumulatedColor.a += (1.0 - accumulatedColor.a) * colorSample.a;
    
                    if (accumulatedColor.a >= 1.0) break;
    
                    t += uStepSize;
                }
    
                gl_FragColor = accumulatedColor;
            }
        `,
        transparent: true
    });

    
    // Volume Rendering Component
     
    VolumeRenderer: React.FC = () => {
        const meshRef = useRef<THREE.Mesh>(null);
        const { gl } = useThree();
    
        useEffect(() => {
        gl.getContext().getExtension("OES_texture_float");
        }, [gl]);
    
        return (
        <mesh ref={meshRef} material={this.VolumeShaderMaterial}>
            <boxGeometry args={[1, 1, 1]} />
        </mesh>
        );
    };

    render() {
        // const frame = WidgetsStore?.Instance.render3DWidgets?.get(this.props.id)?.render3DFrame;

        return (
          <div className="render-3d-viewer-widget">
                <ResizeDetector onResize={this.onResize} throttleTime={33}>
                    <div className="render-3d-canvas">
                        <Canvas
                            // camera={{ position: [2, 2, 2] }}
                            style={{ width: "100%", height: "100%" }}
                        >
                            <ambientLight />
                            <mesh>
                                <boxGeometry args={[1, 1, 1]} />
                                <this.VolumeRenderer />
                                {/* <VolumeMaterial
                                    uTexture={this.generate3DTexture()}
                                    uSize={new THREE.Vector3(this.width, this.height, this.depth)}
                                /> */}
                            </mesh>
                        </Canvas>
                    </div>
                </ResizeDetector>
            </div>
        );
    }
}
