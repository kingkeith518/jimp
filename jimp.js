var FS = require("fs");
var PNG = require("node-png").PNG;
var JPEG = require("jpeg-js");
var MIME = require("mime");
var Resize = require("./resize.js");
var StreamToBuffer = require('stream-to-buffer');

// logging methods

var chars = 0;

function log(msg) {
    clear();
    process.stdout.write(msg);
    chars = msg.length;
}

function clear() {
    while (chars-- > 0) {
        process.stdout.write("\b");
    }
}

process.on("exit", clear);

// error checking methods

function isNodePattern(cb) {
    if ("undefined" == typeof cb) return false;
    if ("function" != typeof cb)
        throw new Error("Callback must be a function");
    return true;
}

function throwError(error, cb) {
    if ("string" == typeof error) error = new Error(error);
    if ("function" == typeof cb) cb.call(this, error);
    else throw error;
}

/**
 * Jimp constructor
 * @param path a path to the image
 * @param (optional) cb a function to call when the image is parsed to a bitmap
 */

/**
 * Jimp constructor
 * @param data a Buffer containing the image data
 * @param mime the mime type of the image
 * @param (optional) cb a function to call when the image is parsed to a bitmap
 */

function Jimp() {
    if ("string" == typeof arguments[0]) {
        var path = arguments[0];
        var mime = MIME.lookup(path);
        var cb = arguments[1];
        
        if ("undefined" == typeof cb) cb = function () {};
        if ("function" != typeof cb)
            throwError.call(this, "cb must be a function", cb);
        
        var that = this;
        FS.readFile(path, function (err, data) {
            if (err) throwError.call(that, err, cb);
            parseBitmap.call(that, data, mime, cb);
        });
    } else {
        var data = arguments[0];
        var mime = arguments[1];
        var cb = arguments[2];
        
        if (Buffer != data.constructor)
            throwError.call(this, "data must be a Buffer", cb);
        if ("string" != typeof mime)
            throwError.call(this, "mime must be a string", cb);
        if ("undefined" == typeof cb) cb = function () {};
        if ("function" != typeof cb)
            throwError.call(this, "cb must be a function", cb);
        
        parseBitmap.call(this, data, mime, cb);
    }
}

// supported mime types
Jimp.MIME_PNG = "image/png";
Jimp.MIME_JPEG = "image/jpeg";

// parses a bitmap from the constructor to the JIMP bitmap property
function parseBitmap(data, mime, cb) {
    var that = this;
    switch (mime.toLowerCase()) {
        case Jimp.MIME_PNG:
            var png = new PNG();
            png.parse(data, function(err, data) {
                if (err) throwError.call(that, err, cb);
                that.bitmap.data = new Buffer(data.data);
                that.bitmap.width = data.width;
                that.bitmap.height = data.height;
                cb.call(that, null, this);
            });
            break;
        case Jimp.MIME_JPEG:
            that.bitmap = JPEG.decode(data);
            cb.call(that, null, this);
            break;
        default:
            throwError.call(this, "Unsupported MIME type: " + mime, cb);
    }
}

// An object representing a bitmap in memory, comprising:
//  - data: a buffer of the bitmap data
//  - width: the width of the image in pixels
//  - height: the height of the image in pixels
Jimp.prototype.bitmap = {
    data: null,
    width: null,
    height: null
};

// The quality to be used when saving JPEG images
Jimp.prototype._quality = 100;

/**
 * Sets the quality of the image when saving as JPEG format
 * @param n The quality to use 0-100
 * @param cb A callback for when complete
 * @returns this for chaining of methods
 */
Jimp.prototype.quality = function (n, cb) {
    if ("number" != typeof n)
        throwError.call(this, "n must be a number", cb);
    if (n < 0 || n > 100)
        throwError.call(this, "n must be a number 0 - 100", cb);
    
    this._quality = n;
    
    if (isNodePattern(cb)) cb.call(this, null, this);
    else return this;
};

/**
 * Scanes through a region of the bitmap, calling a function for each pixel.
 * @param x the x coordinate to begin the scan at
 * @param y the y coordiante to begin the scan at
 * @param w the width of the scan region
 * @param h the height of the scan region
 * @param f a function to call on even pixel; the (x, y) position of the pixel
 * and the index of the pixel in the bitmap buffer are passed to the function
 * @param cb A callback for when complete
 * @returns this for chaining of methods
 */
