import { InjectionToken, ɵɵdefineInjectable, ɵsetClassMetadata, Injectable, ɵɵdirectiveInject, Renderer2, ɵɵdefineComponent, ɵɵviewQuery, ɵɵqueryRefresh, ɵɵloadQuery, ɵɵelementStart, ɵɵlistener, ɵɵelementEnd, ɵɵproperty, Component, Inject, Input, ViewChild, ɵɵdefineNgModule, ɵɵdefineInjector, ɵɵsetNgModuleScope, NgModule } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { Subject } from 'rxjs';

class ImageViewerConfig {
}
function createButtonConfig(icon, tooltip, sortId = 0, show = true) {
    return { icon: icon, tooltip: tooltip, sortId: sortId, show: show };
}
const IMAGEVIEWER_CONFIG = new InjectionToken('imageviewer.config');
let IMAGEVIEWER_CONFIG_DEFAULT = {
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

class Button {
    //#endregion
    //#region Lifecycle events
    constructor(config, style) {
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
    onClick(evt) { alert('no click action set!'); return true; }
    // mouse down action
    onMouseDown(evt) { return false; }
    //#endregion
    //#region Draw Button
    draw(ctx, x, y, radius) {
        this.drawPosition = { x: x, y: y };
        this.drawRadius = radius;
        // preserve context
        ctx.save();
        // drawing settings
        const isHover = (typeof this.hover === 'function') ? this.hover() : this.hover;
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
    }
    drawIconFont(ctx, centreX, centreY, size) {
        // font settings
        ctx.font = size + 'px ' + this.style.iconFontFamily;
        ctx.fillStyle = this.style.iconStyle;
        // calculate position
        const textSize = ctx.measureText(this.icon);
        const x = centreX - textSize.width / 2;
        const y = centreY + size / 2;
        // draw it
        ctx.fillText(this.icon, x, y);
    }
    //#endregion
    //#region Utils
    isWithinBounds(x, y) {
        if (this.drawPosition === null) {
            return false;
        }
        const dx = Math.abs(this.drawPosition.x - x), dy = Math.abs(this.drawPosition.y - y);
        return dx * dx + dy * dy <= this.drawRadius * this.drawRadius;
    }
}
class Viewport {
    constructor(width, height, scale, rotation, x, y) {
        this.width = width;
        this.height = height;
        this.scale = scale;
        this.rotation = rotation;
        this.x = x;
        this.y = y;
    }
}
class ResourceLoader {
    constructor() {
        this.viewport = { width: 0, height: 0, scale: 1, rotation: 0, x: 0, y: 0 };
        this.minScale = 0;
        this.maxScale = 4;
        this.currentItem = 1;
        this.totalItem = 1;
        this.showItemsQuantity = false;
        this.loaded = false;
        this.loading = false;
        this.rendering = false;
        this.resourceChange = new Subject();
    }
    resetViewport(canvasDim) {
        if (!this.loaded || !canvasDim) {
            return;
        }
        const rotation = this.viewport ? this.viewport.rotation : 0;
        const inverted = toSquareAngle(rotation) / 90 % 2 !== 0;
        const canvas = {
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
    }
    draw(ctx, config, canvasDim, onFinish) {
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
    }
    onResourceChange() { return this.resourceChange.asObservable(); }
}
function toSquareAngle(angle) {
    return 90 * ((Math.trunc(angle / 90) + (Math.trunc(angle % 90) > 45 ? 1 : 0)) % 4);
}

class ImageResourceLoader extends ResourceLoader {
    setUp() {
        this.loadResource();
    }
    loadResource() {
        this.loading = true;
        this._image = new Image();
        this._image.addEventListener('load', (evt) => {
            this.loaded = true;
            this.loading = false;
            this.resourceChange.next();
        }, false);
        this._image.src = this.src;
    }
}

class ImageCacheService {
    constructor() {
        this._cache = [];
    }
    get cache() {
        return this._cache;
    }
    getCache(url, page) {
        return this.cache.find(i => i.url === url && i.page === page);
    }
    getImage(url, page) {
        const c = this.getCache(url, page);
        return c ? c.image : null;
    }
    saveImage(url, page, image) {
        const cache = this.getCache(url, page);
        if (cache) {
            cache.image = image;
        }
        else {
            this.cache.push({ url, page, image });
        }
    }
    disposeCache() {
        this.cache.forEach(i => URL.revokeObjectURL(i.image.src));
        this._cache = [];
    }
}
ImageCacheService.ɵfac = function ImageCacheService_Factory(t) { return new (t || ImageCacheService)(); };
ImageCacheService.ɵprov = ɵɵdefineInjectable({ token: ImageCacheService, factory: ImageCacheService.ɵfac, providedIn: 'root' });
/*@__PURE__*/ (function () { ɵsetClassMetadata(ImageCacheService, [{
        type: Injectable,
        args: [{ providedIn: 'root' }]
    }], function () { return []; }, null); })();

class PdfResourceLoader extends ResourceLoader {
    constructor(_imageCache) {
        super();
        this._imageCache = _imageCache;
        if (typeof window !== 'undefined' && 'Worker' in window) {
            if (pdfjsLib && pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
                pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
            }
        }
        this.showItemsQuantity = true;
    }
    setUp() {
        const vm = this;
        if (vm.loading || !vm.src) {
            return;
        }
        const loadingTask = pdfjsLib.getDocument(vm.src);
        vm.loading = true;
        vm.currentItem = 1;
        loadingTask.then((pdf) => {
            vm._pdf = pdf;
            vm.totalItem = pdf.numPages;
            vm.loaded = true;
            vm.loadResource();
        }, (reason) => {
            console.error(reason);
        });
    }
    loadResource() {
        const vm = this;
        if (!vm.loaded) {
            vm._pendingReload = true;
            return;
        }
        vm.loaded = false;
        const url = vm.src;
        const page = vm.currentItem;
        vm._pdf.getPage(page).then((pdfPage) => {
            vm._page = pdfPage;
            vm.loadImage(url, page, () => {
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
    }
    loadImage(src, page, onFinish) {
        const vm = this;
        const cacheimg = vm._imageCache.getImage(src, page);
        if (cacheimg) {
            vm._image = cacheimg;
            onFinish();
            return;
        }
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        const pageVp = vm._page.getViewport(2);
        canvas.width = pageVp.width;
        canvas.height = pageVp.height;
        const renderContext = {
            canvasContext: context,
            viewport: pageVp
        };
        const renderTask = vm._page.render(renderContext);
        renderTask.then(function () {
            canvas.toBlob(blob => {
                const img = new Image();
                img.onload = onFinish;
                img.src = URL.createObjectURL(blob);
                vm._imageCache.saveImage(src, page, img);
                vm._image = img;
            });
        });
    }
}

const _c0 = ["imageContainer"];
const MIN_TOOLTIP_WIDTH_SPACE = 500;
class ImageViewerComponent {
    //#endregion
    //#region Lifecycle events
    constructor(_sanitizer, _renderer, _imageCache, config) {
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
        ].filter(item => item.display)
            .sort((a, b) => a.sortId - b.sortId);
    }
    get src() { return this._src; }
    set src(value) {
        if (value === this._src) {
            return;
        }
        this._src = value;
        this.setUpResource();
    }
    get filetype() { return this._filetype; }
    set filetype(value) {
        if (value === this._filetype) {
            return;
        }
        this._filetype = value;
        this.setUpResource();
    }
    get width() { return this._width; }
    set width(value) {
        if (value === this._width) {
            return;
        }
        this._width = value;
        if (this._canvas) {
            this._canvas.width = this._width;
        }
        this.resetImage();
    }
    get height() { return this._height; }
    set height(value) {
        if (value === this._height) {
            return;
        }
        this._height = value;
        if (this._canvas) {
            this._canvas.height = this._height;
        }
        this.resetImage();
    }
    ngAfterViewInit() {
        this._canvas = this.canvasRef.nativeElement;
        this._context = this._canvas.getContext('2d');
        // setting canvas dimention
        this._canvas.width = this.width || this.config.width;
        this._canvas.height = this.height || this.config.height;
        // setting buttons actions
        this._nextPageButton.onClick = (evt) => { this.nextPage(); return false; };
        this._beforePageButton.onClick = (evt) => { this.previousPage(); return false; };
        this._zoomOutButton.onClick = (evt) => { this.zoomOut(); return false; };
        this._zoomInButton.onClick = (evt) => { this.zoomIn(); return false; };
        this._rotateLeftButton.onClick = (evt) => { this.rotateLeft(); return false; };
        this._rotateRightButton.onClick = (evt) => { this.rotateRight(); return false; };
        this._resetButton.onClick = (evt) => { this.resetImage(); return false; };
        // register event listeners
        this.addEventListeners();
        this.updateCanvas();
    }
    ngOnDestroy() {
        // unregiste event listeners
        this._listenDestroyList.forEach(listenDestroy => {
            if (typeof listenDestroy === 'function') {
                listenDestroy();
            }
        });
        this._imageCache.disposeCache();
    }
    setUpResource() {
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
            this._resourceChangeSub = this._resource.onResourceChange().subscribe(() => {
                this.updateCanvas();
                if (this.src instanceof File) {
                    URL.revokeObjectURL(this._resource.src);
                }
            });
            this._resource.setUp();
            this.resetImage();
            if (this._context) {
                this.updateCanvas();
            }
        }
    }
    //#endregion
    //#region Touch events
    onTap(evt) {
        const position = { x: evt.pageX, y: evt.pageY };
        const activeElement = this.getUIElement(this.screenToCanvasCentre(position));
        if (activeElement !== null) {
            activeElement.onClick(evt);
        }
    }
    onTouchEnd() {
        this._touchStartState.viewport = undefined;
        this._touchStartState.scale = undefined;
        this._touchStartState.rotate = undefined;
    }
    processTouchEvent(evt) {
        // process pan
        if (!this._touchStartState.viewport) {
            this._touchStartState.viewport = Object.assign({}, this._resource.viewport);
        }
        const viewport = this._resource.viewport;
        viewport.x = this._touchStartState.viewport.x + evt.deltaX;
        viewport.y = this._touchStartState.viewport.y + evt.deltaY;
        // process pinch in/out
        if (!this._touchStartState.scale) {
            this._touchStartState.scale = this._resource.viewport.scale;
        }
        const newScale = this._touchStartState.scale * evt.scale;
        viewport.scale = newScale > this._resource.maxScale ? this._resource.maxScale :
            newScale < this._resource.minScale ? this._resource.minScale : newScale;
        // process rotate left/right
        if (!this._touchStartState.rotate) {
            this._touchStartState.rotate = { rotation: viewport.rotation, startRotate: evt.rotation };
        }
        if (evt.rotation !== 0) {
            const newAngle = this._touchStartState.rotate.rotation + evt.rotation - this._touchStartState.rotate.startRotate;
            viewport.rotation = this.config.rotateStepper ? toSquareAngle(newAngle) : newAngle;
        }
        this._dirty = true;
    }
    //#endregion
    //#region Mouse Events
    addEventListeners() {
        // zooming
        this._listenDestroyList.push(this._renderer.listen(this._canvas, 'DOMMouseScroll', (evt) => this.onMouseWheel(evt)));
        this._listenDestroyList.push(this._renderer.listen(this._canvas, 'mousewheel', (evt) => this.onMouseWheel(evt)));
        // show tooltip when mouseover it
        this._listenDestroyList.push(this._renderer.listen(this._canvas, 'mousemove', (evt) => this.checkTooltipActivation(this.screenToCanvasCentre({ x: evt.clientX, y: evt.clientY }))));
    }
    onMouseWheel(evt) {
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
    }
    checkTooltipActivation(pos) {
        this.getUIElements().forEach(x => x.hover = false);
        const activeElement = this.getUIElement(pos);
        const oldToolTip = this._currentTooltip;
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
    }
    //#endregion
    //#region Button Actions
    nextPage() {
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
    }
    previousPage() {
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
    }
    zoomIn() {
        if (!this._resource) {
            return;
        }
        const newScale = this._resource.viewport.scale * (1 + this.config.scaleStep);
        this._resource.viewport.scale = newScale > this._resource.maxScale ? this._resource.maxScale : newScale;
        this._dirty = true;
    }
    zoomOut() {
        if (!this._resource) {
            return;
        }
        const newScale = this._resource.viewport.scale * (1 - this.config.scaleStep);
        this._resource.viewport.scale = newScale < this._resource.minScale ? this._resource.minScale : newScale;
        this._dirty = true;
    }
    rotateLeft() {
        if (!this._resource) {
            return;
        }
        const viewport = this._resource.viewport;
        viewport.rotation = viewport.rotation === 0 ? 270 : viewport.rotation - 90;
        this._dirty = true;
    }
    rotateRight() {
        if (!this._resource) {
            return;
        }
        const viewport = this._resource.viewport;
        viewport.rotation = viewport.rotation === 270 ? 0 : viewport.rotation + 90;
        this._dirty = true;
    }
    resetImage() {
        if (!this._resource) {
            return;
        }
        this._resource.resetViewport(this._canvas);
        this._dirty = true;
    }
    //#endregion
    //#region Draw Canvas
    updateCanvas() {
        this.resetImage();
        // start new render loop
        this.render();
    }
    render() {
        const vm = this;
        // only re-render if dirty
        if (this._dirty && this._resource) {
            this._dirty = false;
            const ctx = this._context;
            ctx.save();
            this._resource.draw(ctx, this.config, this._canvas, () => {
                ctx.restore();
                if (vm._resource.loaded) {
                    // draw buttons
                    this.drawButtons(ctx);
                    // draw paginator
                    if (this._resource.showItemsQuantity) {
                        this.drawPaginator(ctx);
                    }
                }
            });
        }
        requestAnimationFrame(() => this.render());
    }
    drawButtons(ctx) {
        const padding = this.config.tooltips.padding;
        const radius = this.config.tooltips.radius;
        const gap = 2 * radius + padding;
        const x = this._canvas.width - radius - padding;
        const y = this._canvas.height - radius - padding;
        // draw buttons
        for (let i = 0; i < this._buttons.length; i++) {
            this._buttons[i].draw(ctx, x, y - gap * i, radius);
        }
        // draw tooltip
        if (this._currentTooltip !== null && this._canvas.width > MIN_TOOLTIP_WIDTH_SPACE) {
            ctx.save();
            const fontSize = radius;
            ctx.font = fontSize + 'px sans-serif';
            // calculate position
            const textSize = ctx.measureText(this._currentTooltip).width, rectWidth = textSize + padding, rectHeight = fontSize * 0.70 + padding, rectX = this._canvas.width
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
    }
    drawPaginator(ctx) {
        const padding = this.config.tooltips.padding;
        const radius = this.config.tooltips.radius;
        const labelWidth = 50;
        const x1 = (this._canvas.width - labelWidth) / 2 - radius - padding; // PrevPageButton
        const x2 = this._canvas.width / 2; // Label
        const x3 = (this._canvas.width + labelWidth) / 2 + radius + padding; // NextPageButton
        const y = this._canvas.height - radius - padding;
        const label = this._resource.currentItem + '/' + this._resource.totalItem;
        const fontSize = 25;
        ctx.save();
        this._beforePageButton.draw(ctx, x1, y, radius);
        this._nextPageButton.draw(ctx, x3, y, radius);
        ctx.restore();
        ctx.save();
        ctx.font = fontSize + 'px Verdana';
        ctx.textAlign = 'center';
        ctx.fillText(label, x2, this._canvas.height - padding - fontSize / 2, labelWidth);
        ctx.restore();
    }
    drawRoundRectangle(ctx, x, y, width, height, radius, fill, stroke) {
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
    }
    //#endregion
    //#region Utils
    extendsDefaultConfig(cfg) {
        const defaultCfg = IMAGEVIEWER_CONFIG_DEFAULT;
        const localCfg = Object.assign({}, defaultCfg, cfg);
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
    }
    screenToCanvasCentre(pos) {
        const rect = this._canvas.getBoundingClientRect();
        return { x: pos.x - rect.left, y: pos.y - rect.top };
    }
    getUIElements() {
        const hoverElements = this._buttons.slice();
        hoverElements.push(this._nextPageButton);
        hoverElements.push(this._beforePageButton);
        return hoverElements;
    }
    getUIElement(pos) {
        const activeUIElement = this.getUIElements().filter((uiElement) => {
            return uiElement.isWithinBounds(pos.x, pos.y);
        });
        return (activeUIElement.length > 0) ? activeUIElement[0] : null;
    }
    isImage(file) {
        if (this._filetype && this._filetype.toLowerCase() === 'image') {
            return true;
        }
        return testFile(file, '\\.(png|jpg|jpeg|gif)|image/png');
    }
    isPdf(file) {
        if (this._filetype && this._filetype.toLowerCase() === 'pdf') {
            return true;
        }
        return testFile(file, '\\.(pdf)|application/pdf');
    }
}
ImageViewerComponent.ɵfac = function ImageViewerComponent_Factory(t) { return new (t || ImageViewerComponent)(ɵɵdirectiveInject(DomSanitizer), ɵɵdirectiveInject(Renderer2), ɵɵdirectiveInject(ImageCacheService), ɵɵdirectiveInject(IMAGEVIEWER_CONFIG)); };
ImageViewerComponent.ɵcmp = ɵɵdefineComponent({ type: ImageViewerComponent, selectors: [["ngx-imageviewer"]], viewQuery: function ImageViewerComponent_Query(rf, ctx) { if (rf & 1) {
        ɵɵviewQuery(_c0, true);
    } if (rf & 2) {
        var _t;
        ɵɵqueryRefresh(_t = ɵɵloadQuery()) && (ctx.canvasRef = _t.first);
    } }, inputs: { src: "src", filetype: "filetype", width: "width", height: "height" }, decls: 2, vars: 2, consts: [[3, "width", "height", "click", "pinchin", "pinchout", "panmove", "panend", "rotatemove", "rotateend"], ["imageContainer", ""]], template: function ImageViewerComponent_Template(rf, ctx) { if (rf & 1) {
        ɵɵelementStart(0, "canvas", 0, 1);
        ɵɵlistener("click", function ImageViewerComponent_Template_canvas_click_0_listener($event) { return ctx.onTap($event); })("pinchin", function ImageViewerComponent_Template_canvas_pinchin_0_listener($event) { return ctx.processTouchEvent($event); })("pinchout", function ImageViewerComponent_Template_canvas_pinchout_0_listener($event) { return ctx.processTouchEvent($event); })("panmove", function ImageViewerComponent_Template_canvas_panmove_0_listener($event) { return ctx.processTouchEvent($event); })("panend", function ImageViewerComponent_Template_canvas_panend_0_listener() { return ctx.onTouchEnd(); })("rotatemove", function ImageViewerComponent_Template_canvas_rotatemove_0_listener($event) { return ctx.processTouchEvent($event); })("rotateend", function ImageViewerComponent_Template_canvas_rotateend_0_listener() { return ctx.onTouchEnd(); });
        ɵɵelementEnd();
    } if (rf & 2) {
        ɵɵproperty("width", ctx.width)("height", ctx.height);
    } }, styles: ["[_nghost-%COMP%] { display: block }\n    [_nghost-%COMP%]   canvas[_ngcontent-%COMP%] { margin: 0 auto; display: block }\n    [hidden][_ngcontent-%COMP%] { display: none !important }"] });
/*@__PURE__*/ (function () { ɵsetClassMetadata(ImageViewerComponent, [{
        type: Component,
        args: [{
                selector: 'ngx-imageviewer',
                template: `
    <canvas #imageContainer [width]="width" [height]="height"
      (click)="onTap($event)" (pinchin)="processTouchEvent($event)" (pinchout)="processTouchEvent($event)"
      (panmove)="processTouchEvent($event)" (panend)="onTouchEnd()" (rotatemove)="processTouchEvent($event)"
      (rotateend)="onTouchEnd()">
    </canvas>
  `,
                styles: [`
    :host { display: block }
    :host canvas { margin: 0 auto; display: block }
    [hidden] { display: none !important }
  `]
            }]
    }], function () { return [{ type: DomSanitizer }, { type: Renderer2 }, { type: ImageCacheService }, { type: ImageViewerConfig, decorators: [{
                type: Inject,
                args: [IMAGEVIEWER_CONFIG]
            }] }]; }, { src: [{
            type: Input,
            args: ['src']
        }], filetype: [{
            type: Input,
            args: ['filetype']
        }], width: [{
            type: Input,
            args: ['width']
        }], height: [{
            type: Input,
            args: ['height']
        }], canvasRef: [{
            type: ViewChild,
            args: ['imageContainer', { static: false }]
        }] }); })();
function testFile(file, regexTest) {
    if (!file) {
        return false;
    }
    const name = file instanceof File ? file.name : file;
    return name.toLowerCase().match(regexTest) !== null;
}

class ImageViewerModule {
}
ImageViewerModule.ɵmod = ɵɵdefineNgModule({ type: ImageViewerModule });
ImageViewerModule.ɵinj = ɵɵdefineInjector({ factory: function ImageViewerModule_Factory(t) { return new (t || ImageViewerModule)(); }, providers: [{ provide: IMAGEVIEWER_CONFIG, useValue: IMAGEVIEWER_CONFIG_DEFAULT }] });
(function () { (typeof ngJitMode === "undefined" || ngJitMode) && ɵɵsetNgModuleScope(ImageViewerModule, { declarations: [ImageViewerComponent], exports: [ImageViewerComponent] }); })();
/*@__PURE__*/ (function () { ɵsetClassMetadata(ImageViewerModule, [{
        type: NgModule,
        args: [{
                providers: [{ provide: IMAGEVIEWER_CONFIG, useValue: IMAGEVIEWER_CONFIG_DEFAULT }],
                declarations: [ImageViewerComponent],
                exports: [ImageViewerComponent],
            }]
    }], null, null); })();

/*
 * Public API Surface of ngx-imageviewer
 */

/**
 * Generated bundle index. Do not edit.
 */

export { IMAGEVIEWER_CONFIG, ImageViewerComponent, ImageViewerConfig, ImageViewerModule, createButtonConfig };
//# sourceMappingURL=emazv72-ngx-imageviewer.js.map
