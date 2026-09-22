import {afterEach, beforeEach, describe, expect, jest, test} from "@jest/globals";

// Imported directly: the tracker depends on nothing, and the barrel would pull in the app.
import {PendingRequestTracker} from "./PendingRequestTracker";

const TIMEOUT_MS = 1000;

describe("PendingRequestTracker", () => {
    let onFailure: jest.Mock<(key: number) => void>;
    let tracker: PendingRequestTracker<number>;

    beforeEach(() => {
        jest.useFakeTimers();
        onFailure = jest.fn();
        tracker = new PendingRequestTracker<number>({
            timeoutMs: TIMEOUT_MS,
            timeoutMessage: "timed out",
            supersededMessage: "superseded",
            onFailure
        });
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test("ends a wait when the last response has been seen", async () => {
        const outcome = tracker.start(1);
        tracker.finish(1, true);

        await expect(outcome).resolves.toEqual({success: true, message: undefined});
        expect(tracker.isPending(1)).toBe(false);
        expect(onFailure).not.toHaveBeenCalled();
    });

    test("gives up on a request that nothing answers", async () => {
        const outcome = tracker.start(1);
        jest.advanceTimersByTime(TIMEOUT_MS);

        await expect(outcome).resolves.toEqual({success: false, message: "timed out"});
        expect(onFailure).toHaveBeenCalledWith(1);
    });

    test("keeps waiting while responses are still arriving", async () => {
        const outcome = tracker.start(1);
        jest.advanceTimersByTime(TIMEOUT_MS - 1);
        tracker.noteProgress(1);
        jest.advanceTimersByTime(TIMEOUT_MS - 1);

        expect(tracker.isPending(1)).toBe(true);

        jest.advanceTimersByTime(1);
        await expect(outcome).resolves.toEqual({success: false, message: "timed out"});
    });

    test("hands a subject over to the request that asked about it last", async () => {
        const first = tracker.start(1);
        const second = tracker.start(1);

        await expect(first).resolves.toEqual({success: false, message: "superseded"});
        expect(tracker.isPending(1)).toBe(true);

        tracker.finish(1, true);
        await expect(second).resolves.toEqual({success: true, message: undefined});
    });

    test("ends a wait that a second backend request has taken over", async () => {
        const outcome = tracker.start(1);
        tracker.attach(1, 10);
        tracker.attach(1, 11);

        await expect(outcome).resolves.toEqual({success: false, message: "superseded"});
    });

    test("keeps waiting when the same request is attached twice", () => {
        tracker.start(1);
        tracker.attach(1, 10);
        tracker.attach(1, 10);

        expect(tracker.isPending(1)).toBe(true);
    });

    test("accepts responses to the request being waited on, and nothing else", () => {
        tracker.start(1);

        // Nothing has been sent yet, so anything about this subject is still worth reading.
        expect(tracker.accepts(1, 10)).toBe(true);

        tracker.attach(1, 10);
        expect(tracker.accepts(1, 10)).toBe(true);
        expect(tracker.accepts(1, 11)).toBe(false);
        // A response that names no request cannot be told apart, so it is read.
        expect(tracker.accepts(1, undefined)).toBe(true);
    });

    test("stops accepting responses to a request that has ended", () => {
        tracker.start(1);
        tracker.attach(1, 10);
        tracker.finish(1, false, "cancelled");

        expect(tracker.accepts(1, 10)).toBe(false);
        // Nothing is being waited for, so a response about something else is left alone.
        expect(tracker.accepts(1, 11)).toBe(true);
    });

    test("keeps subjects apart", async () => {
        const first = tracker.start(1);
        tracker.start(2);
        tracker.finish(1, true);

        await expect(first).resolves.toEqual({success: true, message: undefined});
        expect(tracker.isPending(2)).toBe(true);
    });

    test("ends every wait at once", async () => {
        const first = tracker.start(1);
        const second = tracker.start(2);

        tracker.failAll("connection lost");

        await expect(first).resolves.toEqual({success: false, message: "connection lost"});
        await expect(second).resolves.toEqual({success: false, message: "connection lost"});
    });

    test("has nothing to wait for when no request is in flight", async () => {
        await expect(tracker.wait(1)).resolves.toEqual({success: true});
    });

    test("stops holding request IDs back once the connection they belong to has gone", async () => {
        const pending = tracker.start(1);
        tracker.attach(1, 10);
        tracker.finish(1, true);
        expect(tracker.accepts(1, 10)).toBe(false);

        // The next connection hands out request IDs from the beginning again, so an ID from the old
        // one must not reject the answers to whatever gets that number next.
        tracker.reset("connection lost");
        await expect(pending).resolves.toEqual({success: true, message: undefined});

        expect(tracker.accepts(1, 10)).toBe(true);
    });

    test("forgets a subject that no longer exists", () => {
        tracker.start(1);
        tracker.attach(1, 10);
        tracker.finish(1, false, "closed");
        expect(tracker.accepts(1, 10)).toBe(false);

        tracker.forget(1);

        expect(tracker.accepts(1, 10)).toBe(true);
    });
});
