---
sidebar_position: 4
---

# Regions

Actions related to regions.

## Creating regions

Regions on a specific image is accessible via [`RegionSetStore`](/api/.-stores/class/RegionSetStore) under each image. Each region is represented by a [`RegionStore`](/api/.-stores/class/RegionStore) object.

```javascript
console.log(file.regionSet.regions); // View all regions
console.log(file.regionSet.selectedRegion); // View the selected region
```

[`add...Region`](/api/.-stores/class/RegionSetStore/#addRectangularRegion) functions create regions on a specific image.

```javascript
const regionSet = file.regionSet;
const region = regionSet.addRectangularRegion({x: [center x], y: [center y]}, [width], [height]);
const region2 = regionSet.addLineRegion([{x: [start x], y: [start y]}, {x: [end x], y: [end y]}]);
```

## Changing region properties

Properties of a region can be modified using the [`RegionStore`](/api/.-stores/class/RegionStore) object.

```javascript
// ex: a rectangle region
region.setCenter({x: 0, y: 0}); // Move the region to position (0, 0)
region.setSize({x: 100, y: 100}); // Resize to 100 x 100 pixels
region.setColor("#ffffff"); // Change the color to white
```

## Importing regions

[`importRegion`](/api/.-stores/class/AppStore/#importRegion) imports regions on the active image with the provided path, filename, and [file type](https://carta-protobuf.readthedocs.io/en/latest/enums.html#filetype).

```javascript
await app.importRegion("[path]", "[filename]", 1); // File type: CRTF
```