Jimp.prototype.scan = function (x, y, w, h, f, cb) {
    if ("number" != typeof x || "number" != typeof y)
        throwError.call(this, "x and y must be numbers", cb);
    if ("number" != typeof w || "number" != typeof h)
        throwError.call(this, "w and h must be numbers", cb);
    if ("function" != typeof f)
        throwError.call(this, "f must be a function", cb);
    
    for (var _y = y; _y < (y + h); _y++) {
        for (var _x = x; _x < (x + w); _x++) {
            var idx = (this.bitmap.width * _y + _x) << 2;
            f.call(this, _x, _y, idx);
        }
    }
    
    if (isNodePattern(cb)) cb.call(this, null, this);
    else return this;
};

/**
 * Returns the pixel index in the bitmap
 * @param x the x coordinate
 * @param y the y coordinate
 * @param cb A callback for when complete
 * @returns the index of the pixel
*/
Jimp.prototype.getPixelIndex = function (x, y, cb) {
    if ("number" != typeof x || "number" != typeof y)
        throwError.call(this, "x and y must be numbers", cb);
    
    var i = (this.bitmap.width * y + x) << 2;
    
    if (isNodePattern(cb)) cb.call(this, null, i);
    else return i;
};

/**
 * Crops the image at a given point to a give size
 * @param x the x coordinate to crop form
 * @param y the y coordiante to crop form
 * @param w the width of the crop region
 * @param h the height of the crop region
 * @param cb A callback for when complete
 * @returns this for chaining of methods
 */
Jimp.prototype.crop = function (x, y, w, h, cb) {
    if ("number" != typeof x || "number" != typeof y)
        throwError.call(this, "x and y must be numbers", cb);
    if ("number" != typeof w || "number" != typeof h)
        throwError.call(this, "w and h must be numbers", cb);

    var bitmap = [];
    this.scan(x, y, w, h, function (x, y, idx) {
        bitmap.push(this.bitmap.data[idx]);
        bitmap.push(this.bitmap.data[idx+1]);
        bitmap.push(this.bitmap.data[idx+2]);
        bitmap.push(this.bitmap.data[idx+3]);
    });
    
    this.bitmap.data = new Buffer(bitmap);
    this.bitmap.width = w;
    this.bitmap.height = h;
    
    if (isNodePattern(cb)) cb.call(this, null, this);
    else return this;
};

/**
 * Copies rectangle of pixels from current image to dst
 * @param dst destination Jimp instance
 * @param sx source x
 * @param sy source y
 * @param w width
 * @param h height
 * @param dx destination x
 * @param dy destination y
 * @param cb A callback for when complete
 * @returns this for chaining of methods
*/
Jimp.prototype.blit = function (dst, sx, sy, w, h, dx, dy, cb) {
    this.scan(sx, sy, w, h, function(x, y, idx) {
        var dstIdx = dst.getPixelIndex(dx+x-sx, dy+y-sy)
        dst.bitmap.data[dstIdx] = this.bitmap.data[idx];
        dst.bitmap.data[dstIdx+1] = this.bitmap.data[idx+1];
        dst.bitmap.data[dstIdx+2] = this.bitmap.data[idx+2];
    });
    
    if (isNodePattern(cb)) cb.call(this, null, this);
    else return this;
};

/**
 * Inverts the image
 * @param cb A callback for when complete
 * @returns this for chaining of methods
 */
Jimp.prototype.invert = function (cb) {
    this.scan(0, 0, this.bitmap.width, this.bitmap.height, function (x, y, idx) {
        this.bitmap.data[idx] = 255 - this.bitmap.data[idx];
        this.bitmap.data[idx+1] = 255 - this.bitmap.data[idx+1];
        this.bitmap.data[idx+2] = 255 - this.bitmap.data[idx+2];
    });
    
    if (isNodePattern(cb)) cb.call(this, null, this);
    else return this;
};

/**
 * Flip the image horizontally
 * @param horizontal a Boolean, if true the image will be flipped horizontally
 * @param vertical a Boolean, if true the image will be flipped vertically
 * @param cb A callback for when complete
 * @returns this for chaining of methods
 */
