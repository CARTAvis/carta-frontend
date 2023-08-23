---
sidebar_position: 7
---

# Image fitting

The process of fitting images with multiple Gaussians can be done using code snippets.

The configuration for the fitting is accessible via [`ImageFittingStore`](/api/.-stores/class/ImageFittingStore). Example code:

```javascript
// Open an image
const file = await app.openFile("[filename]");

// Display the fitting widget
app.dialogStore.showFittingDialog();

// Clear previous inputs of initial values
app.imageFittingStore.clearComponents();

// Set initial values
app.imageFittingStore.setComponents(2);

const component1 = app.imageFittingStore.components[0];
component1.setCenterX(128);
component1.setCenterY(129);
component1.setAmplitude(0.01);
component1.setFwhmX(10);
component1.setFwhmY(6);
component1.setPa(36);

const component2 = app.imageFittingStore.components[1];
component2.setCenterX(135);
component2.setCenterY(135);
component2.setAmplitude(0.01);
component2.setFwhmX(4);
component2.setFwhmY(9);
component2.setPa(40);

// Fit the image
app.imageFittingStore.fitImage();
```
