/** How a tracked request ended. */
export interface RequestOutcome {
    success: boolean;
    /** Why it did not succeed. Absent when it did. */
    message?: string;
}

export interface PendingRequestTrackerOptions<TKey> {
    /** How long to wait for the next response before giving up on a request. */
    timeoutMs: number;
    /** Reported when nothing arrives within that time. */
    timeoutMessage: string;
    /** Reported when a second request for the same subject takes over from this one. */
    supersededMessage: string;
    /** Called when a request ends without succeeding, for whatever the caller has to put back. */
    onFailure?: (key: TKey) => void;
}

interface PendingRequest {
    promise: Promise<RequestOutcome>;
    /** The backend request this is waiting on, once one has been sent. */
    requestId?: number;
    resolve: (outcome: RequestOutcome) => void;
    timeout: ReturnType<typeof setTimeout>;
}

/**
 * Keeps track of requests whose answer arrives as a stream rather than as a reply.
 *
 * A streamed answer is not one message but a run of them, so there is no single point at which the
 * request is done: something has to notice the last one, notice when nothing arrives at all, and
 * notice when a later request for the same subject has taken over. That bookkeeping is the same
 * whatever is being asked for, so it lives here rather than in each store that asks.
 *
 * Requests are keyed by their subject — the catalog, image or region being loaded — because only
 * one request per subject is in flight at a time, and a caller waiting for one is waiting for that
 * subject rather than for a particular message.
 *
 * @typeParam TKey - what a request is about, as the caller identifies it.
 */
export class PendingRequestTracker<TKey> {
    private readonly pending = new Map<TKey, PendingRequest>();
    /** Requests that have ended, whose late responses are no longer wanted. */
    private readonly staleRequestIds = new Map<TKey, Set<number>>();

    constructor(private readonly options: PendingRequestTrackerOptions<TKey>) {}

    /**
     * Start waiting for an answer about one subject, taking over from whatever was waiting before.
     *
     * @returns how it ends, once it does.
     */
    public start(key: TKey): Promise<RequestOutcome> {
        this.finish(key, false, this.options.supersededMessage);

        let resolve!: (outcome: RequestOutcome) => void;
        const promise = new Promise<RequestOutcome>(resolver => {
            resolve = resolver;
        });
        this.pending.set(key, {promise, requestId: undefined, resolve, timeout: this.startTimeout(key)});
        return promise;
    }

    /** Whether an answer about one subject is still being waited for. */
    public isPending(key: TKey): boolean {
        return this.pending.has(key);
    }

    /** How the request about one subject ends, or nothing to wait for if none is in flight. */
    public wait(key: TKey): Promise<RequestOutcome> {
        return this.pending.get(key)?.promise ?? Promise.resolve({success: true});
    }

    /**
     * Say which backend request is answering for a subject.
     *
     * The first one to be sent is the one being waited on; a second means something else has asked
     * about the same subject, which the wait cannot outlive.
     */
    public attach(key: TKey, requestId: number): void {
        const pending = this.pending.get(key);
        if (!pending) {
            return;
        }
        if (pending.requestId === undefined) {
            pending.requestId = requestId;
        } else if (pending.requestId !== requestId) {
            this.finish(key, false, this.options.supersededMessage);
        }
    }

    /**
     * Whether a response should be acted on.
     *
     * A response is unwanted once its request has ended, and belongs to something else if it
     * answers a request other than the one being waited on.
     */
    public accepts(key: TKey, requestId?: number): boolean {
        if (requestId === undefined) {
            return true;
        }
        if (this.staleRequestIds.get(key)?.has(requestId)) {
            return false;
        }
        const pending = this.pending.get(key);
        return !pending || pending.requestId === undefined || pending.requestId === requestId;
    }

    /** Note that an answer is still coming, so that the wait is not given up on. */
    public noteProgress(key: TKey): void {
        const pending = this.pending.get(key);
        if (!pending) {
            return;
        }
        clearTimeout(pending.timeout);
        pending.timeout = this.startTimeout(key);
    }

    /** End the wait for one subject, if there is one. */
    public finish(key: TKey, isSuccess: boolean, message?: string): void {
        const pending = this.pending.get(key);
        if (!pending) {
            return;
        }
        clearTimeout(pending.timeout);
        this.pending.delete(key);
        if (pending.requestId !== undefined) {
            let staleRequestIds = this.staleRequestIds.get(key);
            if (!staleRequestIds) {
                staleRequestIds = new Set<number>();
                this.staleRequestIds.set(key, staleRequestIds);
            }
            staleRequestIds.add(pending.requestId);
        }
        if (!isSuccess) {
            this.options.onFailure?.(key);
        }
        pending.resolve({success: isSuccess, message});
    }

    /** End every wait, for a session that is not going to answer them. */
    public failAll(message: string): void {
        for (const key of [...this.pending.keys()]) {
            this.finish(key, false, message);
        }
    }

    /**
     * End every wait and forget every request, for a connection that has gone away.
     *
     * A request ID only means anything on the connection it was sent on: a closed connection has no
     * more responses to discard, and the next one starts counting its requests from the beginning,
     * so an ID held back as stale would otherwise reject the answers to an unrelated later request.
     */
    public reset(message: string): void {
        this.failAll(message);
        this.staleRequestIds.clear();
    }

    /** Forget a subject entirely, for one that no longer exists. */
    public forget(key: TKey): void {
        this.staleRequestIds.delete(key);
    }

    private startTimeout(key: TKey): ReturnType<typeof setTimeout> {
        return setTimeout(() => this.finish(key, false, this.options.timeoutMessage), this.options.timeoutMs);
    }
}