Jimp.prototype.flip = function (horizontal, vertical, cb) {
    var bitmap = [];
    this.scan(0, 0, this.bitmap.width, this.bitmap.height, function (x, y, idx) {
        var _x = (horizontal) ? (this.bitmap.width - x) : x;
        var _y = (vertical) ? (this.bitmap.height - y) : y;
        var _idx = (this.bitmap.width * _y + _x) << 2;
        
        bitmap.push(this.bitmap.data[_idx]);
        bitmap.push(this.bitmap.data[_idx+1]);
        bitmap.push(this.bitmap.data[_idx+2]);
        bitmap.push(this.bitmap.data[_idx+3]);
    });
    
    this.bitmap.data = new Buffer(bitmap);
    
    if (isNodePattern(cb)) cb.call(this, null, this);
    else return this;
};

/**
 * Applies a true Gaussian blur to the image (warning: this is VERY slow)
 * @param r the pixel radius of the blur
 * @param cb A callback for when complete
 * @returns this for chaining of methods
 */
Jimp.prototype.gaussian = function (r, cb) {
    // http://blog.ivank.net/fastest-gaussian-blur.html
    if ("number" != typeof r)
        throwError.call(this, "r must be a number", cb);
    if (r < 1)
        throwError.call(this, "r must be greater than 0", cb);
    
    var rs = Math.ceil(r * 2.57); // significant radius
    
    for (var y = 0; y < this.bitmap.height; y++) {
        log("Gaussian: " + Math.round(y / this.bitmap.height * 100) + "%");
        for (var x = 0; x < this.bitmap.width; x++) {
            var red = 0;
            var green = 0;
            var blue = 0;
            var alpha = 0;
            var wsum = 0;
            for (var iy = y - rs; iy < y + rs + 1; iy++) {
                for (var ix = x - rs; ix < x + rs + 1; ix++) {
                    var x1 = Math.min(this.bitmap.width - 1, Math.max(0, ix));
                    var y1 = Math.min(this.bitmap.height - 1, Math.max(0, iy));
                    var dsq = (ix - x) * (ix - x) + (iy - y) * (iy - y);
                    var wght = Math.exp( -dsq / (2*r*r) ) / (Math.PI*2*r*r);
                    var idx = (y1 * this.bitmap.width + x1) << 2;
                    red += this.bitmap.data[idx] * wght;
                    green += this.bitmap.data[idx+1] * wght;
                    blue += this.bitmap.data[idx+2] * wght;
                    alpha += this.bitmap.data[idx+3] * wght;
                    wsum += wght;
                }
                var idx = (y * this.bitmap.width + x) << 2;
                this.bitmap.data[idx] = Math.round( red / wsum);
                this.bitmap.data[idx+1] = Math.round( green / wsum);
                this.bitmap.data[idx+2] = Math.round( blue / wsum);
                this.bitmap.data[idx+3] = Math.round( alpha / wsum);
            }
        }
    }
    
    if (isNodePattern(cb)) cb.call(this, null, this);
    else return this;
};

/*
    Superfast Blur (0.5)
    http://www.quasimondo.com/BoxBlurForCanvas/FastBlur.js

    Copyright (c) 2011 Mario Klingemann

    Permission is hereby granted, free of charge, to any person
    obtaining a copy of this software and associated documentation
    files (the "Software"), to deal in the Software without
    restriction, including without limitation the rights to use,
    copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the
    Software is furnished to do so, subject to the following
    conditions:

    The above copyright notice and this permission notice shall be
    included in all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
    EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
    OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
    NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
    HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
    WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
    FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
    OTHER DEALINGS IN THE SOFTWARE.
*/

var mul_table = [1,57,41,21,203,34,97,73,227,91,149,62,105,45,39,137,241,107,3,173,39,71,65,238,219,101,187,87,81,151,141,133,249,117,221,209,197,187,177,169,5,153,73,139,133,127,243,233,223,107,103,99,191,23,177,171,165,159,77,149,9,139,135,131,253,245,119,231,224,109,211,103,25,195,189,23,45,175,171,83,81,79,155,151,147,9,141,137,67,131,129,251,123,30,235,115,113,221,217,53,13,51,50,49,193,189,185,91,179,175,43,169,83,163,5,79,155,19,75,147,145,143,35,69,17,67,33,65,255,251,247,243,239,59,29,229,113,111,219,27,213,105,207,51,201,199,49,193,191,47,93,183,181,179,11,87,43,85,167,165,163,161,159,157,155,77,19,75,37,73,145,143,141,35,138,137,135,67,33,131,129,255,63,250,247,61,121,239,237,117,29,229,227,225,111,55,109,216,213,211,209,207,205,203,201,199,197,195,193,48,190,47,93,185,183,181,179,178,176,175,173,171,85,21,167,165,41,163,161,5,79,157,78,154,153,19,75,149,74,147,73,144,143,71,141,140,139,137,17,135,134,133,66,131,65,129,1];
        
