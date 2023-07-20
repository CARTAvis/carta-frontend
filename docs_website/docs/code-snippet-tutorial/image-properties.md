---
sidebar_position: 3
---

# Image properties

Actions for modifying various properties of the image.

## Changing field of view

The field of view can be adjusted using various functions within [`FrameStore`](/api/.-stores/class/FrameStore).

[`setCenter`](/api/.-stores/class/FrameStore/#setCenter) and [`setCenterWcs`](/api/.-stores/class/FrameStore/#setCenterWcs) set the center of the image.

```javascript
// image coordinate
file.setCenter([x position], [y position]);

// world coordinate
file.setCenterWcs("[x position, ex: 0:00:00.0615838925]", "[y position, ex: 29:59:59.1999990820]");
```

[`fitZoom`](/api/.-stores/class/FrameStore/#fitZoom) zooms the image to fit the widget size.

```javascript
file.fitZoom();
```

[`zoomToSize...`](/api/.-stores/class/FrameStore/#zoomToSizeX) functions zoom the image to a specific scale.

```javascript
// image coordinate
file.zoomToSizeX([size in x direction]);
file.zoomToSizeY([size in y direction]);

// world coordinate
file.zoomToSizeXWcs('[size in x direction, ex: 2.56"]');
file.zoomToSizeYWcs('[size in y direction, ex: 2.56"]');
```

## Changing the channel and stokes

[`setChannel`](/api/.-stores/class/FrameStore/#setChannel) changes the channel of the image.

```javascript
file.setChannel([channel]);
```

[`setStokes`](/api/.-stores/class/FrameStore/#setStokes) and [`setStokesByIndex`](/api/.-stores/class/FrameStore/#setStokesByIndex) change the stokes of the image using [`POLARIZATIONS`](/api/.-models/enum/POLARIZATIONS) or the index.

```javascript
file.setStokes(2); // Stokes Q
file.setStokesByIndex(2); // The third polarization shown in the animator widget
```

## Changing render configuration

Render configuration can be modified using [`renderConfig`](/api/.-stores/class/RenderConfigStore) within [`FrameStore`](/api/.-stores/class/FrameStore).

[`setCustomScale`](/api/.-stores/class/RenderConfigStore/#setCustomScale) and [`setPercentileRank`](/api/.-stores/class/RenderConfigStore/#setPercentileRank) change the rendering range.

```javascript
file.renderConfig.setCustomScale([clip min], [clip max]);
file.renderConfig.setPercentileRank(90); // Change to 90%
```

[`setScaling`](/api/.-stores/class/RenderConfigStore/#setScaling) changes the scaling functions using [`FrameScaling`](/api/.-stores/enum/FrameScaling).

```javascript
file.renderConfig.setScaling(1); // Log
```

[`setColorMap`](/api/.-stores/class/RenderConfigStore/#setColorMap) changes the color map using options in [`COLOR_MAPS_ALL`](/api/.-stores/class/RenderConfigStore/#COLOR_MAPS_ALL), and [`setInverted`](/api/.-stores/class/RenderConfigStore/#setInverted) inverts the color map.

```javascript
file.renderConfig.setColorMap("gray");
file.renderConfig.setInverted(true);
```
