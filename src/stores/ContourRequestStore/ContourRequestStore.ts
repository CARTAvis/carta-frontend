import {CARTA} from "carta-protobuf";
import {throttle} from "lodash";

import {AppStore, type FrameStore} from "stores";
import {transformChannelToFrame} from "utilities";

const CONTOUR_REQUEST_TIMEOUT = 10_000;

interface ContourRequest {
    frame: FrameStore;
    parameters: CARTA.SetContourParameters.$Properties;
    channel: number;
    generation: number;
}

interface ActiveContourRequest extends ContourRequest {
    requestId: number;
}

export class ContourRequestStore {
    private static staticInstance: ContourRequestStore;

    static get Instance() {
        if (!ContourRequestStore.staticInstance) {
            ContourRequestStore.staticInstance = new ContourRequestStore();
        }
        return ContourRequestStore.staticInstance;
    }

    private readonly requestQueues = new Map<number, ContourRequest[]>();
    private readonly activeRequests = new Map<number, ActiveContourRequest>();
    private readonly requestGenerations = new Map<number, number>();
    private readonly channelMapRequestIds = new Set<number>();
    private readonly requestTimeouts = new Map<number, ReturnType<typeof setTimeout>>();
    private nextGeneration = 0;

    private constructor() {
        AppStore.Instance.backendService.channelMapFlowControlStream.subscribe(({eventId, flowControl}) => this.handleFlowControl(eventId, flowControl));
    }

    private getVisibleContourFrames(baseFrame: FrameStore): FrameStore[] {
        return AppStore.Instance.contourFrames.get(baseFrame) ?? [];
    }

    private buildContourParameters(frame: FrameStore): CARTA.SetContourParameters.$Properties {
        const preferenceStore = AppStore.Instance.preferenceStore;
        return {
            fileId: frame.frameInfo.fileId,
            referenceFileId: frame.frameInfo.fileId,
            smoothingMode: frame.contourConfig.smoothingMode,
            smoothingFactor: frame.contourConfig.smoothingFactor,
            levels: frame.contourConfig.levels,
            imageBounds: {
                xMin: 0,
                xMax: frame.frameInfo.fileInfoExtended.width,
                yMin: 0,
                yMax: frame.frameInfo.fileInfoExtended.height
            },
            decimationFactor: preferenceStore.contourDecimation,
            compressionLevel: preferenceStore.contourCompressionLevel,
            contourChunkSize: preferenceStore.contourChunkSize
        };
    }

    private channelsForFrame(baseFrame: FrameStore, contourFrame: FrameStore, channels: number[]): number[] {
        const frameChannels = channels.map(channel => transformChannelToFrame(baseFrame, contourFrame, channel, AppStore.Instance.spectralMatchingType));
        return [...new Set(frameChannels.filter(channel => Number.isInteger(channel) && channel >= 0 && channel < contourFrame.numChannels))];
    }

    throttledRequestContours = throttle((frame: FrameStore) => this.requestContours(frame), 100);

    reset(fileId?: number) {
        const fileIds = fileId === undefined ? new Set([...this.requestQueues.keys(), ...this.activeRequests.keys(), ...this.requestGenerations.keys()]) : [fileId];
        for (const id of fileIds) {
            this.requestQueues.delete(id);
            this.activeRequests.delete(id);
            this.requestGenerations.delete(id);
        }
    }

    requestContours(baseFrame: FrameStore) {
        const contourFrames = this.getVisibleContourFrames(baseFrame).filter(frame => frame.contourConfig.isEnabled && frame.contourConfig.levels.length);
        const isChannelMapEnabled = AppStore.Instance.channelMapStore.isChannelMapEnabled;

        if (!isChannelMapEnabled) {
            this.reset();
            for (const frame of contourFrames) {
                AppStore.Instance.backendService.setContourParameters(this.buildContourParameters(frame));
            }
            return;
        }

        const desiredFileIds = new Set(contourFrames.map(frame => frame.frameInfo.fileId));
        const trackedFileIds = new Set([...this.requestQueues.keys(), ...this.activeRequests.keys(), ...this.requestGenerations.keys()]);
        for (const fileId of trackedFileIds) {
            if (!desiredFileIds.has(fileId)) {
                this.reset(fileId);
            }
        }

        const generation = ++this.nextGeneration;
        for (const frame of contourFrames) {
            const fileId = frame.frameInfo.fileId;
            const baseParameters = this.buildContourParameters(frame);
            const channels = this.channelsForFrame(baseFrame, frame, AppStore.Instance.channelMapStore.channelArray);
            this.requestGenerations.set(fileId, generation);
            frame.contourStores.forEach(store => store.cleanupChannelsOutsideRange(channels));

            const requests = channels.map(channel => ({
                frame,
                channel,
                generation,
                parameters: {...baseParameters, channel, stokes: frame.requiredStokes}
            }));
            const activeChannelIndex = requests.findIndex(request => request.channel === frame.requiredChannel);
            if (activeChannelIndex > 0) {
                requests.unshift(requests.splice(activeChannelIndex, 1)[0]);
            }
            this.requestQueues.set(fileId, requests);
            if (!this.activeRequests.has(fileId)) {
                this.sendNext(fileId);
            }
        }
    }