var shg_table = [0,9,10,10,14,12,14,14,16,15,16,15,16,15,15,17,18,17,12,18,16,17,17,19,19,18,19,18,18,19,19,19,20,19,20,20,20,20,20,20,15,20,19,20,20,20,21,21,21,20,20,20,21,18,21,21,21,21,20,21,17,21,21,21,22,22,21,22,22,21,22,21,19,22,22,19,20,22,22,21,21,21,22,22,22,18,22,22,21,22,22,23,22,20,23,22,22,23,23,21,19,21,21,21,23,23,23,22,23,23,21,23,22,23,18,22,23,20,22,23,23,23,21,22,20,22,21,22,24,24,24,24,24,22,21,24,23,23,24,21,24,23,24,22,24,24,22,24,24,22,23,24,24,24,20,23,22,23,24,24,24,24,24,24,24,23,21,23,22,23,24,24,24,22,24,24,24,23,22,24,24,25,23,25,25,23,24,25,25,24,22,25,25,25,24,23,24,25,25,25,25,25,25,25,25,25,25,25,25,23,25,23,24,25,25,25,25,25,25,25,25,25,24,22,25,25,23,25,25,20,24,25,24,25,25,22,24,25,24,25,24,25,25,24,25,25,25,25,22,25,25,25,24,25,24,25,18];

/**
 * A fast blur algorithm that produces similar effect to a Gausian blur - but MUCH quicker
 * @param r the pixel radius of the blur
 * @param cb A callback for when complete
 * @returns this for chaining of methods
 */
Jimp.prototype.blur = function (r, cb) {
    if ("number" != typeof r)
        throwError.call(this, "r must be a number", cb);
    if (r < 1)
        throwError.call(this, "r must be greater than 0", cb);
    
    var rsum, gsum, bsum, asum, x, y, i, p, p1, p2, yp, yi, yw, idx, pa;
    var wm = this.bitmap.width - 1;
    var hm = this.bitmap.height - 1;
    var wh = this.bitmap.width * this.bitmap.height;
    var rad1 = r + 1;

    var mul_sum = mul_table[r];
    var shg_sum = shg_table[r];

    var red = [];
    var green = [];
    var blue = [];
    var alpha = [];

    var vmin = [];
    var vmax = [];

    var iterations = 2;
    while (iterations-- > 0) {
        yw = yi = 0;

        for (y = 0; y < this.bitmap.height; y++) {
            rsum = this.bitmap.data[yw] * rad1;
            gsum = this.bitmap.data[yw + 1] * rad1;
            bsum = this.bitmap.data[yw + 2] * rad1;
            asum = this.bitmap.data[yw + 3] * rad1;


            for (i = 1; i <= r; i++) {
                p = yw + (((i > wm ? wm : i)) << 2);
                rsum += this.bitmap.data[p++];
                gsum += this.bitmap.data[p++];
                bsum += this.bitmap.data[p++];
                asum += this.bitmap.data[p]
            }

            for (x = 0; x < this.bitmap.width; x++) {
                red[yi] = rsum;
                green[yi] = gsum;
                blue[yi] = bsum;
                alpha[yi] = asum;

                if (y == 0) {
                    vmin[x] = ((p = x + rad1) < wm ? p : wm) << 2;
                    vmax[x] = ((p = x - r) > 0 ? p << 2 : 0);
                }

                p1 = yw + vmin[x];
                p2 = yw + vmax[x];

                rsum += this.bitmap.data[p1++] - this.bitmap.data[p2++];
                gsum += this.bitmap.data[p1++] - this.bitmap.data[p2++];
                bsum += this.bitmap.data[p1++] - this.bitmap.data[p2++];
                asum += this.bitmap.data[p1] - this.bitmap.data[p2];

                yi++;
            }
            yw += (this.bitmap.width << 2);
        }

        for (x = 0; x < this.bitmap.width; x++) {
            yp = x;
            rsum = red[yp] * rad1;
            gsum = green[yp] * rad1;
            bsum = blue[yp] * rad1;
            asum = alpha[yp] * rad1;

            for (i = 1; i <= r; i++) {
                yp += (i > hm ? 0 : this.bitmap.width);
                rsum += red[yp];
                gsum += green[yp];
                bsum += blue[yp];
                asum += alpha[yp];
            }

            yi = x << 2;
            for (y = 0; y < this.bitmap.height; y++) {

                this.bitmap.data[yi + 3] = pa = (asum * mul_sum) >>> shg_sum;
                if (pa > 255) this.bitmap.data[yi + 3] = 255; // normalise alpha
                if (pa > 0) {
                    pa = 255 / pa;
                    this.bitmap.data[yi] = ((rsum * mul_sum) >>> shg_sum) * pa;
                    this.bitmap.data[yi + 1] = ((gsum * mul_sum) >>> shg_sum) * pa;
                    this.bitmap.data[yi + 2] = ((bsum * mul_sum) >>> shg_sum) * pa;
                } else {
                    this.bitmap.data[yi] = this.bitmap.data[yi + 1] = this.bitmap.data[yi + 2] = 0;
                }
                if (x == 0) {
                    vmin[y] = ((p = y + rad1) < hm ? p : hm) * this.bitmap.width;
                    vmax[y] = ((p = y - r) > 0 ? p * this.bitmap.width : 0);
                }

                p1 = x + vmin[y];
                p2 = x + vmax[y];

                rsum += red[p1] - red[p2];
                gsum += green[p1] - green[p2];
                bsum += blue[p1] - blue[p2];
                asum += alpha[p1] - alpha[p2];

                yi += this.bitmap.width << 2;
            }
        }
    }

    if (isNodePattern(cb)) cb.call(this, null, this);
    else return this;
}

