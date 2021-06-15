import React from "react";

export const TemplateNodes = {
    WebGLErrorMessage: (
        <React.Fragment>
            <p>
                <b>Could not load WebGL. Images will not be displayed properly.</b>
            </p>
            <p>
                <small> If you are using CARTA through a browser, please ensure your browser supports WebGL. If you are using the CARTA standalone app, please ensure you are not running in a remote desktop. </small>
            </p>
        </React.Fragment>
    ),
    WebGL2ErrorMessage: (
        <div>
            <div>
                <p>Could not load WebGL2.0. The catalog overlay feature will not be available.</p>
            </div>
            <div>
                <small> If you are using CARTA with Safari, please ensure WebGL2.0 is enabled at Develop &gt; Experimental Features &gt; WebGL2.0 then reload the page.</small>
            </div>
        </div>
    )
};
