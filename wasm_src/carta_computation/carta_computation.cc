#include <stddef.h>
#include "Point2D.h"

extern size_t ZSTD_decompress(void* dst, size_t dstCapacity, const void* src, size_t srcSize);


union Block {
    int intValues[4];
    char byteValues[16];
};

extern "C" {

void decodeArray(char* dst, size_t dstCapacity, int decimationFactor) {
    int numIntegers = dstCapacity / 4;
    int* intArray = (int*) dst;
    float* floatArray = (float*) dst;

    float scale = 1.0 / decimationFactor;

    int blockedLength = 4 * (numIntegers / 4);
    int v = 0;

    Block block;
    
    // Un-shuffle data and convert from int to float based on decimation factor
    for (v = 0; v < blockedLength; v += 4) {
        const int i = 4 * v;
        block.byteValues[0] = dst[i];
        block.byteValues[1] = dst[i + 4];
        block.byteValues[2] = dst[i + 8];
        block.byteValues[3] = dst[i + 12];
        block.byteValues[4] = dst[i + 1];
        block.byteValues[5] = dst[i + 5];
        block.byteValues[6] = dst[i + 9];
        block.byteValues[7] = dst[i + 13];
        block.byteValues[8] = dst[i + 2];
        block.byteValues[9] = dst[i + 6];
        block.byteValues[10] = dst[i + 10];
        block.byteValues[11] = dst[i + 14];
        block.byteValues[12] = dst[i + 3];
        block.byteValues[13] = dst[i + 7];
        block.byteValues[14] = dst[i + 11];
        block.byteValues[15] = dst[i + 15];

        floatArray[v] = block.intValues[0] * scale;
        floatArray[v + 1] = block.intValues[1] * scale;
        floatArray[v + 2] = block.intValues[2] * scale;
        floatArray[v + 3] = block.intValues[3] * scale;
    }

    for (; v < numIntegers; v++) {
        floatArray[v] = intArray[v] * scale;
    }

    float lastX = 0;
    float lastY = 0;

    for (int i = 0; i < numIntegers - 1; i += 2) {
        float deltaX = floatArray[i];
        float deltaY = floatArray[i + 1];
        lastX += deltaX;
        lastY += deltaY;
        floatArray[i] = lastX;
        floatArray[i + 1] = lastY;
    }
}

}