/**
 * Removes colour from the image
 * @param cb A callback for when complete
 * @returns this for chaining of methods
 */
Jimp.prototype.greyscale = function (cb) {
    this.scan(0, 0, this.bitmap.width, this.bitmap.height, function (x, y, idx) {
        var grey = (this.bitmap.data[idx] + this.bitmap.data[idx+1] + this.bitmap.data[idx+2] ) / 3;
        this.bitmap.data[idx] = grey;
        this.bitmap.data[idx+1] = grey;
        this.bitmap.data[idx+2] = grey;
    });
    
    if (isNodePattern(cb)) cb.call(this, null, this);
    else return this;
};

/**
 * Applies a sepia tone to the image
 * @param cb A callback for when complete
 * @returns this for chaining of methods
 */
Jimp.prototype.sepia = function (cb) {
    this.scan(0, 0, this.bitmap.width, this.bitmap.height, function (x, y, idx) {
        var red = this.bitmap.data[idx];
        var green = this.bitmap.data[idx+1];
        var blue = this.bitmap.data[idx+2];
        
        red = (red * 0.393) + (green * 0.769) + (blue * 0.189);
        green = (red * 0.349) + (green * 0.686) + (blue * 0.168);
        blue = (red * 0.272) + (green * 0.534) + (blue * 0.131);
        this.bitmap.data[idx] = (red < 255) ? red : 255;
        this.bitmap.data[idx+1] = (green < 255) ? green : 255;
        this.bitmap.data[idx+2] = (blue < 255) ? blue : 255;
    });
    
    if (isNodePattern(cb)) cb.call(this, null, this);
    else return this;
}

/**
 * Multiplies the opacity of each pixel by a factor between 0 and 1
 * @param f A number, the factor by wich to multiply the opacity of each pixel
 * @param cb A callback for when complete
 * @returns this for chaining of methods
 */
Jimp.prototype.opacity = function (f, cb) {
    if ("number" != typeof f)
        throwError.call(this, "f must be a number", cb);
    if (f < 0 || f > 1)
        throwError.call(this, "f must be a number from 0 to 1", cb);

    this.scan(0, 0, this.bitmap.width, this.bitmap.height, function (x, y, idx) {
        var v = this.bitmap.data[idx+3] * f;
        this.bitmap.data[idx+3] = v;
    });
    
    if (isNodePattern(cb)) cb.call(this, null, this);
    else return this;
};

/**
 * Resizes the image to a set width and height using a 2-pass bilinear algorithm
 * @param w the width to resize the image to
 * @param h the height to resize the image to
 * @param cb A callback for when complete
 * @returns this for chaining of methods
 */
