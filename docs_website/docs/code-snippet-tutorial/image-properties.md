---
sidebar_position: 3
---

# Image properties

Actions for modifying various properties of the image. In the following examples, we assume that an image is loaded as

```javascript
const file = await app.openFile("my_image.fits");
```

## Changing field of view

The field of view can be adjusted using various functions within <ApiLink path="/.-stores/class/FrameStore">`FrameStore`</ApiLink>.

<p><ApiLink path="/.-stores/class/FrameStore/#setCenter"><code>setCenter</code></ApiLink> and <ApiLink path="/.-stores/class/FrameStore/#setCenterWcs"><code>setCenterWcs</code></ApiLink> set the center of the image.</p>

```javascript
// image coordinate
file.setCenter([x position], [y position]);

// world coordinate
file.setCenterWcs("[x position, ex: 0:00:00.0615838925]", "[y position, ex: 29:59:59.1999990820]");
```

<p><ApiLink path="/.-stores/class/FrameStore/#fitZoom"><code>fitZoom</code></ApiLink> zooms the image to fit the widget size.</p>

```javascript
file.fitZoom();
```

<p><ApiLink path="/.-stores/class/FrameStore/#zoomToSizeX"><code>zoomToSize...</code></ApiLink> functions zoom the image to a specific scale.</p>

```javascript
// image coordinate
file.zoomToSizeX([size in x direction]);
file.zoomToSizeY([size in y direction]);

// world coordinate
file.zoomToSizeXWcs('[size in x direction, ex: 2.56"]');
file.zoomToSizeYWcs('[size in y direction, ex: 2.56"]');
```

## Changing the channel and Stokes

<p><ApiLink path="/.-stores/class/FrameStore/#setChannel"><code>setChannel</code></ApiLink> changes the channel of the image.</p>

```javascript
file.setChannel([channel]);
```

<p><ApiLink path="/.-stores/class/FrameStore/#setStokes"><code>setStokes</code></ApiLink> and <ApiLink path="/.-stores/class/FrameStore/#setStokesByIndex"><code>setStokesByIndex</code></ApiLink> change the stokes of the image using <ApiLink path="/.-models/enum/POLARIZATIONS"><code>POLARIZATIONS</code></ApiLink> enum or the index.</p>

```javascript
file.setStokes(2); // Stokes Q
file.setStokesByIndex(2); // The third polarization shown in the animator widget
```

## Changing render configuration

Render configuration can be modified using <ApiLink path="/.-stores/class/RenderConfigStore">`renderConfig`</ApiLink> within <ApiLink path="/.-stores/class/FrameStore">`FrameStore`</ApiLink>.

<p><ApiLink path="/.-stores/class/RenderConfigStore/#setCustomScale"><code>setCustomScale</code></ApiLink> and <ApiLink path="/.-stores/class/RenderConfigStore/#setPercentileRank"><code>setPercentileRank</code></ApiLink> change the rendering range.</p>

```javascript
file.renderConfig.setCustomScale([clip min], [clip max]);
file.renderConfig.setPercentileRank(90); // Change to 90%
```

<p><ApiLink path="/.-stores/class/RenderConfigStore/#setScaling"><code>setScaling</code></ApiLink> changes the scaling functions using <ApiLink path="/.-stores/enum/FrameScaling"><code>FrameScaling</code></ApiLink> enum.</p>

```javascript
file.renderConfig.setScaling(1); // Log
```

<p><ApiLink path="/.-stores/class/RenderConfigStore/#setColorMap"><code>setColorMap</code></ApiLink> changes the color map using options in <ApiLink path="/.-stores/class/RenderConfigStore/#COLOR_MAPS_ALL"><code>COLOR_MAPS_ALL</code></ApiLink> list, and <ApiLink path="/.-stores/class/RenderConfigStore/#setInverted"><code>setInverted</code></ApiLink> inverts the color map.</p>

```javascript
file.renderConfig.setColorMap("gray");
file.renderConfig.setInverted(true);
```
