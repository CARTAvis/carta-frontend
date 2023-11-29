"use strict";(self.webpackChunkcarta_frontend_docs=self.webpackChunkcarta_frontend_docs||[]).push([[499],{3905:(e,t,n)=>{n.d(t,{Zo:()=>l,kt:()=>f});var r=n(7294);function o(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function i(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);t&&(r=r.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),n.push.apply(n,r)}return n}function a(e){for(var t=1;t<arguments.length;t++){var n=null!=arguments[t]?arguments[t]:{};t%2?i(Object(n),!0).forEach((function(t){o(e,t,n[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):i(Object(n)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))}))}return e}function p(e,t){if(null==e)return{};var n,r,o=function(e,t){if(null==e)return{};var n,r,o={},i=Object.keys(e);for(r=0;r<i.length;r++)n=i[r],t.indexOf(n)>=0||(o[n]=e[n]);return o}(e,t);if(Object.getOwnPropertySymbols){var i=Object.getOwnPropertySymbols(e);for(r=0;r<i.length;r++)n=i[r],t.indexOf(n)>=0||Object.prototype.propertyIsEnumerable.call(e,n)&&(o[n]=e[n])}return o}var c=r.createContext({}),s=function(e){var t=r.useContext(c),n=t;return e&&(n="function"==typeof e?e(t):a(a({},t),e)),n},l=function(e){var t=s(e.components);return r.createElement(c.Provider,{value:t},e.children)},m="mdxType",u={inlineCode:"code",wrapper:function(e){var t=e.children;return r.createElement(r.Fragment,{},t)}},g=r.forwardRef((function(e,t){var n=e.components,o=e.mdxType,i=e.originalType,c=e.parentName,l=p(e,["components","mdxType","originalType","parentName"]),m=s(n),g=o,f=m["".concat(c,".").concat(g)]||m[g]||u[g]||i;return n?r.createElement(f,a(a({ref:t},l),{},{components:n})):r.createElement(f,a({ref:t},l))}));function f(e,t){var n=arguments,o=t&&t.mdxType;if("string"==typeof e||o){var i=n.length,a=new Array(i);a[0]=g;var p={};for(var c in t)hasOwnProperty.call(t,c)&&(p[c]=t[c]);p.originalType=e,p[m]="string"==typeof e?e:o,a[1]=p;for(var s=2;s<i;s++)a[s]=n[s];return r.createElement.apply(null,a)}return r.createElement.apply(null,n)}g.displayName="MDXCreateElement"},7378:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>c,contentTitle:()=>a,default:()=>f,frontMatter:()=>i,metadata:()=>p,toc:()=>s});var r=n(7462),o=(n(7294),n(3905));const i={sidebar_position:7},a="Image fitting",p={unversionedId:"code-snippet-tutorial/image-fitting",id:"code-snippet-tutorial/image-fitting",title:"Image fitting",description:"The process of fitting images with multiple Gaussians can be done using code snippets.",source:"@site/docs/code-snippet-tutorial/image-fitting.mdx",sourceDirName:"code-snippet-tutorial",slug:"/code-snippet-tutorial/image-fitting",permalink:"/carta-frontend/docs/next/code-snippet-tutorial/image-fitting",draft:!1,tags:[],version:"current",sidebarPosition:7,frontMatter:{sidebar_position:7},sidebar:"docsSidebar",previous:{title:"PV images",permalink:"/carta-frontend/docs/next/code-snippet-tutorial/pv-images"},next:{title:"Contributing",permalink:"/carta-frontend/docs/next/category/contributing"}},c={},s=[],l=(m="ApiLink",function(e){return console.warn("Component "+m+" was not imported, exported, or provided by MDXProvider as global scope"),(0,o.kt)("div",e)});var m;const u={toc:s},g="wrapper";function f(e){let{components:t,...n}=e;return(0,o.kt)(g,(0,r.Z)({},u,n,{components:t,mdxType:"MDXLayout"}),(0,o.kt)("h1",{id:"image-fitting"},"Image fitting"),(0,o.kt)("p",null,"The process of fitting images with multiple Gaussians can be done using code snippets."),(0,o.kt)("p",null,"The configuration for the fitting is accessible via ",(0,o.kt)(l,{path:"/.-stores/class/ImageFittingStore",mdxType:"ApiLink"},(0,o.kt)("inlineCode",{parentName:"p"},"ImageFittingStore")),". Example code:"),(0,o.kt)("pre",null,(0,o.kt)("code",{parentName:"pre",className:"language-javascript"},'// Open an image\nconst file = await app.openFile("[filename]");\n\n// Display the fitting widget\napp.dialogStore.showFittingDialog();\n\n// Clear previous inputs of initial values\napp.imageFittingStore.clearComponents();\n\n// Set initial values\napp.imageFittingStore.setComponents(2);\n\nconst component1 = app.imageFittingStore.components[0];\ncomponent1.setCenterX(128);\ncomponent1.setCenterY(129);\ncomponent1.setAmplitude(0.01);\ncomponent1.setFwhmX(10);\ncomponent1.setFwhmY(6);\ncomponent1.setPa(36);\n\nconst component2 = app.imageFittingStore.components[1];\ncomponent2.setCenterX(135);\ncomponent2.setCenterY(135);\ncomponent2.setAmplitude(0.01);\ncomponent2.setFwhmX(4);\ncomponent2.setFwhmY(9);\ncomponent2.setPa(40);\n\n// Fit the image\napp.imageFittingStore.fitImage();\n')))}f.isMDXComponent=!0}}]);