/**
 * Wait for a promise inside a generator driven by mobx's flow.
 *
 * A generator cannot say what a bare `yield` gives back — every one of them would be `any`.
 * Delegating through this puts the type back at the point where the value is used.
 */
export function* awaited<T>(promise: Promise<T>): Generator<Promise<T>, T, any> {
    return (yield promise) as T;
}

/**
 * Wait for a mobx flow inside a generator driven by mobx's flow.
 *
 * A `@flow.bound` generator method keeps the type of the generator it was written as, though what
 * it hands back at runtime is a promise, so what it resolves to has to be named rather than
 * inferred. Use {@link awaited} for anything that is honestly typed as a promise.
 */
export function* awaitedFlow<T>(flowResult: unknown): Generator<Promise<T>, T, any> {
    return (yield flowResult as Promise<T>) as T;
}