    private sendNext(fileId: number) {
        if (AppStore.Instance.tileService.hasPendingChannelMapRequests()) {
            return;
        }
        const request = this.requestQueues.get(fileId)?.shift();
        if (!request) {
            this.requestQueues.delete(fileId);
            return;
        }
        const requestId = AppStore.Instance.backendService.setContourParameters(request.parameters);
        if (requestId === null) {
            this.requestQueues.delete(fileId);
            return;
        }
        this.activeRequests.set(fileId, {...request, requestId});
        this.channelMapRequestIds.add(requestId);
        this.startRequestTimeout(fileId, requestId);
    }

    private resumeQueuedRequests() {
        if (AppStore.Instance.tileService.hasPendingChannelMapRequests()) {
            return;
        }
        this.requestQueues.forEach((_requests, fileId) => {
            if (!this.activeRequests.has(fileId)) {
                this.sendNext(fileId);
            }
        });
    }

    private handleFlowControl(eventId: number, flowControl: CARTA.ChannelMapFlowControl.$Properties) {
        const fileId = flowControl.fileId;
        if (fileId === null || fileId === undefined) {
            return;
        }
        const activeRequest = this.activeRequests.get(fileId);
        if (!activeRequest || activeRequest.requestId !== eventId) {
            if (this.channelMapRequestIds.delete(eventId)) {
                this.clearRequestTimeout(eventId);
            }
            this.resumeQueuedRequests();
            return;
        }
        if (activeRequest.channel !== flowControl.completedChannel) {
            console.warn(`Contour completion mismatch for request ${eventId}: expected channel ${activeRequest.channel}, received ${flowControl.completedChannel}`);
            return;
        }
        this.channelMapRequestIds.delete(eventId);
        this.clearRequestTimeout(eventId);
        this.activeRequests.delete(fileId);
        if (flowControl.status !== CARTA.ChannelMapFlowControl.Status.COMPLETED) {
            console.warn(flowControl.message || `Contour request ${eventId} was not completed`);
            this.requestQueues.delete(fileId);
            this.requestGenerations.delete(fileId);
            return;
        }
        this.sendNext(fileId);
    }

    acceptsContourData(eventId: number, data: CARTA.ContourImageData.$Properties): boolean {
        const fileId = data.fileId;
        if (fileId == null) {
            return false;
        }
        if (!this.channelMapRequestIds.has(eventId)) {
            return !AppStore.Instance.channelMapStore.isChannelMapEnabled;
        }
        const activeRequest = this.activeRequests.get(fileId);
        return (
            AppStore.Instance.channelMapStore.isChannelMapEnabled &&
            activeRequest?.requestId === eventId &&
            activeRequest.generation === this.requestGenerations.get(fileId) &&
            activeRequest.channel === data.channel &&
            activeRequest.parameters.stokes === data.stokes
        );
    }

    private startRequestTimeout(fileId: number, requestId: number) {
        const timeout = setTimeout(() => {
            this.requestTimeouts.delete(requestId);
            this.channelMapRequestIds.delete(requestId);
            if (this.activeRequests.get(fileId)?.requestId === requestId) {
                console.warn(`Contour request ${requestId} timed out for file ${fileId}`);
                this.activeRequests.delete(fileId);
                this.requestQueues.delete(fileId);
                this.requestGenerations.delete(fileId);
            }
        }, CONTOUR_REQUEST_TIMEOUT);
        this.requestTimeouts.set(requestId, timeout);
    }

    private clearRequestTimeout(requestId: number) {
        const timeout = this.requestTimeouts.get(requestId);
        if (timeout !== undefined) {
            clearTimeout(timeout);
            this.requestTimeouts.delete(requestId);
        }
    }

    getContourProgress(baseFrame: FrameStore): number {
        const contourFrames = this.getVisibleContourFrames(baseFrame).filter(frame => frame.contourConfig.isEnabled && frame.contourConfig.levels.length);
        if (!contourFrames.length) {
            return -1;
        }

        let total = 0;
        let count = 0;
        for (const frame of contourFrames) {
            const channels = AppStore.Instance.channelMapStore.isChannelMapEnabled ? this.channelsForFrame(baseFrame, frame, AppStore.Instance.channelMapStore.channelArray) : [frame.requiredChannel];
            for (const level of frame.contourConfig.levels) {
                for (const channel of channels) {
                    total += frame.contourStores.get(level)?.progress[channel] ?? 0;
                    count++;
                }
            }
        }
        return count ? total / count : -1;
    }

    areContoursComplete(baseFrame: FrameStore): boolean {
        const progress = this.getContourProgress(baseFrame);
        return progress < 0 || progress >= 1;
    }
}
