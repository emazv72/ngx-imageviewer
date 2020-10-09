(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('@angular/core'), require('@angular/platform-browser'), require('rxjs')) :
    typeof define === 'function' && define.amd ? define('@emazv72/ngx-imageviewer', ['exports', '@angular/core', '@angular/platform-browser', 'rxjs'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory((global.emazv72 = global.emazv72 || {}, global.emazv72['ngx-imageviewer'] = {}), global.ng.core, global.ng.platformBrowser, global.rxjs));
}(this, (function (exports, i0, platformBrowser, rxjs) { 'use strict';

    var ImageViewerConfig = /** @class */ (function () {
        function ImageViewerConfig() {
        }
        return ImageViewerConfig;
    }());
    function createButtonConfig(icon, tooltip, sortId, show) {
        if (sortId === void 0) { sortId = 0; }
        if (show === void 0) { show = true; }
        return { icon: icon, tooltip: tooltip, sortId: sortId, show: show };
    }
    var IMAGEVIEWER_CONFIG = new i0.InjectionToken('imageviewer.config');
    var IMAGEVIEWER_CONFIG_DEFAULT = {
        width: 800,
        height: 600,
        bgStyle: '#ECEFF1',
        scaleStep: 0.1,
        rotateStepper: false,
        loadingMessage: 'Loading...',
        buttonStyle: {
            iconFontFamily: 'Material Icons',
            alpha: 0.5,
            hoverAlpha: 0.7,
            bgStyle: '#000000',
            iconStyle: '#ffffff',
            borderStyle: '#000000',
            borderWidth: 0 // buttons' border width (0 == disabled)
        },
        tooltips: {
            enabled: true,
            bgStyle: '#000000',
            bgAlpha: 0.5,
            textStyle: '#ffffff',
            textAlpha: 0.9,
            padding: 15,
            radius: 20 // tooltip border radius
        },
        nextPageButton: createButtonConfig(String.fromCharCode(0xE409), 'Next page', 0),
        beforePageButton: createButtonConfig(String.fromCharCode(0xE408), 'Previous page', 1),
        zoomOutButton: createButtonConfig(String.fromCharCode(0xE900), 'Zoom out', 0),
        zoomInButton: createButtonConfig(String.fromCharCode(0xE8FF), 'Zoom in', 1),
        rotateLeftButton: createButtonConfig(String.fromCharCode(0xE419), 'Rotate left', 2),
        rotateRightButton: createButtonConfig(String.fromCharCode(0xE41A), 'Rotate right', 3),
        resetButton: createButtonConfig(String.fromCharCode(0xE863), 'Reset', 4)
    };

    var Button = /** @class */ (function () {
        //#endregion
        //#region Lifecycle events
        function Button(config, style) {
            this.style = style;
            //#region Properties
            this.sortId = 0;
            // hover state
            this.hover = false;
            // show/hide button
            this.display = true;
            // drawn on position
            this.drawPosition = null;
            this.drawRadius = 0;
            this.sortId = config.sortId;
            this.display = config.show;
            this.icon = config.icon;
            this.tooltip = config.tooltip;
        }
        //#endregion
        //#region Events
        // click action
        Button.prototype.onClick = function (evt) { alert('no click action set!'); return true; };
        // mouse down action
        Button.prototype.onMouseDown = function (evt) { return false; };
        //#endregion
        //#region Draw Button
        Button.prototype.draw = function (ctx, x, y, radius) {
            this.drawPosition = { x: x, y: y };
            this.drawRadius = radius;
            // preserve context
            ctx.save();
            // drawing settings
            var isHover = (typeof this.hover === 'function') ? this.hover() : this.hover;
            ctx.globalAlpha = (isHover) ? this.style.hoverAlpha : this.style.alpha;
            ctx.fillStyle = this.style.bgStyle;
            ctx.lineWidth = 0;
            // draw circle
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, 2 * Math.PI);
            ctx.closePath();
            ctx.fill();
            if (this.style.borderWidth > 0) {
                ctx.lineWidth = this.style.borderWidth;
                ctx.strokeStyle = this.style.borderStyle;
                ctx.stroke();
            }
            // draw icon
            if (this.icon !== null) {
                ctx.save();
                // ctx.globalCompositeOperation = 'destination-out';
                this.drawIconFont(ctx, x, y, radius);
                ctx.restore();
            }
            // restore context
            ctx.restore();
        };
        Button.prototype.drawIconFont = function (ctx, centreX, centreY, size) {
            // font settings
            ctx.font = size + 'px ' + this.style.iconFontFamily;
            ctx.fillStyle = this.style.iconStyle;
            // calculate position
            var textSize = ctx.measureText(this.icon);
            var x = centreX - textSize.width / 2;
            var y = centreY + size / 2;
            // draw it
            ctx.fillText(this.icon, x, y);
        };
        //#endregion
        //#region Utils
        Button.prototype.isWithinBounds = function (x, y) {
            if (this.drawPosition === null) {
                return false;
            }
            var dx = Math.abs(this.drawPosition.x - x), dy = Math.abs(this.drawPosition.y - y);
            return dx * dx + dy * dy <= this.drawRadius * this.drawRadius;
        };
        return Button;
    }());
    var Viewport = /** @class */ (function () {
        function Viewport(width, height, scale, rotation, x, y) {
            this.width = width;
            this.height = height;
            this.scale = scale;
            this.rotation = rotation;
            this.x = x;
            this.y = y;
        }
        return Viewport;
    }());
    var ResourceLoader = /** @class */ (function () {
        function ResourceLoader() {
            this.viewport = { width: 0, height: 0, scale: 1, rotation: 0, x: 0, y: 0 };
            this.minScale = 0;
            this.maxScale = 4;
            this.currentItem = 1;
            this.totalItem = 1;
            this.showItemsQuantity = false;
            this.loaded = false;
            this.loading = false;
            this.rendering = false;
            this.resourceChange = new rxjs.Subject();
        }
        ResourceLoader.prototype.resetViewport = function (canvasDim) {
            if (!this.loaded || !canvasDim) {
                return;
            }
            var rotation = this.viewport ? this.viewport.rotation : 0;
            var inverted = toSquareAngle(rotation) / 90 % 2 !== 0;
            var canvas = {
                width: !inverted ? canvasDim.width : canvasDim.height,
                height: !inverted ? canvasDim.height : canvasDim.width
            };
            if (((canvas.height / this._image.height) * this._image.width) <= canvas.width) {
                this.viewport.scale = canvas.height / this._image.height;
            }
            else {
                this.viewport.scale = canvas.width / this._image.width;
            }
            this.minScale = this.viewport.scale / 4;
            this.maxScale = this.viewport.scale * 4;
            // start point to draw image
            this.viewport.width = this._image.width * this.viewport.scale;
            this.viewport.height = this._image.height * this.viewport.scale;
            this.viewport.x = (canvasDim.width - this.viewport.width) / 2;
            this.viewport.y = (canvasDim.height - this.viewport.height) / 2;
        };
        ResourceLoader.prototype.draw = function (ctx, config, canvasDim, onFinish) {
            // clear canvas
            ctx.clearRect(0, 0, canvasDim.width, canvasDim.height);
            // Draw background color;
            ctx.fillStyle = config.bgStyle;
            ctx.fillRect(0, 0, canvasDim.width, canvasDim.height);
            // draw image (transformed, rotate and scaled)
            if (!this.loading && this.loaded) {
                ctx.translate(this.viewport.x + this.viewport.width / 2, this.viewport.y + this.viewport.height / 2);
                ctx.rotate(this.viewport.rotation * Math.PI / 180);
                ctx.scale(this.viewport.scale, this.viewport.scale);
                ctx.drawImage(this._image, -this._image.width / 2, -this._image.height / 2);
            }
            else {
                ctx.fillStyle = '#333';
                ctx.font = '25px Verdana';
                ctx.textAlign = 'center';
                ctx.fillText(config.loadingMessage || 'Loading...', canvasDim.width / 2, canvasDim.height / 2);
            }
            onFinish(ctx, config, canvasDim);
        };
        ResourceLoader.prototype.onResourceChange = function () { return this.resourceChange.asObservable(); };
        return ResourceLoader;
    }());
    function toSquareAngle(angle) {
        return 90 * ((Math.trunc(angle / 90) + (Math.trunc(angle % 90) > 45 ? 1 : 0)) % 4);
    }

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */
    /* global Reflect, Promise */
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b)
                if (Object.prototype.hasOwnProperty.call(b, p))
                    d[p] = b[p]; };
        return extendStatics(d, b);
    };
    function __extends(d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    }
    var __assign = function () {
        __assign = Object.assign || function __assign(t) {
            for (var s, i = 1, n = arguments.length; i < n; i++) {
                s = arguments[i];
                for (var p in s)
                    if (Object.prototype.hasOwnProperty.call(s, p))
                        t[p] = s[p];
            }
            return t;
        };
        return __assign.apply(this, arguments);
    };
    function __rest(s, e) {
        var t = {};
        for (var p in s)
            if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
                t[p] = s[p];
        if (s != null && typeof Object.getOwnPropertySymbols === "function")
            for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
                if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                    t[p[i]] = s[p[i]];
            }
        return t;
    }
    function __decorate(decorators, target, key, desc) {
        var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
        if (typeof Reflect === "object" && typeof Reflect.decorate === "function")
            r = Reflect.decorate(decorators, target, key, desc);
        else
            for (var i = decorators.length - 1; i >= 0; i--)
                if (d = decorators[i])
                    r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
        return c > 3 && r && Object.defineProperty(target, key, r), r;
    }
    function __param(paramIndex, decorator) {
        return function (target, key) { decorator(target, key, paramIndex); };
    }
    function __metadata(metadataKey, metadataValue) {
        if (typeof Reflect === "object" && typeof Reflect.metadata === "function")
            return Reflect.metadata(metadataKey, metadataValue);
    }
    function __awaiter(thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try {
                step(generator.next(value));
            }
            catch (e) {
                reject(e);
            } }
            function rejected(value) { try {
                step(generator["throw"](value));
            }
            catch (e) {
                reject(e);
            } }
            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    }
    function __generator(thisArg, body) {
        var _ = { label: 0, sent: function () { if (t[0] & 1)
                throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
        return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function () { return this; }), g;
        function verb(n) { return function (v) { return step([n, v]); }; }
        function step(op) {
            if (f)
                throw new TypeError("Generator is already executing.");
            while (_)
                try {
                    if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done)
                        return t;
                    if (y = 0, t)
                        op = [op[0] & 2, t.value];
                    switch (op[0]) {
                        case 0:
                        case 1:
                            t = op;
                            break;
                        case 4:
                            _.label++;
                            return { value: op[1], done: false };
                        case 5:
                            _.label++;
                            y = op[1];
                            op = [0];
                            continue;
                        case 7:
                            op = _.ops.pop();
                            _.trys.pop();
                            continue;
                        default:
                            if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                                _ = 0;
                                continue;
                            }
                            if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) {
                                _.label = op[1];
                                break;
                            }
                            if (op[0] === 6 && _.label < t[1]) {
                                _.label = t[1];
                                t = op;
                                break;
                            }
                            if (t && _.label < t[2]) {
                                _.label = t[2];
                                _.ops.push(op);
                                break;
                            }
                            if (t[2])
                                _.ops.pop();
                            _.trys.pop();
                            continue;
                    }
                    op = body.call(thisArg, _);
                }
                catch (e) {
                    op = [6, e];
                    y = 0;
                }
                finally {
                    f = t = 0;
                }
            if (op[0] & 5)
                throw op[1];
            return { value: op[0] ? op[1] : void 0, done: true };
        }
    }
    var __createBinding = Object.create ? (function (o, m, k, k2) {
        if (k2 === undefined)
            k2 = k;
        Object.defineProperty(o, k2, { enumerable: true, get: function () { return m[k]; } });
    }) : (function (o, m, k, k2) {
        if (k2 === undefined)
            k2 = k;
        o[k2] = m[k];
    });
    function __exportStar(m, o) {
        for (var p in m)
            if (p !== "default" && !Object.prototype.hasOwnProperty.call(o, p))
                __createBinding(o, m, p);
    }
    function __values(o) {
        var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
        if (m)
            return m.call(o);
        if (o && typeof o.length === "number")
            return {
                next: function () {
                    if (o && i >= o.length)
                        o = void 0;
                    return { value: o && o[i++], done: !o };
                }
            };
        throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
    }
    function __read(o, n) {
        var m = typeof Symbol === "function" && o[Symbol.iterator];
        if (!m)
            return o;
        var i = m.call(o), r, ar = [], e;
        try {
            while ((n === void 0 || n-- > 0) && !(r = i.next()).done)
                ar.push(r.value);
        }
        catch (error) {
            e = { error: error };
        }
        finally {
            try {
                if (r && !r.done && (m = i["return"]))
                    m.call(i);
            }
            finally {
                if (e)
                    throw e.error;
            }
        }
        return ar;
    }
    function __spread() {
        for (var ar = [], i = 0; i < arguments.length; i++)
            ar = ar.concat(__read(arguments[i]));
        return ar;
    }
    function __spreadArrays() {
        for (var s = 0, i = 0, il = arguments.length; i < il; i++)
            s += arguments[i].length;
        for (var r = Array(s), k = 0, i = 0; i < il; i++)
            for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
                r[k] = a[j];
        return r;
    }
    ;
    function __await(v) {
        return this instanceof __await ? (this.v = v, this) : new __await(v);
    }
    function __asyncGenerator(thisArg, _arguments, generator) {
        if (!Symbol.asyncIterator)
            throw new TypeError("Symbol.asyncIterator is not defined.");
        var g = generator.apply(thisArg, _arguments || []), i, q = [];
        return i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i;
        function verb(n) { if (g[n])
            i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; }
        function resume(n, v) { try {
            step(g[n](v));
        }
        catch (e) {
            settle(q[0][3], e);
        } }
        function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
        function fulfill(value) { resume("next", value); }
        function reject(value) { resume("throw", value); }
        function settle(f, v) { if (f(v), q.shift(), q.length)
            resume(q[0][0], q[0][1]); }
    }
    function __asyncDelegator(o) {
        var i, p;
        return i = {}, verb("next"), verb("throw", function (e) { throw e; }), verb("return"), i[Symbol.iterator] = function () { return this; }, i;
        function verb(n, f) { i[n] = o[n] ? function (v) { return (p = !p) ? { value: __await(o[n](v)), done: n === "return" } : f ? f(v) : v; } : f; }
    }
    function __asyncValues(o) {
        if (!Symbol.asyncIterator)
            throw new TypeError("Symbol.asyncIterator is not defined.");
        var m = o[Symbol.asyncIterator], i;
        return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
        function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
        function settle(resolve, reject, d, v) { Promise.resolve(v).then(function (v) { resolve({ value: v, done: d }); }, reject); }
    }
    function __makeTemplateObject(cooked, raw) {
        if (Object.defineProperty) {
            Object.defineProperty(cooked, "raw", { value: raw });
        }
        else {
            cooked.raw = raw;
        }
        return cooked;
    }
    ;
    var __setModuleDefault = Object.create ? (function (o, v) {
        Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function (o, v) {
        o["default"] = v;
    };
    function __importStar(mod) {
        if (mod && mod.__esModule)
            return mod;
        var result = {};
        if (mod != null)
            for (var k in mod)
                if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k))
                    __createBinding(result, mod, k);
        __setModuleDefault(result, mod);
        return result;
    }
    function __importDefault(mod) {
        return (mod && mod.__esModule) ? mod : { default: mod };
    }
    function __classPrivateFieldGet(receiver, privateMap) {
        if (!privateMap.has(receiver)) {
            throw new TypeError("attempted to get private field on non-instance");
        }
        return privateMap.get(receiver);
    }
    function __classPrivateFieldSet(receiver, privateMap, value) {
        if (!privateMap.has(receiver)) {
            throw new TypeError("attempted to set private field on non-instance");
        }
        privateMap.set(receiver, value);
        return value;
    }

    var ImageResourceLoader = /** @class */ (function (_super) {
        __extends(ImageResourceLoader, _super);
        function ImageResourceLoader() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        ImageResourceLoader.prototype.setUp = function () {
            this.loadResource();
        };
        ImageResourceLoader.prototype.loadResource = function () {
            var _this = this;
            this.loading = true;
            this._image = new Image();
            this._image.addEventListener('load', function (evt) {
                _this.loaded = true;
                _this.loading = false;
                _this.resourceChange.next();
            }, false);
            this._image.src = this.src;
        };
        return ImageResourceLoader;
    }(ResourceLoader));

    var ImageCacheService = /** @class */ (function () {
        function ImageCacheService() {
            this._cache = [];
        }
        Object.defineProperty(ImageCacheService.prototype, "cache", {
            get: function () {
                return this._cache;
            },
            enumerable: false,
            configurable: true
        });
        ImageCacheService.prototype.getCache = function (url, page) {
            return this.cache.find(function (i) { return i.url === url && i.page === page; });
        };
        ImageCacheService.prototype.getImage = function (url, page) {
            var c = this.getCache(url, page);
            return c ? c.image : null;
        };
        ImageCacheService.prototype.saveImage = function (url, page, image) {
            var cache = this.getCache(url, page);
            if (cache) {
                cache.image = image;
            }
            else {
                this.cache.push({ url: url, page: page, image: image });
            }
        };
        ImageCacheService.prototype.disposeCache = function () {
            this.cache.forEach(function (i) { return URL.revokeObjectURL(i.image.src); });
            this._cache = [];
        };
        return ImageCacheService;
    }());
    ImageCacheService.ɵprov = i0.ɵɵdefineInjectable({ factory: function ImageCacheService_Factory() { return new ImageCacheService(); }, token: ImageCacheService, providedIn: "root" });
    ImageCacheService.decorators = [
        { type: i0.Injectable, args: [{ providedIn: 'root' },] }
    ];
    ImageCacheService.ctorParameters = function () { return []; };

    var PdfResourceLoader = /** @class */ (function (_super) {
        __extends(PdfResourceLoader, _super);
        function PdfResourceLoader(_imageCache) {
            var _this = _super.call(this) || this;
            _this._imageCache = _imageCache;
            if (typeof window !== 'undefined' && 'Worker' in window) {
                if (pdfjsLib && pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
                    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
                }
            }
            _this.showItemsQuantity = true;
            return _this;
        }
        PdfResourceLoader.prototype.setUp = function () {
            var vm = this;
            if (vm.loading || !vm.src) {
                return;
            }
            var loadingTask = pdfjsLib.getDocument(vm.src);
            vm.loading = true;
            vm.currentItem = 1;
            loadingTask.then(function (pdf) {
                vm._pdf = pdf;
                vm.totalItem = pdf.numPages;
                vm.loaded = true;
                vm.loadResource();
            }, function (reason) {
                console.error(reason);
            });
        };
        PdfResourceLoader.prototype.loadResource = function () {
            var vm = this;
            if (!vm.loaded) {
                vm._pendingReload = true;
                return;
            }
            vm.loaded = false;
            var url = vm.src;
            var page = vm.currentItem;
            vm._pdf.getPage(page).then(function (pdfPage) {
                vm._page = pdfPage;
                vm.loadImage(url, page, function () {
                    vm.loaded = true;
                    vm.loading = false;
                    if (vm._pendingReload) {
                        vm._pendingReload = false;
                        vm.loadResource();
                    }
                    else {
                        vm.resourceChange.next();
                    }
                });
            });
        };
        PdfResourceLoader.prototype.loadImage = function (src, page, onFinish) {
            var vm = this;
            var cacheimg = vm._imageCache.getImage(src, page);
            if (cacheimg) {
                vm._image = cacheimg;
                onFinish();
                return;
            }
            var canvas = document.createElement('canvas');
            var context = canvas.getContext('2d');
            var pageVp = vm._page.getViewport(2);
            canvas.width = pageVp.width;
            canvas.height = pageVp.height;
            var renderContext = {
                canvasContext: context,
                viewport: pageVp
            };
            var renderTask = vm._page.render(renderContext);
            renderTask.then(function () {
                canvas.toBlob(function (blob) {
                    var img = new Image();
                    img.onload = onFinish;
                    img.src = URL.createObjectURL(blob);
                    vm._imageCache.saveImage(src, page, img);
                    vm._image = img;
                });
            });
        };
        return PdfResourceLoader;
    }(ResourceLoader));

    var MIN_TOOLTIP_WIDTH_SPACE = 500;
    var ImageViewerComponent = /** @class */ (function () {
        //#endregion
        //#region Lifecycle events
        function ImageViewerComponent(_sanitizer, _renderer, _imageCache, config) {
            this._sanitizer = _sanitizer;
            this._renderer = _renderer;
            this._imageCache = _imageCache;
            this.config = config;
            // dirty state
            this._dirty = true;
            // contains all active buttons
            this._buttons = [];
            // current tool tip (used to track change of tool tip)
            this._currentTooltip = null;
            // cached data when touch events started
            this._touchStartState = {};
            // list of event listener destroyers
            this._listenDestroyList = [];
            this.config = this.extendsDefaultConfig(config);
            this._nextPageButton = new Button(this.config.nextPageButton, this.config.buttonStyle);
            this._beforePageButton = new Button(this.config.beforePageButton, this.config.buttonStyle);
            this._zoomOutButton = new Button(this.config.zoomOutButton, this.config.buttonStyle);
            this._zoomInButton = new Button(this.config.zoomInButton, this.config.buttonStyle);
            this._rotateLeftButton = new Button(this.config.rotateLeftButton, this.config.buttonStyle);
            this._rotateRightButton = new Button(this.config.rotateRightButton, this.config.buttonStyle);
            this._resetButton = new Button(this.config.resetButton, this.config.buttonStyle);
            this._buttons = [
                this._zoomOutButton,
                this._zoomInButton,
                this._rotateLeftButton,
                this._rotateRightButton,
                this._resetButton
            ].filter(function (item) { return item.display; })
                .sort(function (a, b) { return a.sortId - b.sortId; });
        }
        Object.defineProperty(ImageViewerComponent.prototype, "src", {
            get: function () { return this._src; },
            set: function (value) {
                if (value === this._src) {
                    return;
                }
                this._src = value;
                this.setUpResource();
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(ImageViewerComponent.prototype, "filetype", {
            get: function () { return this._filetype; },
            set: function (value) {
                if (value === this._filetype) {
                    return;
                }
                this._filetype = value;
                this.setUpResource();
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(ImageViewerComponent.prototype, "width", {
            get: function () { return this._width; },
            set: function (value) {
                if (value === this._width) {
                    return;
                }
                this._width = value;
                if (this._canvas) {
                    this._canvas.width = this._width;
                }
                this.resetImage();
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(ImageViewerComponent.prototype, "height", {
            get: function () { return this._height; },
            set: function (value) {
                if (value === this._height) {
                    return;
                }
                this._height = value;
                if (this._canvas) {
                    this._canvas.height = this._height;
                }
                this.resetImage();
            },
            enumerable: false,
            configurable: true
        });
        ImageViewerComponent.prototype.ngAfterViewInit = function () {
            var _this = this;
            this._canvas = this.canvasRef.nativeElement;
            this._context = this._canvas.getContext('2d');
            // setting canvas dimention
            this._canvas.width = this.width || this.config.width;
            this._canvas.height = this.height || this.config.height;
            // setting buttons actions
            this._nextPageButton.onClick = function (evt) { _this.nextPage(); return false; };
            this._beforePageButton.onClick = function (evt) { _this.previousPage(); return false; };
            this._zoomOutButton.onClick = function (evt) { _this.zoomOut(); return false; };
            this._zoomInButton.onClick = function (evt) { _this.zoomIn(); return false; };
            this._rotateLeftButton.onClick = function (evt) { _this.rotateLeft(); return false; };
            this._rotateRightButton.onClick = function (evt) { _this.rotateRight(); return false; };
            this._resetButton.onClick = function (evt) { _this.resetImage(); return false; };
            // register event listeners
            this.addEventListeners();
            this.updateCanvas();
        };
        ImageViewerComponent.prototype.ngOnDestroy = function () {
            // unregiste event listeners
            this._listenDestroyList.forEach(function (listenDestroy) {
                if (typeof listenDestroy === 'function') {
                    listenDestroy();
                }
            });
            this._imageCache.disposeCache();
        };
        ImageViewerComponent.prototype.setUpResource = function () {
            var _this = this;
            if (this.isImage(this.src) && (!this._resource || !(this._resource instanceof ImageResourceLoader))) {
                if (this._resourceChangeSub) {
                    this._resourceChangeSub.unsubscribe();
                }
                if (!this._imageResource) {
                    this._imageResource = new ImageResourceLoader();
                }
                this._resource = this._imageResource;
            }
            else if (this.isPdf(this.src) && (!this._resource || !(this._resource instanceof PdfResourceLoader))) {
                if (this._resourceChangeSub) {
                    this._resourceChangeSub.unsubscribe();
                }
                if (!this._pdfResource) {
                    this._pdfResource = new PdfResourceLoader(this._imageCache);
                }
                this._resource = this._pdfResource;
            }
            if (this._resource) {
                this._resource.src = this.src instanceof File ? URL.createObjectURL(this.src) : this.src;
                this._resourceChangeSub = this._resource.onResourceChange().subscribe(function () {
                    _this.updateCanvas();
                    if (_this.src instanceof File) {
                        URL.revokeObjectURL(_this._resource.src);
                    }
                });
                this._resource.setUp();
                this.resetImage();
                if (this._context) {
                    this.updateCanvas();
                }
            }
        };
        //#endregion
        //#region Touch events
        ImageViewerComponent.prototype.onTap = function (evt) {
            var position = { x: evt.pageX, y: evt.pageY };
            var activeElement = this.getUIElement(this.screenToCanvasCentre(position));
            if (activeElement !== null) {
                activeElement.onClick(evt);
            }
        };
        ImageViewerComponent.prototype.onTouchEnd = function () {
            this._touchStartState.viewport = undefined;
            this._touchStartState.scale = undefined;
            this._touchStartState.rotate = undefined;
        };
        ImageViewerComponent.prototype.processTouchEvent = function (evt) {
            // process pan
            if (!this._touchStartState.viewport) {
                this._touchStartState.viewport = Object.assign({}, this._resource.viewport);
            }
            var viewport = this._resource.viewport;
            viewport.x = this._touchStartState.viewport.x + evt.deltaX;
            viewport.y = this._touchStartState.viewport.y + evt.deltaY;
            // process pinch in/out
            if (!this._touchStartState.scale) {
                this._touchStartState.scale = this._resource.viewport.scale;
            }
            var newScale = this._touchStartState.scale * evt.scale;
            viewport.scale = newScale > this._resource.maxScale ? this._resource.maxScale :
                newScale < this._resource.minScale ? this._resource.minScale : newScale;
            // process rotate left/right
            if (!this._touchStartState.rotate) {
                this._touchStartState.rotate = { rotation: viewport.rotation, startRotate: evt.rotation };
            }
            if (evt.rotation !== 0) {
                var newAngle = this._touchStartState.rotate.rotation + evt.rotation - this._touchStartState.rotate.startRotate;
                viewport.rotation = this.config.rotateStepper ? toSquareAngle(newAngle) : newAngle;
            }
            this._dirty = true;
        };
        //#endregion
        //#region Mouse Events
        ImageViewerComponent.prototype.addEventListeners = function () {
            var _this = this;
            // zooming
            this._listenDestroyList.push(this._renderer.listen(this._canvas, 'DOMMouseScroll', function (evt) { return _this.onMouseWheel(evt); }));
            this._listenDestroyList.push(this._renderer.listen(this._canvas, 'mousewheel', function (evt) { return _this.onMouseWheel(evt); }));
            // show tooltip when mouseover it
            this._listenDestroyList.push(this._renderer.listen(this._canvas, 'mousemove', function (evt) { return _this.checkTooltipActivation(_this.screenToCanvasCentre({ x: evt.clientX, y: evt.clientY })); }));
        };
        ImageViewerComponent.prototype.onMouseWheel = function (evt) {
            if (!evt) {
                evt = event;
            }
            evt.preventDefault();
            if (evt.detail < 0 || evt.wheelDelta > 0) { // up -> larger
                this.zoomIn();
            }
            else { // down -> smaller
                this.zoomOut();
            }
        };
        ImageViewerComponent.prototype.checkTooltipActivation = function (pos) {
            this.getUIElements().forEach(function (x) { return x.hover = false; });
            var activeElement = this.getUIElement(pos);
            var oldToolTip = this._currentTooltip;
            if (activeElement !== null) {
                if (typeof activeElement.hover !== 'undefined') {
                    activeElement.hover = true;
                }
                if (typeof activeElement.tooltip !== 'undefined') {
                    this._currentTooltip = activeElement.tooltip;
                }
            }
            if (oldToolTip !== this._currentTooltip) {
                this._dirty = true;
            }
        };
        //#endregion
        //#region Button Actions
        ImageViewerComponent.prototype.nextPage = function () {
            if (!this._resource) {
                return;
            }
            if (this._resource.currentItem >= this._resource.totalItem) {
                return;
            }
            if (this._resource.currentItem < 1) {
                this._resource.currentItem = 0;
            }
            this._resource.currentItem++;
            this._resource.loadResource();
            this._dirty = true;
        };
        ImageViewerComponent.prototype.previousPage = function () {
            if (!this._resource) {
                return;
            }
            if (this._resource.currentItem <= 1) {
                return;
            }
            if (this._resource.currentItem > this._resource.totalItem) {
                this._resource.currentItem = this._resource.totalItem + 1;
            }
            this._resource.currentItem--;
            this._resource.loadResource();
            this._dirty = true;
        };
        ImageViewerComponent.prototype.zoomIn = function () {
            if (!this._resource) {
                return;
            }
            var newScale = this._resource.viewport.scale * (1 + this.config.scaleStep);
            this._resource.viewport.scale = newScale > this._resource.maxScale ? this._resource.maxScale : newScale;
            this._dirty = true;
        };
        ImageViewerComponent.prototype.zoomOut = function () {
            if (!this._resource) {
                return;
            }
            var newScale = this._resource.viewport.scale * (1 - this.config.scaleStep);
            this._resource.viewport.scale = newScale < this._resource.minScale ? this._resource.minScale : newScale;
            this._dirty = true;
        };
        ImageViewerComponent.prototype.rotateLeft = function () {
            if (!this._resource) {
                return;
            }
            var viewport = this._resource.viewport;
            viewport.rotation = viewport.rotation === 0 ? 270 : viewport.rotation - 90;
            this._dirty = true;
        };
        ImageViewerComponent.prototype.rotateRight = function () {
            if (!this._resource) {
                return;
            }
            var viewport = this._resource.viewport;
            viewport.rotation = viewport.rotation === 270 ? 0 : viewport.rotation + 90;
            this._dirty = true;
        };
        ImageViewerComponent.prototype.resetImage = function () {
            if (!this._resource) {
                return;
            }
            this._resource.resetViewport(this._canvas);
            this._dirty = true;
        };
        //#endregion
        //#region Draw Canvas
        ImageViewerComponent.prototype.updateCanvas = function () {
            this.resetImage();
            // start new render loop
            this.render();
        };
        ImageViewerComponent.prototype.render = function () {
            var _this = this;
            var vm = this;
            // only re-render if dirty
            if (this._dirty && this._resource) {
                this._dirty = false;
                var ctx_1 = this._context;
                ctx_1.save();
                this._resource.draw(ctx_1, this.config, this._canvas, function () {
                    ctx_1.restore();
                    if (vm._resource.loaded) {
                        // draw buttons
                        _this.drawButtons(ctx_1);
                        // draw paginator
                        if (_this._resource.showItemsQuantity) {
                            _this.drawPaginator(ctx_1);
                        }
                    }
                });
            }
            requestAnimationFrame(function () { return _this.render(); });
        };
        ImageViewerComponent.prototype.drawButtons = function (ctx) {
            var padding = this.config.tooltips.padding;
            var radius = this.config.tooltips.radius;
            var gap = 2 * radius + padding;
            var x = this._canvas.width - radius - padding;
            var y = this._canvas.height - radius - padding;
            // draw buttons
            for (var i = 0; i < this._buttons.length; i++) {
                this._buttons[i].draw(ctx, x, y - gap * i, radius);
            }
            // draw tooltip
            if (this._currentTooltip !== null && this._canvas.width > MIN_TOOLTIP_WIDTH_SPACE) {
                ctx.save();
                var fontSize = radius;
                ctx.font = fontSize + 'px sans-serif';
                // calculate position
                var textSize = ctx.measureText(this._currentTooltip).width, rectWidth = textSize + padding, rectHeight = fontSize * 0.70 + padding, rectX = this._canvas.width
                    - (2 * radius + 2 * padding) // buttons
                    - rectWidth, rectY = this._canvas.height - rectHeight - padding, textX = rectX + 0.5 * padding, textY = this._canvas.height - 1.5 * padding;
                ctx.globalAlpha = this.config.tooltips.bgAlpha;
                ctx.fillStyle = this.config.tooltips.bgStyle;
                this.drawRoundRectangle(ctx, rectX, rectY, rectWidth, rectHeight, 8, true, false);
                ctx.globalAlpha = this.config.tooltips.textAlpha;
                ctx.fillStyle = this.config.tooltips.textStyle;
                ctx.fillText(this._currentTooltip, textX, textY);
                ctx.restore();
            }
        };
        ImageViewerComponent.prototype.drawPaginator = function (ctx) {
            var padding = this.config.tooltips.padding;
            var radius = this.config.tooltips.radius;
            var labelWidth = 50;
            var x1 = (this._canvas.width - labelWidth) / 2 - radius - padding; // PrevPageButton
            var x2 = this._canvas.width / 2; // Label
            var x3 = (this._canvas.width + labelWidth) / 2 + radius + padding; // NextPageButton
            var y = this._canvas.height - radius - padding;
            var label = this._resource.currentItem + '/' + this._resource.totalItem;
            var fontSize = 25;
            ctx.save();
            this._beforePageButton.draw(ctx, x1, y, radius);
            this._nextPageButton.draw(ctx, x3, y, radius);
            ctx.restore();
            ctx.save();
            ctx.font = fontSize + 'px Verdana';
            ctx.textAlign = 'center';
            ctx.fillText(label, x2, this._canvas.height - padding - fontSize / 2, labelWidth);
            ctx.restore();
        };
        ImageViewerComponent.prototype.drawRoundRectangle = function (ctx, x, y, width, height, radius, fill, stroke) {
            radius = (typeof radius === 'number') ? radius : 5;
            fill = (typeof fill === 'boolean') ? fill : true; // fill = default
            stroke = (typeof stroke === 'boolean') ? stroke : false;
            // draw round rectangle
            ctx.beginPath();
            ctx.moveTo(x + radius, y);
            ctx.lineTo(x + width - radius, y);
            ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
            ctx.lineTo(x + width, y + height - radius);
            ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
            ctx.lineTo(x + radius, y + height);
            ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
            ctx.lineTo(x, y + radius);
            ctx.quadraticCurveTo(x, y, x + radius, y);
            ctx.closePath();
            if (fill) {
                ctx.fill();
            }
            if (stroke) {
                ctx.stroke();
            }
        };
        //#endregion
        //#region Utils
        ImageViewerComponent.prototype.extendsDefaultConfig = function (cfg) {
            var defaultCfg = IMAGEVIEWER_CONFIG_DEFAULT;
            var localCfg = Object.assign({}, defaultCfg, cfg);
            if (cfg.buttonStyle) {
                localCfg.buttonStyle = Object.assign(defaultCfg.buttonStyle, cfg.buttonStyle);
            }
            if (cfg.tooltips) {
                localCfg.tooltips = Object.assign(defaultCfg.tooltips, cfg.tooltips);
            }
            if (cfg.nextPageButton) {
                localCfg.nextPageButton = Object.assign(defaultCfg.nextPageButton, cfg.nextPageButton);
            }
            if (cfg.beforePageButton) {
                localCfg.beforePageButton = Object.assign(defaultCfg.beforePageButton, cfg.beforePageButton);
            }
            if (cfg.zoomOutButton) {
                localCfg.zoomOutButton = Object.assign(defaultCfg.zoomOutButton, cfg.zoomOutButton);
            }
            if (cfg.zoomOutButton) {
                localCfg.zoomOutButton = Object.assign(defaultCfg.zoomOutButton, cfg.zoomOutButton);
            }
            if (cfg.zoomInButton) {
                localCfg.zoomInButton = Object.assign(defaultCfg.zoomInButton, cfg.zoomInButton);
            }
            if (cfg.rotateLeftButton) {
                localCfg.rotateLeftButton = Object.assign(defaultCfg.rotateLeftButton, cfg.rotateLeftButton);
            }
            if (cfg.rotateRightButton) {
                localCfg.rotateRightButton = Object.assign(defaultCfg.rotateRightButton, cfg.rotateRightButton);
            }
            if (cfg.resetButton) {
                localCfg.resetButton = Object.assign(defaultCfg.resetButton, cfg.resetButton);
            }
            return localCfg;
        };
        ImageViewerComponent.prototype.screenToCanvasCentre = function (pos) {
            var rect = this._canvas.getBoundingClientRect();
            return { x: pos.x - rect.left, y: pos.y - rect.top };
        };
        ImageViewerComponent.prototype.getUIElements = function () {
            var hoverElements = this._buttons.slice();
            hoverElements.push(this._nextPageButton);
            hoverElements.push(this._beforePageButton);
            return hoverElements;
        };
        ImageViewerComponent.prototype.getUIElement = function (pos) {
            var activeUIElement = this.getUIElements().filter(function (uiElement) {
                return uiElement.isWithinBounds(pos.x, pos.y);
            });
            return (activeUIElement.length > 0) ? activeUIElement[0] : null;
        };
        ImageViewerComponent.prototype.isImage = function (file) {
            if (this._filetype && this._filetype.toLowerCase() === 'image') {
                return true;
            }
            return testFile(file, '\\.(png|jpg|jpeg|gif)|image/png');
        };
        ImageViewerComponent.prototype.isPdf = function (file) {
            if (this._filetype && this._filetype.toLowerCase() === 'pdf') {
                return true;
            }
            return testFile(file, '\\.(pdf)|application/pdf');
        };
        return ImageViewerComponent;
    }());
    ImageViewerComponent.decorators = [
        { type: i0.Component, args: [{
                    selector: 'ngx-imageviewer',
                    template: "\n    <canvas #imageContainer [width]=\"width\" [height]=\"height\"\n      (click)=\"onTap($event)\" (pinchin)=\"processTouchEvent($event)\" (pinchout)=\"processTouchEvent($event)\"\n      (panmove)=\"processTouchEvent($event)\" (panend)=\"onTouchEnd()\" (rotatemove)=\"processTouchEvent($event)\"\n      (rotateend)=\"onTouchEnd()\">\n    </canvas>\n  ",
                    styles: ["\n    :host { display: block }\n    :host canvas { margin: 0 auto; display: block }\n    [hidden] { display: none !important }\n  "]
                },] }
    ];
    ImageViewerComponent.ctorParameters = function () { return [
        { type: platformBrowser.DomSanitizer },
        { type: i0.Renderer2 },
        { type: ImageCacheService },
        { type: ImageViewerConfig, decorators: [{ type: i0.Inject, args: [IMAGEVIEWER_CONFIG,] }] }
    ]; };
    ImageViewerComponent.propDecorators = {
        src: [{ type: i0.Input, args: ['src',] }],
        filetype: [{ type: i0.Input, args: ['filetype',] }],
        width: [{ type: i0.Input, args: ['width',] }],
        height: [{ type: i0.Input, args: ['height',] }],
        canvasRef: [{ type: i0.ViewChild, args: ['imageContainer', { static: false },] }]
    };
    function testFile(file, regexTest) {
        if (!file) {
            return false;
        }
        var name = file instanceof File ? file.name : file;
        return name.toLowerCase().match(regexTest) !== null;
    }

    var ɵ0 = IMAGEVIEWER_CONFIG_DEFAULT;
    var ImageViewerModule = /** @class */ (function () {
        function ImageViewerModule() {
        }
        return ImageViewerModule;
    }());
    ImageViewerModule.decorators = [
        { type: i0.NgModule, args: [{
                    providers: [{ provide: IMAGEVIEWER_CONFIG, useValue: ɵ0 }],
                    declarations: [ImageViewerComponent],
                    exports: [ImageViewerComponent],
                },] }
    ];

    /*
     * Public API Surface of ngx-imageviewer
     */

    /**
     * Generated bundle index. Do not edit.
     */

    exports.IMAGEVIEWER_CONFIG = IMAGEVIEWER_CONFIG;
    exports.ImageViewerComponent = ImageViewerComponent;
    exports.ImageViewerConfig = ImageViewerConfig;
    exports.ImageViewerModule = ImageViewerModule;
    exports.createButtonConfig = createButtonConfig;
    exports.ɵa = IMAGEVIEWER_CONFIG_DEFAULT;
    exports.ɵb = ImageCacheService;

    Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=emazv72-ngx-imageviewer.umd.js.map
