import {PlayMode} from "enums";

export type PlaybackDirection = -1 | 1;

export interface PlaybackState {
    index: number;
    direction: PlaybackDirection;
}

/** Calculates the next state for frontend-driven playback. */
export function getNextPlaybackState(currentIndex: number, count: number, step: number, playMode: PlayMode, direction: PlaybackDirection): PlaybackState {
    if (count <= 0) {
        return {index: -1, direction};
    }
    if (count === 1) {
        return {index: 0, direction: 1};
    }

    const normalizedStep = Math.max(1, Math.trunc(Math.abs(step)));
    const lastIndex = count - 1;
    if (currentIndex < 0 || currentIndex >= count) {
        return {index: playMode === PlayMode.BACKWARD ? lastIndex : 0, direction: 1};
    }

    switch (playMode) {
        case PlayMode.BACKWARD:
            return {index: (currentIndex - (normalizedStep % count) + count) % count, direction};
        case PlayMode.BOUNCING: {
            const period = 2 * lastIndex;
            const phase = direction > 0 ? currentIndex : period - currentIndex;
            const nextPhase = (phase + normalizedStep) % period;
            const nextIndex = nextPhase <= lastIndex ? nextPhase : period - nextPhase;
            const nextDirection: PlaybackDirection = nextPhase === 0 || nextPhase < lastIndex ? 1 : -1;
            return {index: nextIndex, direction: nextDirection};
        }
        case PlayMode.BLINK:
            return {index: currentIndex === 0 ? lastIndex : 0, direction};
        case PlayMode.FORWARD:
        default:
            return {index: (currentIndex + normalizedStep) % count, direction};
    }
}
