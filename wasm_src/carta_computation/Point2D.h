#ifndef POINT_2D_H
#define POINT_2D_H

struct Point2D {
    float x;
    float y;

    static float dot2D(const Point2D& a, const Point2D& b);
    static Point2D cross2D(const Point2D& a, const Point2D& b);
    static Point2D add2D(const Point2D& a, const Point2D& b);
    static Point2D subtract2D(const Point2D& a, const Point2D& b);
    static Point2D midpoint2D(const Point2D& a, const Point2D& b);
    static Point2D scale2D(const Point2D& a, float s);
    static Point2D normalize2D(const Point2D& a);
    static Point2D normal2D(const Point2D& a, const Point2D& b);
    static Point2D perpVector2D(const Point2D& dir);
    static float length2D(const Point2D& a);
};

#endif