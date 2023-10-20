"use strict";(self.webpackChunkcarta_frontend_docs=self.webpackChunkcarta_frontend_docs||[]).push([[54],{3905:(e,t,n)=>{n.d(t,{Zo:()=>c,kt:()=>u});var i=n(7294);function r(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function a(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var i=Object.getOwnPropertySymbols(e);t&&(i=i.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),n.push.apply(n,i)}return n}function o(e){for(var t=1;t<arguments.length;t++){var n=null!=arguments[t]?arguments[t]:{};t%2?a(Object(n),!0).forEach((function(t){r(e,t,n[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):a(Object(n)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))}))}return e}function s(e,t){if(null==e)return{};var n,i,r=function(e,t){if(null==e)return{};var n,i,r={},a=Object.keys(e);for(i=0;i<a.length;i++)n=a[i],t.indexOf(n)>=0||(r[n]=e[n]);return r}(e,t);if(Object.getOwnPropertySymbols){var a=Object.getOwnPropertySymbols(e);for(i=0;i<a.length;i++)n=a[i],t.indexOf(n)>=0||Object.prototype.propertyIsEnumerable.call(e,n)&&(r[n]=e[n])}return r}var p=i.createContext({}),l=function(e){var t=i.useContext(p),n=t;return e&&(n="function"==typeof e?e(t):o(o({},t),e)),n},c=function(e){var t=l(e.components);return i.createElement(p.Provider,{value:t},e.children)},d="mdxType",m={inlineCode:"code",wrapper:function(e){var t=e.children;return i.createElement(i.Fragment,{},t)}},g=i.forwardRef((function(e,t){var n=e.components,r=e.mdxType,a=e.originalType,p=e.parentName,c=s(e,["components","mdxType","originalType","parentName"]),d=l(n),g=r,u=d["".concat(p,".").concat(g)]||d[g]||m[g]||a;return n?i.createElement(u,o(o({ref:t},c),{},{components:n})):i.createElement(u,o({ref:t},c))}));function u(e,t){var n=arguments,r=t&&t.mdxType;if("string"==typeof e||r){var a=n.length,o=new Array(a);o[0]=g;var s={};for(var p in t)hasOwnProperty.call(t,p)&&(s[p]=t[p]);s.originalType=e,s[d]="string"==typeof e?e:r,o[1]=s;for(var l=2;l<a;l++)o[l]=n[l];return i.createElement.apply(null,o)}return i.createElement.apply(null,n)}g.displayName="MDXCreateElement"},2718:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>p,contentTitle:()=>o,default:()=>u,frontMatter:()=>a,metadata:()=>s,toc:()=>l});var i=n(7462),r=(n(7294),n(3905));const a={sidebar_position:3},o="Image properties",s={unversionedId:"code-snippet-tutorial/image-properties",id:"version-4.0.0/code-snippet-tutorial/image-properties",title:"Image properties",description:"Actions for modifying various properties of the image. In the following examples, we assume that an image is loaded as",source:"@site/versioned_docs/version-4.0.0/code-snippet-tutorial/image-properties.mdx",sourceDirName:"code-snippet-tutorial",slug:"/code-snippet-tutorial/image-properties",permalink:"/carta-frontend/docs/code-snippet-tutorial/image-properties",draft:!1,tags:[],version:"4.0.0",sidebarPosition:3,frontMatter:{sidebar_position:3},sidebar:"docsSidebar",previous:{title:"Basics",permalink:"/carta-frontend/docs/code-snippet-tutorial/basics"},next:{title:"Regions",permalink:"/carta-frontend/docs/code-snippet-tutorial/regions"}},p={},l=[{value:"Changing field of view",id:"changing-field-of-view",level:2},{value:"Changing the channel and Stokes",id:"changing-the-channel-and-stokes",level:2},{value:"Changing render configuration",id:"changing-render-configuration",level:2}],c=(d="ApiLink",function(e){return console.warn("Component "+d+" was not imported, exported, or provided by MDXProvider as global scope"),(0,r.kt)("div",e)});var d;const m={toc:l},g="wrapper";function u(e){let{components:t,...n}=e;return(0,r.kt)(g,(0,i.Z)({},m,n,{components:t,mdxType:"MDXLayout"}),(0,r.kt)("h1",{id:"image-properties"},"Image properties"),(0,r.kt)("p",null,"Actions for modifying various properties of the image. In the following examples, we assume that an image is loaded as"),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-javascript"},'const file = await app.openFile("my_image.fits");\n')),(0,r.kt)("h2",{id:"changing-field-of-view"},"Changing field of view"),(0,r.kt)("p",null,"The field of view can be adjusted using various functions within ",(0,r.kt)(c,{path:"/.-stores/class/FrameStore",mdxType:"ApiLink"},(0,r.kt)("inlineCode",{parentName:"p"},"FrameStore")),"."),(0,r.kt)("p",null,"\u200b",(0,r.kt)(c,{path:"/.-stores/class/FrameStore/#setCenter",mdxType:"ApiLink"},(0,r.kt)("inlineCode",{parentName:"p"},"setCenter"))," and ",(0,r.kt)(c,{path:"/.-stores/class/FrameStore/#setCenterWcs",mdxType:"ApiLink"},(0,r.kt)("inlineCode",{parentName:"p"},"setCenterWcs"))," set the center of the image."),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-javascript"},'// image coordinate\nfile.setCenter([x position], [y position]);\n\n// world coordinate\nfile.setCenterWcs("[x position, ex: 0:00:00.0615838925]", "[y position, ex: 29:59:59.1999990820]");\n')),(0,r.kt)("p",null,"\u200b",(0,r.kt)(c,{path:"/.-stores/class/FrameStore/#fitZoom",mdxType:"ApiLink"},(0,r.kt)("inlineCode",{parentName:"p"},"fitZoom"))," zooms the image to fit the widget size."),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-javascript"},"file.fitZoom();\n")),(0,r.kt)("p",null,"\u200b",(0,r.kt)(c,{path:"/.-stores/class/FrameStore/#zoomToSizeX",mdxType:"ApiLink"},(0,r.kt)("inlineCode",{parentName:"p"},"zoomToSize..."))," functions zoom the image to a specific scale."),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-javascript"},"// image coordinate\nfile.zoomToSizeX([size in x direction]);\nfile.zoomToSizeY([size in y direction]);\n\n// world coordinate\nfile.zoomToSizeXWcs('[size in x direction, ex: 2.56\"]');\nfile.zoomToSizeYWcs('[size in y direction, ex: 2.56\"]');\n")),(0,r.kt)("h2",{id:"changing-the-channel-and-stokes"},"Changing the channel and Stokes"),(0,r.kt)("p",null,"\u200b",(0,r.kt)(c,{path:"/.-stores/class/FrameStore/#setChannel",mdxType:"ApiLink"},(0,r.kt)("inlineCode",{parentName:"p"},"setChannel"))," changes the channel of the image."),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-javascript"},"file.setChannel([channel]);\n")),(0,r.kt)("p",null,"\u200b",(0,r.kt)(c,{path:"/.-stores/class/FrameStore/#setStokes",mdxType:"ApiLink"},(0,r.kt)("inlineCode",{parentName:"p"},"setStokes"))," and ",(0,r.kt)(c,{path:"/.-stores/class/FrameStore/#setStokesByIndex",mdxType:"ApiLink"},(0,r.kt)("inlineCode",{parentName:"p"},"setStokesByIndex"))," change the stokes of the image using ",(0,r.kt)(c,{path:"/.-models/enum/POLARIZATIONS",mdxType:"ApiLink"},(0,r.kt)("inlineCode",{parentName:"p"},"POLARIZATIONS"))," enum or the index."),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-javascript"},"file.setStokes(2); // Stokes Q\nfile.setStokesByIndex(2); // The third polarization shown in the animator widget\n")),(0,r.kt)("h2",{id:"changing-render-configuration"},"Changing render configuration"),(0,r.kt)("p",null,"Render configuration can be modified using ",(0,r.kt)(c,{path:"/.-stores/class/RenderConfigStore",mdxType:"ApiLink"},(0,r.kt)("inlineCode",{parentName:"p"},"renderConfig"))," within ",(0,r.kt)(c,{path:"/.-stores/class/FrameStore",mdxType:"ApiLink"},(0,r.kt)("inlineCode",{parentName:"p"},"FrameStore")),"."),(0,r.kt)("p",null,"\u200b",(0,r.kt)(c,{path:"/.-stores/class/RenderConfigStore/#setCustomScale",mdxType:"ApiLink"},(0,r.kt)("inlineCode",{parentName:"p"},"setCustomScale"))," and ",(0,r.kt)(c,{path:"/.-stores/class/RenderConfigStore/#setPercentileRank",mdxType:"ApiLink"},(0,r.kt)("inlineCode",{parentName:"p"},"setPercentileRank"))," change the rendering range."),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-javascript"},"file.renderConfig.setCustomScale([clip min], [clip max]);\nfile.renderConfig.setPercentileRank(90); // Change to 90%\n")),(0,r.kt)("p",null,"\u200b",(0,r.kt)(c,{path:"/.-stores/class/RenderConfigStore/#setScaling",mdxType:"ApiLink"},(0,r.kt)("inlineCode",{parentName:"p"},"setScaling"))," changes the scaling functions using ",(0,r.kt)(c,{path:"/.-stores/enum/FrameScaling",mdxType:"ApiLink"},(0,r.kt)("inlineCode",{parentName:"p"},"FrameScaling"))," enum."),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-javascript"},"file.renderConfig.setScaling(1); // Log\n")),(0,r.kt)("p",null,"\u200b",(0,r.kt)(c,{path:"/.-stores/class/RenderConfigStore/#setColorMap",mdxType:"ApiLink"},(0,r.kt)("inlineCode",{parentName:"p"},"setColorMap"))," changes the color map using options in ",(0,r.kt)(c,{path:"/.-stores/class/RenderConfigStore/#COLOR_MAPS_ALL",mdxType:"ApiLink"},(0,r.kt)("inlineCode",{parentName:"p"},"COLOR_MAPS_ALL"))," list, and ",(0,r.kt)(c,{path:"/.-stores/class/RenderConfigStore/#setInverted",mdxType:"ApiLink"},(0,r.kt)("inlineCode",{parentName:"p"},"setInverted"))," inverts the color map."),(0,r.kt)("pre",null,(0,r.kt)("code",{parentName:"pre",className:"language-javascript"},'file.renderConfig.setColorMap("gray");\nfile.renderConfig.setInverted(true);\n')))}u.isMDXComponent=!0}}]);