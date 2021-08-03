export class EventHook<T> {
    #callbacks: Array<(value: T) => void>;

    constructor(name: string = "") {
        this.#callbacks = [];
    }

    public clear() {
        this.#callbacks = [];
    }

    public set(callback: (value: T) => void): boolean {
        if (typeof callback === "function") {
            this.#callbacks = [callback];
            return true;
        }
        return false;
    }

    public add(callback: (value: T) => void): boolean {
        if (typeof callback === "function" && this.#callbacks.indexOf(callback) === -1) {
            this.#callbacks.push(callback);
            return true;
        }
        return false;
    }

    public remove(callback: (value: T) => void): boolean {
        const index = this.#callbacks.indexOf(callback);
        if (index !== -1) {
            this.#callbacks.splice(index, 1);
            return true;
        }
        return false;
    }

    public fire(value: T) {
        if (this.#callbacks) {
            for (const cb of this.#callbacks) {
                cb(value);
            }
        }
    }
}
