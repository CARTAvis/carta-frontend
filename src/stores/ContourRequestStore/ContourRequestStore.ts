import {CARTA} from "carta-protobuf";
import {throttle} from "lodash";

import {AppStore, type FrameStore} from "stores";
import {transformChannelToFrame} from "utilities";

interface ContourRequest {
    frame: FrameStore;
    parameters: CARTA.SetContourParameters.$Properties;
    channel: number;
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
    private readonly requestedChannels = new Map<number, Set<number>>();
    private readonly requestedStokes = new Map<number, number>();

    private constructor() {
        AppStore.Instance.backendService.channelMapFlowControlStream.subscribe(({eventId, flowControl}) => this.handleFlowControl(eventId, flowControl));
    }

    private getVisibleContourFrames(baseFrame: FrameStore): FrameStore[] {
        return AppStore.Instance.contourFrames.get(baseFrame) ?? [];
    }

    hasVisibleContours(baseFrame: FrameStore | null): boolean {
        return !!baseFrame && this.getVisibleContourFrames(baseFrame).length > 0;
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

    requestContours(baseFrame: FrameStore) {
        const contourFrames = this.getVisibleContourFrames(baseFrame).filter(frame => frame.contourConfig.isEnabled && frame.contourConfig.levels.length);
        const isChannelMapEnabled = AppStore.Instance.channelMapStore.isChannelMapEnabled;

        for (const frame of contourFrames) {
            const fileId = frame.frameInfo.fileId;
            const baseParameters = this.buildContourParameters(frame);
            if (!isChannelMapEnabled) {
                this.requestQueues.delete(fileId);
                this.requestedChannels.delete(fileId);
                this.requestedStokes.delete(fileId);
                AppStore.Instance.backendService.setContourParameters(baseParameters);
                continue;
            }

            const channels = this.channelsForFrame(baseFrame, frame, AppStore.Instance.channelMapStore.channelArray);
            this.requestedChannels.set(fileId, new Set(channels));
            this.requestedStokes.set(fileId, frame.requiredStokes);
            frame.contourStores.forEach(store => store.cleanupChannelsOutsideRange(channels));

            const requests = channels.map(channel => ({
                frame,
                channel,
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
        if (!activeRequest || activeRequest.requestId !== eventId || activeRequest.channel !== flowControl.completedChannel) {
            this.resumeQueuedRequests();
            return;
        }
        this.activeRequests.delete(fileId);
        if (flowControl.status !== CARTA.ChannelMapFlowControl.Status.COMPLETED) {
            console.warn(flowControl.message || `Contour request ${eventId} was not completed`);
        }
        this.sendNext(fileId);
    }

    acceptsContourData(data: CARTA.ContourImageData.$Properties): boolean {
        if (!AppStore.Instance.channelMapStore.isChannelMapEnabled) {
            return true;
        }
        const fileId = data.fileId;
        const channel = data.channel;
        return fileId != null && channel != null && this.requestedChannels.get(fileId)?.has(channel) === true && this.requestedStokes.get(fileId) === data.stokes;
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
