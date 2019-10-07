import {action, computed, observable} from "mobx";
import {Point2D} from "../models";
import {length2D, subtract2D} from "../utilities";

export class ContourStore {
    @observable indices: Int32Array;
    @observable vertexData: Float32Array;
    @observable lengthData: Float32Array;

    @computed get hasValidData() {
        if (!this.indices || !this.vertexData) {
            return false;
        }

        return this.indices.length > 0 && this.vertexData.length > 0;
    }

    @action setContourData = (indices: Int32Array, vertexData: Float32Array) => {
        this.indices = indices;
        this.vertexData = vertexData;

        const N = vertexData.length;
        const lengths = new Float32Array(N / 2);
        let cumulativeLength = 0;
        let lastPoint: Point2D = null;

        for (let i = 0; i < N - 1; i += 2) {
            const currentPoint = {x: vertexData[i], y: vertexData[i + 1]};
            let currentLength = 0;
            if (lastPoint) {
                const delta = subtract2D(currentPoint, lastPoint);
                currentLength = length2D(delta);
            }

            lastPoint = currentPoint;
            cumulativeLength += currentLength;
            lengths[i / 2] = cumulativeLength;
        }

        this.lengthData = lengths;
    };

    @action clearData = () => {
        this.indices = null;
        this.vertexData = null;
    };
}