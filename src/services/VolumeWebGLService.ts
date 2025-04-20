import allMaps from "static/allmaps.png";

import {getShaderProgram, GL2, initWebGL2, loadImageTexture} from "utilities";

import { volumeShaders } from "./GLSL";

interface ShaderUniforms {
    // MinVal: WebGLUniformLocation | null;
    // MaxVal: WebGLUniformLocation | null;
    // ScaleType: WebGLUniformLocation | null;
    DataTexture: WebGLUniformLocation | null;
    CmapTexture: WebGLUniformLocation | null;
    NumCmaps: WebGLUniformLocation | null;
    CmapIndex: WebGLUniformLocation | null;
}

export class VolumeWebGLService {
    protected static staticInstance: VolumeWebGLService;

    readonly gl: WebGL2RenderingContext;
    cmapTexture: WebGLTexture;
    // Shader uniform handles
    shaderProgram: WebGLProgram | null;
    shaderUniforms: ShaderUniforms;

    static get Instance() {
        if (!VolumeWebGLService.staticInstance) {
            VolumeWebGLService.staticInstance = new VolumeWebGLService();
        }
        return VolumeWebGLService.staticInstance;
    }

    private initShaders() {
        if (!this.gl) {
            return;
        }
        this.shaderProgram = getShaderProgram(this.gl, volumeShaders.vertexShader, volumeShaders.fragmentShader);
        if (this.shaderProgram) {
            this.gl.useProgram(this.shaderProgram);
            this.shaderUniforms = {
                // MinVal: this.gl.getUniformLocation(this.shaderProgram, "MinVal"),
                // MaxVal: this.gl.getUniformLocation(this.shaderProgram, "MaxVal"),
                // ScaleType: this.gl.getUniformLocation(this.shaderProgram, "ScaleType"),
                DataTexture: this.gl.getUniformLocation(this.shaderProgram, "uDataTexture"),
                CmapTexture: this.gl.getUniformLocation(this.shaderProgram, "uCmapTexture"),
                NumCmaps: this.gl.getUniformLocation(this.shaderProgram, "uNumCmaps"),
                CmapIndex: this.gl.getUniformLocation(this.shaderProgram, "uCmapIndex")
            };
        }

        this.gl.uniform1i(this.shaderUniforms.DataTexture, 0);
        this.gl.uniform1i(this.shaderUniforms.CmapTexture, 1);
        this.gl.uniform1i(this.shaderUniforms.NumCmaps, 79); // 79 cmaps?
        this.gl.uniform1i(this.shaderUniforms.CmapIndex, 2); // default to third cmap, inferno?

    }

    protected constructor() {
        this.gl = initWebGL2();
        if (!this.gl) {
            return;
        }
        this.initShaders();
        loadImageTexture(this.gl, allMaps, GL2.TEXTURE1).then(texture => {
            this.cmapTexture = texture;
        });

    }

}