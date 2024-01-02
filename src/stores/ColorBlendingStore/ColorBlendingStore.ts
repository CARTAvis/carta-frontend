export class ColorBlendingStore {
    readonly id: number;
    readonly filename: string;

    constructor(id: number) {
        this.id = id;
        this.filename = `Color Blending ${id + 1}`;
    }
}
