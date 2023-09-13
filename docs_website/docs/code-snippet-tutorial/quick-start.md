---
sidebar_position: 1
---

# Quick start

## Enabling code snippets

The code snippet feature can be enabled via the preferences dialog:
<img
src={require("../assets/enable-code-snippets.png").default}
alt="Enable code snippets"
width="500"
/>

Once the code snippet feature is enabled, the "Snippets" option appears in the menu. This allows you to create and run code snippets, providing additional functionality to CARTA.

## Loading images

CARTA functions and objects can be accessed via the top-level <ApiLink path="/.-stores/class/AppStore">`app`</ApiLink> object (or the <ApiLink path="/.-stores/class/AppStore">`carta`</ApiLink> alias). In the following example, we display the welcome splash screen for 1000 ms and then close it.

```javascript
carta.showSplashScreen();
await carta.delay(1000);
app.hideSplashScreen();
```

Images loaded in the frontend are referred as and registered in the <ApiLink path="/.-stores/class/AppStore/#frames">`frames`</ApiLink> array which contains each frame (i.e., image) as a <ApiLink path="/.-stores/class/FrameStore">`FrameStore`</ApiLink> object. The currently active frame is accessible with <ApiLink path="/.-stores/class/AppStore/#activeFrame">`activeFrame`</ApiLink>. In the following example, we firstly list the frames array, then list the 0th frame, and finally list the current active frame in the console.

```javascript
console.log(app.frames);
console.log(app.frames[0]);
console.log(app.activeFrame);
```

&#8203;<ApiLink path="/.-stores/class/AppStore/#openFile">`openFile`</ApiLink> takes up to three arguments: directory, filename and HDU. If no HDU is provided, the first HDU ("0") is adopted. The directory and filename can also be combined into a single argument. <ApiLink path="/.-stores/class/AppStore/#openFile">`openFile`</ApiLink> must be called with `await`, as it is an asynchronous function that requires communicating with the backend. In the following example, in the end we will see that only the last image is loaded as each <ApiLink path="/.-stores/class/AppStore/#openFile">`openFile`</ApiLink> will close all loaded image first before loading the target image.

```javascript
await app.openFile("test_directory", "testfile.fits", "0");
await app.openFile("test_directory", "testfile.fits");
await app.openFile("test_directory/testfile.fits");
```

Additional images can be appended using <ApiLink path="/.-stores/class/AppStore/#appendFile">`appendFile`</ApiLink>. The arguments are the same as <ApiLink path="/.-stores/class/AppStore/#openFile">`openFile`</ApiLink>. In the following example, in the end there will be three images loaded.

```javascript
const file1 = await app.openFile("testfile1.fits");
const file2 = await app.appendFile("testfile2.fits");
const file3 = await app.appendFile("testfile3.fits");
```

The active image can be changed with <ApiLink path="/.-stores/class/AppStore/#setActiveFrame">`setActiveFrame`</ApiLink>, as well as the wrapper functions <ApiLink path="/.-stores/class/AppStore/#setActiveFrameById">`setActiveFrameById`</ApiLink> and <ApiLink path="/.-stores/class/AppStore/#setActiveFrameByIndex">`setActiveFrameByIndex`</ApiLink>.

```javascript
app.setActiveFrameByIndex(0);
app.setActiveFrameById(file2.frameInfo.fileId);
app.setActiveFrame(file3);
```

## Closing images

&#8203;<ApiLink path="/.-stores/class/AppStore/#closeCurrentFile">`closeCurrentFile`</ApiLink> closes the active image. There will be no user confirmation if the active image serves as the spatial reference image and there are other images matched to it.

```javascript
app.closeCurrentFile();
```

&#8203;<ApiLink path="/.-stores/class/AppStore/#closeFile">`closeFile`</ApiLink> takes an optional boolean argument to control whether user confirmation is required if other images are matched to the given file. This defaults to true. `await` is required to delay execution until the user confirms.

```javascript
await app.closeFile(file1);
app.closeFile(file1, false); // No user confirmation
```

&#8203;<ApiLink path="/.-stores/class/AppStore/#closeOtherFiles">`closeOtherFiles`</ApiLink> closes all images other than the given file.

```javascript
app.closeOtherFiles(file2);
```

For all functions and objects availble in the <ApiLink path="/.-stores/class/AppStore">`app`</ApiLink> object, please refer to the <ApiLink path="/.-stores/class/AppStore">API documentation</ApiLink>.
