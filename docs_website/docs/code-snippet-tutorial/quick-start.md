---
sidebar_position: 1
---

# Quick start

## Enabling code snippets

The code snippet feature can be enabled via the preference dialog:
<img
src={require("../../static/img/enable-code-snippets.png").default}
alt="Enable code snippets"
width="500"
/>

Once the code snippet feature is enabled, the "Snippet" option appears in the menu. This allows users to create and run code snippets, providing additional functionality to CARTA.

## Loading images

CARTA functions and objects can be accessed via the top-level [`app`](../../api/.-stores/class/AppStore) object (or the [`carta`](../../api/.-stores/class/AppStore) alias).

```javascript
carta.showSplashScreen();
await carta.delay(1000);
app.hideSplashScreen();
```

Images in the frontend are referred to as frames. Each frame is represented by a [`FrameStore`](../../api/.-stores/class/FrameStore) object, accessible via the array [`frames`](../../api/.-stores/class/AppStore/#frames). The currently active frame is accessible at [`activeFrame`](../../api/.-stores/class/AppStore/#activeFrame).

```javascript
console.log(app.frames);
console.log(app.activeFrame);
```

[`openFile`](../../api/.-stores/class/AppStore/#openFile) takes up to three arguments: directory, filename and HDU. If no HDU is provided, the first HDU is provided. The directory and filename can also be combined into a single argument. [`openFile`](../../api/.-stores/class/AppStore/#openFile) must be called with `await`, as it is an asynchronous function that requires communicating with the backend.

```javascript
await app.openFile("test_directory", "testfile.fits", "0");
await app.openFile("test_directory", "testfile.fits");
await app.openFile("test_directory/testfile.fits");
```

Additional images can be appended using [`appendFile`](../../api/.-stores/class/AppStore/#appendFile). The arguments are the same as [`openFile`](../../api/.-stores/class/AppStore/#openFile).

```javascript
const file1 = await app.openFile("testfile1.fits");
const file2 = await app.appendFile("testfile2.fits");
const file3 = await app.appendFile("testfile3.fits");
```

The active image can be changed with [`setActiveFrame`](../../api/.-stores/class/AppStore/#setActiveFrame), as well as the wrapper functions [`setActiveFrameById`](../../api/.-stores/class/AppStore/#setActiveFrameById) and [`setActiveFrameByIndex`](../../api/.-stores/class/AppStore/#setActiveFrameByIndex).

```javascript
app.setActiveFrameByIndex(0);
app.setActiveFrameById(file2.frameInfo.fileId);
app.setActiveFrame(file3);
```

## Closing images

[`closeCurrentFile`](../../api/.-stores/class/AppStore/#closeCurrentFile) closes the active image.

```javascript
app.closeCurrentFile();
```

[`closeFile`](../../api/.-stores/class/AppStore/#closeFile) takes an optional argument controlling whether user confirmation is required if other images are matched to the given file. This defaults to true. `await` is required to delay execution until the user confirms.

```javascript
await app.closeFile(file1);
```

[`closeOtherFiles`](../../api/.-stores/class/AppStore/#closeOtherFiles) closes all images other than the given file.

```javascript
app.closeOtherFiles(file2);
```

For all functions and objects availble in the [`app`](../../api/.-stores/class/AppStore) object, please refer to the [API documentation](../../api/.-stores/class/AppStore).
