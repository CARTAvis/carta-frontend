---
sidebar_position: 6
---

# PV images

The process of generating PV images can be done using code snippets.

The configuration for the generator is accessible via [`PvGeneratorWidgetStore`](/api/.-stores/class/PvGeneratorWidgetStore). Example code:

```javascript
// Open an image
const file = await app.openFile("[filename]");

// Create a line region
const region = file.regionSet.addLineRegion([{x: [start x], y: [start y]}, {x: [end x], y: [end y]}]);

// Wait for the region to be created
await app.delay(200);

// Create a pv generator widget
app.widgetsStore.createFloatingPvGeneratorWidget();

// Get the PvGeneratorWidgetStore object
const pvGeneratorWidget = app.widgetsStore.pvGeneratorWidgets.get("pv-generator-0");

// Generate a pv image
pvGeneratorWidget.setFileId(file.frameInfo.fileId);
pvGeneratorWidget.setRegionId(file.frameInfo.fileId, region.regionId);
pvGeneratorWidget.requestPV();
```
