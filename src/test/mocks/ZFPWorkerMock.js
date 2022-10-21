export default class ZFPWorker {
    constructor() {
        this.onmessage = () => {};
    }
    
    postMessage(msg) {
        this.onmessage(msg);
    }
}