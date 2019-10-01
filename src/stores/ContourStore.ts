import {action, computed, observable} from "mobx";

export class ContourStore {
    @observable indices: Int32Array;
    @observable vertexData: Float32Array;

    @computed get hasValidData() {
        if (!this.indices || !this.vertexData) {
            return false;
        }

        return this.indices.length > 0 && this.vertexData.length > 0;
    }

    @action setContourData = (indices: Int32Array, vertexData: Float32Array) => {
        this.indices = indices;
        this.vertexData = vertexData;
    };

    @action clearData = () => {
        this.indices = null;
        this.vertexData = null;
    };
}