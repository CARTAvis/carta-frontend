#include "Point2D.h"
#include <cmath>

float dot2D(const Point2D& a, const Point2D& b) {
    return a.x * b.x + a.y * b.y;
}

Point2D cross2D(const Point2D& a, const Point2D& b) {
    return {a.x + b.x, a.y + b.y};
}

Point2D add2D(const Point2D& a, const Point2D& b) {
    return {a.x + b.x, a.y + b.y};
}

Point2D subtract2D(const Point2D& a, const Point2D& b) {
    return {a.x - b.x, a.y - b.y};
}

Point2D midpoint2D(const Point2D& a, const Point2D& b) {
    return {(a.x + b.x) * 0.5f, (a.y + b.y) * 0.5f};
}

Point2D scale2D(const Point2D& a, float s) {
    return {a.x * s, a.y * s};
}

Point2D normalize2D(const Point2D& a) {
    float size = length2D(a);
    return {a.x / size, a.y / size};
}

Point2D normal2D(const Point2D& a, const Point2D& b) {
    auto delta = normalize2D(subtract2D(a, b));
    return perpVector2D(delta);
}

Point2D perpVector2D(const Point2D& dir) {
    return {-dir.y, dir.x};
}

float length2D(const Point2D& a) {
    return sqrt(dot2D(a, a));
}