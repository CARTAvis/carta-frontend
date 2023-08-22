---
sidebar_position: 5
---

# Moment images

The process of generating moment images can be done using code snippets.

The configuration for the generator is accessible via [`SpectralProfileWidgetStore`](/api/.-stores/class/SpectralProfileWidgetStore). Available moment types (as enum) can be found [here](https://carta-protobuf.readthedocs.io/en/latest/enums.html#moment). Example code:

```javascript
// Open an image
const file = await app.openFile("[filename]");

// Create a spectral profile settings widget
app.widgetsStore.createFloatingSpectralProfilerWidget();
app.widgetsStore.createFloatingSettingsWidget("", "spectral-profiler-0", "spectral-profiler");

// Get the SpectralProfileWidgetStore object
const spectralProfileWidget = app.widgetsStore.spectralProfileWidgets.get("spectral-profiler-0");

// Navigate to the moments tab
spectralProfileWidget.setSettingsTabId(3);

// Modify the configuration using SpectralProfileWidgetStore
spectralProfileWidget.clearSelectedMoments(); // remove default: integrated value of the spectrum
spectralProfileWidget.selectMoment(0); // mean value of the spectrum

// Generate a moment image
spectralProfileWidget.requestMoment();
```
