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
/** The ICD reserves this request ID for streams that answer no request of ours. */
const UNSOLICITED_REQUEST_ID = 0;

export class PendingRequestTracker<TKey> {
    private readonly pending = new Map<TKey, PendingRequest>();
    /**
     * The request each subject is currently being answered by, whether or not anyone is waiting.
     *
     * Kept apart from {@link pending} because the two questions are different: only some callers
     * wait for an answer, but every response has to be checked against the request that is actually
     * the current one, or a superseded request's rows overwrite the ones that replaced them.
     */
    private readonly latestRequestIds = new Map<TKey, number>();
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
        this.latestRequestIds.set(key, requestId);

        const pending = this.pending.get(key);
        if (!pending) {
            return;
        }
        if (pending.requestId === undefined) {
            pending.requestId = requestId;
        } else if (pending.requestId !== requestId) {
            // Only the wait ends. The subject is still being answered — by the request that has
            // just taken over, which is the one latestRequestIds was set to above.
            this.endPending(key, false, this.options.supersededMessage);
        }
    }

    /**
     * Whether a response should be acted on.
     *
     * A response is unwanted once its request has ended, and belongs to something else if it
     * answers a request other than the one being waited on.
     */
    public accepts(key: TKey, requestId?: number): boolean {
        if (requestId === undefined || requestId === UNSOLICITED_REQUEST_ID) {
            return true;
        }
        if (this.staleRequestIds.get(key)?.has(requestId)) {
            return false;
        }
        return this.latestRequestIds.get(key) === requestId;
    }

    /**
     * End the wait for a subject because the request answering it has run to completion.
     *
     * Told which request finished, unlike {@link finish}, so that a stream belonging to no request
     * of ours, or to one that has already been superseded, does not end the one still going.
     */
    public complete(key: TKey, requestId?: number): void {
        const latestRequestId = this.latestRequestIds.get(key);
        if (requestId === UNSOLICITED_REQUEST_ID && latestRequestId !== undefined) {
            return;
        }
        if (requestId !== undefined && requestId !== UNSOLICITED_REQUEST_ID && latestRequestId !== undefined && latestRequestId !== requestId) {
            return;
        }
        this.finish(key, true);
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
        // The subject is no longer being answered by anything, whether or not anyone was waiting:
        // a response arriving after this belongs to a request that has had its turn.
        this.latestRequestIds.delete(key);
        this.endPending(key, isSuccess, message);
    }

    /** End the wait alone, leaving it to the caller to say what is answering the subject now. */
    private endPending(key: TKey, isSuccess: boolean, message?: string): void {
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
        this.latestRequestIds.clear();
        this.staleRequestIds.clear();
    }

    /** Forget a subject entirely, for one that no longer exists. */
    public forget(key: TKey): void {
        this.latestRequestIds.delete(key);
        this.staleRequestIds.delete(key);
    }

    private startTimeout(key: TKey): ReturnType<typeof setTimeout> {
        return setTimeout(() => this.finish(key, false, this.options.timeoutMessage), this.options.timeoutMs);
    }
}
