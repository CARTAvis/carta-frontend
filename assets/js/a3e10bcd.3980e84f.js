"use strict";(self.webpackChunkcarta_frontend_docs=self.webpackChunkcarta_frontend_docs||[]).push([[2168],{3905:(e,t,n)=>{n.d(t,{Zo:()=>u,kt:()=>f});var r=n(7294);function i(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function a(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);t&&(r=r.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),n.push.apply(n,r)}return n}function o(e){for(var t=1;t<arguments.length;t++){var n=null!=arguments[t]?arguments[t]:{};t%2?a(Object(n),!0).forEach((function(t){i(e,t,n[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):a(Object(n)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))}))}return e}function s(e,t){if(null==e)return{};var n,r,i=function(e,t){if(null==e)return{};var n,r,i={},a=Object.keys(e);for(r=0;r<a.length;r++)n=a[r],t.indexOf(n)>=0||(i[n]=e[n]);return i}(e,t);if(Object.getOwnPropertySymbols){var a=Object.getOwnPropertySymbols(e);for(r=0;r<a.length;r++)n=a[r],t.indexOf(n)>=0||Object.prototype.propertyIsEnumerable.call(e,n)&&(i[n]=e[n])}return i}var l=r.createContext({}),p=function(e){var t=r.useContext(l),n=t;return e&&(n="function"==typeof e?e(t):o(o({},t),e)),n},u=function(e){var t=p(e.components);return r.createElement(l.Provider,{value:t},e.children)},c="mdxType",d={inlineCode:"code",wrapper:function(e){var t=e.children;return r.createElement(r.Fragment,{},t)}},m=r.forwardRef((function(e,t){var n=e.components,i=e.mdxType,a=e.originalType,l=e.parentName,u=s(e,["components","mdxType","originalType","parentName"]),c=p(n),m=i,f=c["".concat(l,".").concat(m)]||c[m]||d[m]||a;return n?r.createElement(f,o(o({ref:t},u),{},{components:n})):r.createElement(f,o({ref:t},u))}));function f(e,t){var n=arguments,i=t&&t.mdxType;if("string"==typeof e||i){var a=n.length,o=new Array(a);o[0]=m;var s={};for(var l in t)hasOwnProperty.call(t,l)&&(s[l]=t[l]);s.originalType=e,s[c]="string"==typeof e?e:i,o[1]=s;for(var p=2;p<a;p++)o[p]=n[p];return r.createElement.apply(null,o)}return r.createElement.apply(null,n)}m.displayName="MDXCreateElement"},1766:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>l,contentTitle:()=>o,default:()=>d,frontMatter:()=>a,metadata:()=>s,toc:()=>p});var r=n(7462),i=(n(7294),n(3905));const a={sidebar_position:3},o="Unit test guidelines",s={unversionedId:"contributing/unit-test-guidelines",id:"version-4.0.0/contributing/unit-test-guidelines",title:"Unit test guidelines",description:"Guidelines for running and writing unit tests.",source:"@site/versioned_docs/version-4.0.0/contributing/unit-test-guidelines.md",sourceDirName:"contributing",slug:"/contributing/unit-test-guidelines",permalink:"/carta-frontend/docs/contributing/unit-test-guidelines",draft:!1,tags:[],version:"4.0.0",sidebarPosition:3,frontMatter:{sidebar_position:3},sidebar:"docsSidebar",previous:{title:"Github workflow",permalink:"/carta-frontend/docs/contributing/github-workflow"},next:{title:"Documentation guidelines",permalink:"/carta-frontend/docs/contributing/documentation-guidelines"}},l={},p=[{value:"Running unit tests",id:"running-unit-tests",level:2},{value:"Writing unit tests",id:"writing-unit-tests",level:2},{value:"Structures",id:"structures",level:3},{value:"Testing React components",id:"testing-react-components",level:3}],u={toc:p},c="wrapper";function d(e){let{components:t,...n}=e;return(0,i.kt)(c,(0,r.Z)({},u,n,{components:t,mdxType:"MDXLayout"}),(0,i.kt)("h1",{id:"unit-test-guidelines"},"Unit test guidelines"),(0,i.kt)("p",null,"Guidelines for running and writing unit tests."),(0,i.kt)("h2",{id:"running-unit-tests"},"Running unit tests"),(0,i.kt)("ol",null,(0,i.kt)("li",{parentName:"ol"},(0,i.kt)("p",{parentName:"li"},"Install package dependencies:"),(0,i.kt)("pre",{parentName:"li"},(0,i.kt)("code",{parentName:"pre"},"npm install\n"))),(0,i.kt)("li",{parentName:"ol"},(0,i.kt)("p",{parentName:"li"},"Build carta-protobuf and WebAssembly libraries:"),(0,i.kt)("pre",{parentName:"li"},(0,i.kt)("code",{parentName:"pre"},"npm run build-protobuf\n\nnpm run build-libs\nnpm run build-wrappers\n"))),(0,i.kt)("li",{parentName:"ol"},(0,i.kt)("p",{parentName:"li"},"Run unit tests:"),(0,i.kt)("pre",{parentName:"li"},(0,i.kt)("code",{parentName:"pre"},"npm test\n")),(0,i.kt)("p",{parentName:"li"},"By default, Jest runs tests related to changed files."),(0,i.kt)("p",{parentName:"li"},"To display individual test results, use the ",(0,i.kt)("inlineCode",{parentName:"p"},"--verbose")," flag:"),(0,i.kt)("pre",{parentName:"li"},(0,i.kt)("code",{parentName:"pre"},"npm test --verbose\n")),(0,i.kt)("p",{parentName:"li"},"For more options available in Jest, please refer to the ",(0,i.kt)("a",{parentName:"p",href:"https://jestjs.io/docs/cli"},"Jest documentation"),"."))),(0,i.kt)("h2",{id:"writing-unit-tests"},"Writing unit tests"),(0,i.kt)("h3",{id:"structures"},"Structures"),(0,i.kt)("ul",null,(0,i.kt)("li",{parentName:"ul"},(0,i.kt)("p",{parentName:"li"},"Directory structure: colocate the test file in the same directory and name with ",(0,i.kt)("inlineCode",{parentName:"p"},".test.ts/tsx")," suffix. For example,"),(0,i.kt)("pre",{parentName:"li"},(0,i.kt)("code",{parentName:"pre"},".\n\u2514\u2500\u2500 src\n\u2514\u2500\u2500 components\n    \u2514\u2500\u2500 AComponent\n    \u251c\u2500\u2500 AComponent.tsx\n    \u251c\u2500\u2500 AComponent.scss\n    \u2514\u2500\u2500 AComponent.test.tsx\n\u2514\u2500\u2500 utilities\n    \u2514\u2500\u2500 math\n    \u251c\u2500\u2500 math.ts\n    \u2514\u2500\u2500 math.test.ts\n"))),(0,i.kt)("li",{parentName:"ul"},(0,i.kt)("p",{parentName:"li"},"Test code structure: use ",(0,i.kt)("inlineCode",{parentName:"p"},"describe")," to structure the tests. For example,"),(0,i.kt)("pre",{parentName:"li"},(0,i.kt)("code",{parentName:"pre",className:"language-javascript"},'describe("[unit]", () => {\n    test("[expected behavior]", () => {});\n\n    describe("[sub unit]", () => {\n        test("[expected behavior]", () => {});\n    }\n}\n'))),(0,i.kt)("li",{parentName:"ul"},(0,i.kt)("p",{parentName:"li"},"Make sure to implement low-level tests that focus on a certain class or function. Mock imported classes and functions with Jest when necessary.")),(0,i.kt)("li",{parentName:"ul"},(0,i.kt)("p",{parentName:"li"},"TypeScript enum: import TypeScript enum without index files to avoid compile failure."))),(0,i.kt)("h3",{id:"testing-react-components"},"Testing React components"),(0,i.kt)("ul",null,(0,i.kt)("li",{parentName:"ul"},"Avoid mocking blueprint.js objects to prevent having complex setups."),(0,i.kt)("li",{parentName:"ul"},"Avoid testing snapshots to prevent having large files in the codebase."),(0,i.kt)("li",{parentName:"ul"},"Follow ",(0,i.kt)("a",{parentName:"li",href:"https://testing-library.com/docs/queries/about/#priority"},"the order of priority")," suggested by React Testing Library when querying elements.")))}d.isMDXComponent=!0}}]);