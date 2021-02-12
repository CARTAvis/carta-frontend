import {AlertStore} from "stores";
import {TemplateNodes} from "./templates";

export const GL = WebGLRenderingContext;

export function getShaderFromString(gl: WebGLRenderingContext, shaderScript: string, type: number) {
    if (!gl || !shaderScript || !(type === GL.VERTEX_SHADER || type === GL.FRAGMENT_SHADER)) {
        return null;
    }

    let shader = gl.createShader(type);
    gl.shaderSource(shader, shaderScript);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, GL.COMPILE_STATUS)) {
        console.log(gl.getShaderInfoLog(shader));
        return null;
    }
    return shader;
}

export function getShaderProgram(gl: WebGLRenderingContext, vertexShaderString: string, pixelShaderString: string) {
    if (!gl) {
        return null;
    }

    let vertexShader = getShaderFromString(gl, vertexShaderString, GL.VERTEX_SHADER);
    let fragmentShader = getShaderFromString(gl, pixelShaderString, GL.FRAGMENT_SHADER);

    let shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, GL.LINK_STATUS)) {
        console.log("Could not initialise shaders");
        return null;
    }
    return shaderProgram;
}
export function loadImageTexture(gl: WebGLRenderingContext, url: string, texIndex: number): Promise<WebGLTexture> {
    return new Promise<WebGLTexture>((resolve, reject) => {
        if (!gl) {
            reject();
        }
        const image = new Image();
        // Replace the existing texture with the real one once loaded
        image.onload = () => {
            const imageTexture = gl.createTexture();
            gl.activeTexture(texIndex);
            gl.bindTexture(GL.TEXTURE_2D, imageTexture);
            gl.texImage2D(GL.TEXTURE_2D, 0, GL.RGB, GL.RGB, GL.UNSIGNED_BYTE, image);
            gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, GL.CLAMP_TO_EDGE);
            gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_T, GL.CLAMP_TO_EDGE);
            gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.NEAREST);
            gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.NEAREST);
            resolve(imageTexture);
        };
        image.onerror = () => reject(`Error loading image ${url}`);
        image.src = url;
    });
}

export function createFP32Texture(gl: WebGLRenderingContext, width: number, height: number, texIndex: number, filtering: number = GL.NEAREST) {
    if (!gl) {
        return null;
    }
    const texture = gl.createTexture();
    gl.activeTexture(texIndex);
    gl.bindTexture(GL.TEXTURE_2D, texture);
    gl.texImage2D(GL.TEXTURE_2D, 0, GL.LUMINANCE, width, height, 0, GL.LUMINANCE, GL.FLOAT, new Float32Array(width * height));
    gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, filtering);
    gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, filtering);
    gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, GL.CLAMP_TO_EDGE);
    gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_T, GL.CLAMP_TO_EDGE);
    return texture;
}

export function copyToFP32Texture(gl: WebGLRenderingContext, texture: WebGLTexture, data: Float32Array, texIndex: number, dataWidth: number, dataHeight: number, xOffset: number, yOffset: number) {
    if (!gl) {
        return;
    }
    gl.bindTexture(GL.TEXTURE_2D, texture);
    gl.activeTexture(texIndex);
    gl.texSubImage2D(GL.TEXTURE_2D, 0, xOffset, yOffset, dataWidth, dataHeight, GL.LUMINANCE, GL.FLOAT, data);
    gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.NEAREST);
    gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.NEAREST);
    gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, GL.CLAMP_TO_EDGE);
    gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_T, GL.CLAMP_TO_EDGE);
}

export function initWebGL(){
    const gl = document.createElement("canvas").getContext("webgl");
    const floatExtension = gl?.getExtension("OES_texture_float");
    if (!gl || !floatExtension) {
        AlertStore.Instance.showAlert(TemplateNodes.WebGLErrorMessage, "issue");
        return null;
    }
    return gl;
}