Jimp.prototype.resize = function (w, h, cb) {
    if ("number" != typeof w || "number" != typeof h)
        throwError.call(this, "w and h must be numbers", cb);
    
    w = Math.round(w);
    h = Math.round(h);
    var that = this;
    var resize = new Resize(this.bitmap.width, this.bitmap.height, w, h, true, true, function (buffer) {
        that.bitmap.data = new Buffer(buffer);
        that.bitmap.width = w;
        that.bitmap.height = h;
    });
    resize.resize(this.bitmap.data);
    
    if (isNodePattern(cb)) cb.call(this, null, this);
    else return this;
};

/**
 * Uniformly scales the image by a factor.
 * @param f the factor to scale the image by
 * @param cb A callback for when complete
 * @returns this for chaining of methods
 */
Jimp.prototype.scale = function (f, cb) {
    if ("number" != typeof f)
        throwError.call(this, "f must be a number", cb);
    if (f < 0)
        throwError.call(this, "f must be a positive number", cb);
    
    var w = this.bitmap.width * f;
    var h = this.bitmap.height * f;
    this.resize(w, h);
    
    if (isNodePattern(cb)) cb.call(this, null, this);
    else return this;
};

/**
 * Rotates the image clockwise by a number of degrees rounded to the nearest 90 degrees
 * @param deg the number of degress to rotate the image by
 * @param cb A callback for when complete
 * @returns this for chaining of methods
 */
Jimp.prototype.rotate = function (deg, cb) {
    if ("number" != typeof deg)
        throwError.call(this, "deg must be a number", cb);
    
    var i = Math.round(deg / 90) % 4;
    if (i < 0) i += 4;
    
    while ( i > 0 ) {
        var bitmap = [];
        for (var x = 0; x < this.bitmap.width; x++) {
            for (var y = this.bitmap.height; y > 0; y--) {
                var idx = (this.bitmap.width * y + x) << 2;

                bitmap.push(this.bitmap.data[idx]);
                bitmap.push(this.bitmap.data[idx+1]);
                bitmap.push(this.bitmap.data[idx+2]);
                bitmap.push(this.bitmap.data[idx+3]);
            }
        }
        
        this.bitmap.data = new Buffer(bitmap);
        var tmp = this.bitmap.width;
        this.bitmap.width = this.bitmap.height;
        this.bitmap.height = tmp;

        i--;
    }

    if (isNodePattern(cb)) cb.call(this, null, this);
    else return this;
};

/**
 * Converts the image to a buffer
 * @param mime the mime type of the image buffer to be created
 * @param cb a function to call when the image is saved to disk
 * @returns this for chaining of methods
 */
Jimp.prototype.getBuffer = function (mime, cb) {
    if ("string" != typeof mime)
        throwError.call(this, "mime must be a string", cb);
    if ("function" != typeof cb)
        throwError.call(this, "cb must be a function", cb);

    switch (mime.toLowerCase()) {
        case Jimp.MIME_PNG:
            var that = this;
            var png = new PNG();
            png.data = new Buffer(this.bitmap.data);
            png.width = this.bitmap.width;
            png.height = this.bitmap.height;
            StreamToBuffer(png.pack(), function (err, buffer) {
                cb.call(that, null, buffer);
            })
            break;
        case Jimp.MIME_JPEG:
            var jpeg = JPEG.encode(this.bitmap, this._quality);
            cb.call(this, null, jpeg.data);
            break;
        default:
            cb.call(this, "Unsupported MIME type: " + mime);
    }
    
    return this;
};


/**
 * Writes the image to a file
 * @param path a path to the destination file (either PNG or JPEG)
 * @param (optional) cb a function to call when the image is saved to disk
 * @returns this for chaining of methods
 */
Jimp.prototype.write = function (path, cb) {
    if ("string" != typeof path)
        throwError.call(this, "path must be a string", cb);
    if ("undefined" == typeof cb) cb = function () {};
    if ("function" != typeof cb)
        throwError.call(this, "cb must be a function", cb);

    var that = this;
    var mime = MIME.lookup(path);
    
    this.getBuffer(mime, function(err, buffer) {
        if (err) throwError.call(that, err, cb);
		var stream = FS.createWriteStream(path);
		stream.on("open", function(fh) {
			stream.write(buffer);
			stream.end();
			return cb.call(that, null, that);
		});
	});
    
    return this;
};

module.exports = Jimp;
