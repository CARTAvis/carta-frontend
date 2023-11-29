"use strict";(self.webpackChunkcarta_frontend_docs=self.webpackChunkcarta_frontend_docs||[]).push([[7918,522],{355:(e,t,a)=>{a.r(t),a.d(t,{default:()=>j});var n=a(7294),l=a(833),r=a(5130);function s(){const{metadata:e,frontMatter:t,assets:a}=(0,r.k)();return n.createElement(l.d,{title:e.title,description:e.description,keywords:t.keywords,image:a.image??t.image})}var o=a(6010),c=a(7524),i=a(4966);function d(){const{metadata:e}=(0,r.k)();return n.createElement(i.default,{previous:e.previous,next:e.next})}var m=a(3120),u=a(4364),E=a(5281),h=a(5999);function p(e){let{lastUpdatedAt:t,formattedLastUpdatedAt:a}=e;return n.createElement(h.Z,{id:"theme.lastUpdated.atDate",description:"The words used to describe on which date a page has been last updated",values:{date:n.createElement("b",null,n.createElement("time",{dateTime:new Date(1e3*t).toISOString()},a))}}," on {date}")}function g(e){let{lastUpdatedBy:t}=e;return n.createElement(h.Z,{id:"theme.lastUpdated.byUser",description:"The words used to describe by who the page has been last updated",values:{user:n.createElement("b",null,t)}}," by {user}")}function v(e){let{lastUpdatedAt:t,formattedLastUpdatedAt:a,lastUpdatedBy:l}=e;return n.createElement("span",{className:E.k.common.lastUpdated},n.createElement(h.Z,{id:"theme.lastUpdated.lastUpdatedAtBy",description:"The sentence used to display when a page has been last updated, and by who",values:{atDate:t&&a?n.createElement(p,{lastUpdatedAt:t,formattedLastUpdatedAt:a}):"",byUser:l?n.createElement(g,{lastUpdatedBy:l}):""}},"Last updated{atDate}{byUser}"),!1)}var f=a(7462);const b={iconEdit:"iconEdit_Z9Sw"};function k(e){let{className:t,...a}=e;return n.createElement("svg",(0,f.Z)({fill:"currentColor",height:"20",width:"20",viewBox:"0 0 40 40",className:(0,o.Z)(b.iconEdit,t),"aria-hidden":"true"},a),n.createElement("g",null,n.createElement("path",{d:"m34.5 11.7l-3 3.1-6.3-6.3 3.1-3q0.5-0.5 1.2-0.5t1.1 0.5l3.9 3.9q0.5 0.4 0.5 1.1t-0.5 1.2z m-29.5 17.1l18.4-18.5 6.3 6.3-18.4 18.4h-6.3v-6.2z"})))}function U(e){let{editUrl:t}=e;return n.createElement("a",{href:t,target:"_blank",rel:"noreferrer noopener",className:E.k.common.editThisPage},n.createElement(k,null),n.createElement(h.Z,{id:"theme.common.editThisPage",description:"The link label to edit the current page"},"Edit this page"))}var L=a(9960);const _={tag:"tag_zVej",tagRegular:"tagRegular_sFm0",tagWithCount:"tagWithCount_h2kH"};function T(e){let{permalink:t,label:a,count:l}=e;return n.createElement(L.default,{href:t,className:(0,o.Z)(_.tag,l?_.tagWithCount:_.tagRegular)},a,l&&n.createElement("span",null,l))}const N={tags:"tags_jXut",tag:"tag_QGVx"};function w(e){let{tags:t}=e;return n.createElement(n.Fragment,null,n.createElement("b",null,n.createElement(h.Z,{id:"theme.tags.tagsListLabel",description:"The label alongside a tag list"},"Tags:")),n.createElement("ul",{className:(0,o.Z)(N.tags,"padding--none","margin-left--sm")},t.map((e=>{let{label:t,permalink:a}=e;return n.createElement("li",{key:a,className:N.tag},n.createElement(T,{label:t,permalink:a}))}))))}const Z={lastUpdated:"lastUpdated_vwxv"};function y(e){return n.createElement("div",{className:(0,o.Z)(E.k.docs.docFooterTagsRow,"row margin-bottom--sm")},n.createElement("div",{className:"col"},n.createElement(w,e)))}function A(e){let{editUrl:t,lastUpdatedAt:a,lastUpdatedBy:l,formattedLastUpdatedAt:r}=e;return n.createElement("div",{className:(0,o.Z)(E.k.docs.docFooterEditMetaRow,"row")},n.createElement("div",{className:"col"},t&&n.createElement(U,{editUrl:t})),n.createElement("div",{className:(0,o.Z)("col",Z.lastUpdated)},(a||l)&&n.createElement(v,{lastUpdatedAt:a,formattedLastUpdatedAt:r,lastUpdatedBy:l})))}function M(){const{metadata:e}=(0,r.k)(),{editUrl:t,lastUpdatedAt:a,formattedLastUpdatedAt:l,lastUpdatedBy:s,tags:c}=e,i=c.length>0,d=!!(t||a||s);return i||d?n.createElement("footer",{className:(0,o.Z)(E.k.docs.docFooter,"docusaurus-mt-lg")},i&&n.createElement(y,{tags:c}),d&&n.createElement(A,{editUrl:t,lastUpdatedAt:a,lastUpdatedBy:s,formattedLastUpdatedAt:l})):null}var C=a(9286);const V={tocMobile:"tocMobile_ITEo"};function x(){const{toc:e,frontMatter:t}=(0,r.k)();return n.createElement(C.default,{toc:e,minHeadingLevel:t.toc_min_heading_level,maxHeadingLevel:t.toc_max_heading_level,className:(0,o.Z)(E.k.docs.docTocMobile,V.tocMobile)})}var I=a(9407);function B(){const{toc:e,frontMatter:t}=(0,r.k)();return n.createElement(I.default,{toc:e,minHeadingLevel:t.toc_min_heading_level,maxHeadingLevel:t.toc_max_heading_level,className:E.k.docs.docTocDesktop})}var D=a(2503),F=a(5042);function S(e){let{children:t}=e;const a=function(){const{metadata:e,frontMatter:t,contentTitle:a}=(0,r.k)();return t.hide_title||void 0!==a?null:e.title}();return n.createElement("div",{className:(0,o.Z)(E.k.docs.docMarkdown,"markdown")},a&&n.createElement("header",null,n.createElement(D.default,{as:"h1"},a)),n.createElement(F.default,null,t))}var H=a(1310);const R={docItemContainer:"docItemContainer_Djhp",docItemCol:"docItemCol_VOVn"};function P(e){let{children:t}=e;const a=function(){const{frontMatter:e,toc:t}=(0,r.k)(),a=(0,c.i)(),l=e.hide_table_of_contents,s=!l&&t.length>0;return{hidden:l,mobile:s?n.createElement(x,null):void 0,desktop:!s||"desktop"!==a&&"ssr"!==a?void 0:n.createElement(B,null)}}();return n.createElement("div",{className:"row"},n.createElement("div",{className:(0,o.Z)("col",!a.hidden&&R.docItemCol)},n.createElement(m.Z,null),n.createElement("div",{className:R.docItemContainer},n.createElement("article",null,n.createElement(H.default,null),n.createElement(u.default,null),a.mobile,n.createElement(S,null,t),n.createElement(M,null)),n.createElement(d,null))),a.desktop&&n.createElement("div",{className:"col col--3"},a.desktop))}function j(e){const t=`docs-doc-id-${e.content.metadata.unversionedId}`,a=e.content;return n.createElement(r.b,{content:e.content},n.createElement(l.FG,{className:t},n.createElement(s,null),n.createElement(P,null,n.createElement(a,null))))}},3120:(e,t,a)=>{a.d(t,{Z:()=>g});var n=a(7294),l=a(6010),r=a(2263),s=a(9960),o=a(5999),c=a(4104),i=a(5281),d=a(373),m=a(4477);const u={unreleased:function(e){let{siteTitle:t,versionMetadata:a}=e;return n.createElement(o.Z,{id:"theme.docs.versions.unreleasedVersionLabel",description:"The label used to tell the user that he's browsing an unreleased doc version",values:{siteTitle:t,versionLabel:n.createElement("b",null,a.label)}},"This is unreleased documentation for {siteTitle} {versionLabel} version.")},unmaintained:function(e){let{siteTitle:t,versionMetadata:a}=e;return n.createElement(o.Z,{id:"theme.docs.versions.unmaintainedVersionLabel",description:"The label used to tell the user that he's browsing an unmaintained doc version",values:{siteTitle:t,versionLabel:n.createElement("b",null,a.label)}},"This is documentation for {siteTitle} {versionLabel}, which is no longer actively maintained.")}};function E(e){const t=u[e.versionMetadata.banner];return n.createElement(t,e)}function h(e){let{versionLabel:t,to:a,onClick:l}=e;return n.createElement(o.Z,{id:"theme.docs.versions.latestVersionSuggestionLabel",description:"The label used to tell the user to check the latest version",values:{versionLabel:t,latestVersionLink:n.createElement("b",null,n.createElement(s.default,{to:a,onClick:l},n.createElement(o.Z,{id:"theme.docs.versions.latestVersionLinkLabel",description:"The label used for the latest version suggestion link label"},"latest version")))}},"For up-to-date documentation, see the {latestVersionLink} ({versionLabel}).")}function p(e){let{className:t,versionMetadata:a}=e;const{siteConfig:{title:s}}=(0,r.default)(),{pluginId:o}=(0,c.useActivePlugin)({failfast:!0}),{savePreferredVersionName:m}=(0,d.J)(o),{latestDocSuggestion:u,latestVersionSuggestion:p}=(0,c.useDocVersionSuggestions)(o),g=u??(v=p).docs.find((e=>e.id===v.mainDocId));var v;return n.createElement("div",{className:(0,l.Z)(t,i.k.docs.docVersionBanner,"alert alert--warning margin-bottom--md"),role:"alert"},n.createElement("div",null,n.createElement(E,{siteTitle:s,versionMetadata:a})),n.createElement("div",{className:"margin-top--md"},n.createElement(h,{versionLabel:p.label,to:g.path,onClick:()=>m(p.name)})))}function g(e){let{className:t}=e;const a=(0,m.E)();return a.banner?n.createElement(p,{className:t,versionMetadata:a}):null}},1361:(e,t,a)=>{a.r(t),a.d(t,{default:()=>i});var n=a(7294),l=a(1862),r=a(6550),s=a(9960);const o=a(4908);function c(){const e=(0,r.TH)().pathname,t=e.match(/\/carta-frontend\/(?:api|docs)\/([^\/]+)/)?.[1]??"";let a="";return(o?.slice(1)?.includes(t)||"next"===t)&&(a="/"+t),a}const i={...l.Z,ApiLink:function(e){let{children:t,path:a}=e;return n.createElement(s.default,{to:"/api"+c()+a},t)},DocsIndexLink:function(e){let{children:t,path:a}=e;return n.createElement(s.default,{to:"/docs"+c()+"/category"+a},t)}}},4908:e=>{e.exports=["4.0.0"]}}]);