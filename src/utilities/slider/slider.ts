const MAX_DENSE_TICK_COUNT = 10;
const TARGET_TICK_COUNT = 5;

/** Calculates label positions for a discrete zero-based slider. */
export function getDiscreteSliderTicks(count: number, includedIndex?: number): {values: number[]; step: number} {
    const lastIndex = count - 1;
    const step = count > MAX_DENSE_TICK_COUNT ? Math.floor(lastIndex / (TARGET_TICK_COUNT - 1)) : 1;
    const finalRegularTick = (TARGET_TICK_COUNT - 1) * step;
    const lastRegularTick = lastIndex - finalRegularTick < step / 2 ? lastIndex : finalRegularTick;
    const values = count > MAX_DENSE_TICK_COUNT ? [0, step, 2 * step, 3 * step, lastRegularTick] : Array.from({length: count}, (_, index) => index);
    if (count > MAX_DENSE_TICK_COUNT && lastRegularTick !== lastIndex) {
        values.push(lastIndex);
    }

    if (includedIndex !== undefined && Number.isInteger(includedIndex) && includedIndex > 0 && includedIndex < lastIndex && !values.includes(includedIndex)) {
        values.push(includedIndex);
        values.sort((a, b) => a - b);
    }

    return {values, step};
}
