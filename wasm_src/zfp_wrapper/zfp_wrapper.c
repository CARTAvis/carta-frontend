#include <emscripten/emscripten.h>
#include "zfp.h"

int EMSCRIPTEN_KEEPALIVE zfpDecompress(int precision, float* array, int nx, int ny, unsigned char* buffer, int compressedSize) {
    int status = 0;    /* return value: 0 = success */
    zfp_type type;     /* array scalar type */
    zfp_field* field;  /* array meta data */
    zfp_stream* zfp;   /* compressed stream */
    bitstream* stream; /* bit stream to write to or read from */
    type = zfp_type_float;
    field = zfp_field_2d(array, type, nx, ny);
    zfp = zfp_stream_open(NULL);

    zfp_stream_set_precision(zfp, precision);
    stream = stream_open(buffer, compressedSize);
    zfp_stream_set_bit_stream(zfp, stream);
    zfp_stream_rewind(zfp);

    if (!zfp_decompress(zfp, field)) {
        status = 1;
    }

    zfp_field_free(field);
    zfp_stream_close(zfp);
    stream_close(stream);

    return status;
}