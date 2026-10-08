import {PlotType} from "enums";

import {PlotTypeSelectorComponent} from "./PlotTypeSelectorComponent";

test("[unit] plot style toggles points and mutually exclusive line types", () => {
    const onValueChanged = jest.fn();
    const selector = new PlotTypeSelectorComponent({value: PlotType.POINTS, onValueChanged, toggleStyle: true});

    (selector as any).handleToggle(PlotType.STEPS);
    expect(onValueChanged).toHaveBeenLastCalledWith(PlotType.POINTS_AND_STEPS);

    (selector as any).props = {...selector.props, value: PlotType.POINTS_AND_STEPS};
    (selector as any).handleToggle(PlotType.LINES);
    expect(onValueChanged).toHaveBeenLastCalledWith(PlotType.POINTS_AND_LINES);

    (selector as any).props = {...selector.props, value: PlotType.POINTS_AND_LINES};
    (selector as any).handleToggle(PlotType.LINES);
    expect(onValueChanged).toHaveBeenLastCalledWith(PlotType.POINTS);

    (selector as any).props = {...selector.props, value: PlotType.POINTS};
    (selector as any).handleToggle(PlotType.POINTS);
    expect(onValueChanged).toHaveBeenCalledTimes(3);
    expect(onValueChanged).toHaveBeenLastCalledWith(PlotType.POINTS);
});
