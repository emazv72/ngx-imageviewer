import { Component, Input, ViewChild, Renderer2, Inject } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { ImageViewerConfig, IMAGEVIEWER_CONFIG, IMAGEVIEWER_CONFIG_DEFAULT } from './imageviewer.config';
import { Button, toSquareAngle } from './imageviewer.model';
import { ImageResourceLoader } from './image.loader';
import { ImageCacheService } from './imagecache.service';
import { PdfResourceLoader } from './pdf.loader';
import * as i0 from "@angular/core";
import * as i1 from "@angular/platform-browser";
import * as i2 from "./imagecache.service";
import * as i3 from "./imageviewer.config";
const _c0 = ["imageContainer"];
const MIN_TOOLTIP_WIDTH_SPACE = 500;
export class ImageViewerComponent {
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
ImageViewerComponent.ɵfac = function ImageViewerComponent_Factory(t) { return new (t || ImageViewerComponent)(i0.ɵɵdirectiveInject(i1.DomSanitizer), i0.ɵɵdirectiveInject(i0.Renderer2), i0.ɵɵdirectiveInject(i2.ImageCacheService), i0.ɵɵdirectiveInject(IMAGEVIEWER_CONFIG)); };
ImageViewerComponent.ɵcmp = i0.ɵɵdefineComponent({ type: ImageViewerComponent, selectors: [["ngx-imageviewer"]], viewQuery: function ImageViewerComponent_Query(rf, ctx) { if (rf & 1) {
        i0.ɵɵviewQuery(_c0, true);
    } if (rf & 2) {
        var _t;
        i0.ɵɵqueryRefresh(_t = i0.ɵɵloadQuery()) && (ctx.canvasRef = _t.first);
    } }, inputs: { src: "src", filetype: "filetype", width: "width", height: "height" }, decls: 2, vars: 2, consts: [[3, "width", "height", "click", "pinchin", "pinchout", "panmove", "panend", "rotatemove", "rotateend"], ["imageContainer", ""]], template: function ImageViewerComponent_Template(rf, ctx) { if (rf & 1) {
        i0.ɵɵelementStart(0, "canvas", 0, 1);
        i0.ɵɵlistener("click", function ImageViewerComponent_Template_canvas_click_0_listener($event) { return ctx.onTap($event); })("pinchin", function ImageViewerComponent_Template_canvas_pinchin_0_listener($event) { return ctx.processTouchEvent($event); })("pinchout", function ImageViewerComponent_Template_canvas_pinchout_0_listener($event) { return ctx.processTouchEvent($event); })("panmove", function ImageViewerComponent_Template_canvas_panmove_0_listener($event) { return ctx.processTouchEvent($event); })("panend", function ImageViewerComponent_Template_canvas_panend_0_listener() { return ctx.onTouchEnd(); })("rotatemove", function ImageViewerComponent_Template_canvas_rotatemove_0_listener($event) { return ctx.processTouchEvent($event); })("rotateend", function ImageViewerComponent_Template_canvas_rotateend_0_listener() { return ctx.onTouchEnd(); });
        i0.ɵɵelementEnd();
    } if (rf & 2) {
        i0.ɵɵproperty("width", ctx.width)("height", ctx.height);
    } }, styles: ["[_nghost-%COMP%] { display: block }\n    [_nghost-%COMP%]   canvas[_ngcontent-%COMP%] { margin: 0 auto; display: block }\n    [hidden][_ngcontent-%COMP%] { display: none !important }"] });
/*@__PURE__*/ (function () { i0.ɵsetClassMetadata(ImageViewerComponent, [{
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
    }], function () { return [{ type: i1.DomSanitizer }, { type: i0.Renderer2 }, { type: i2.ImageCacheService }, { type: i3.ImageViewerConfig, decorators: [{
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW1hZ2V2aWV3ZXIuY29tcG9uZW50LmpzIiwic291cmNlUm9vdCI6Ii9ob21lL3RyYXZpcy9idWlsZC9lbWF6djcyL25neC1pbWFnZXZpZXdlci9wcm9qZWN0cy9uZ3gtaW1hZ2V2aWV3ZXIvc3JjLyIsInNvdXJjZXMiOlsibGliL2ltYWdldmlld2VyLmNvbXBvbmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsU0FBUyxFQUFFLEtBQUssRUFBRSxTQUFTLEVBQWlCLFNBQVMsRUFBRSxNQUFNLEVBQWEsTUFBTSxlQUFlLENBQUM7QUFDekcsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBR3pELE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxrQkFBa0IsRUFBRSwwQkFBMEIsRUFBNkIsTUFBTSxzQkFBc0IsQ0FBQztBQUNwSSxPQUFPLEVBQVksTUFBTSxFQUFFLGFBQWEsRUFBa0IsTUFBTSxxQkFBcUIsQ0FBQztBQUN0RixPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSxnQkFBZ0IsQ0FBQztBQUNyRCxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxzQkFBc0IsQ0FBQztBQUN6RCxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxjQUFjLENBQUM7Ozs7OztBQUVqRCxNQUFNLHVCQUF1QixHQUFHLEdBQUcsQ0FBQztBQWlCcEMsTUFBTSxPQUFPLG9CQUFvQjtJQThFL0IsWUFBWTtJQUVaLDBCQUEwQjtJQUMxQixZQUNVLFVBQXdCLEVBQ3hCLFNBQW9CLEVBQ3BCLFdBQThCLEVBQ0YsTUFBeUI7UUFIckQsZUFBVSxHQUFWLFVBQVUsQ0FBYztRQUN4QixjQUFTLEdBQVQsU0FBUyxDQUFXO1FBQ3BCLGdCQUFXLEdBQVgsV0FBVyxDQUFtQjtRQUNGLFdBQU0sR0FBTixNQUFNLENBQW1CO1FBdkMvRCxjQUFjO1FBQ04sV0FBTSxHQUFHLElBQUksQ0FBQztRQVd0Qiw4QkFBOEI7UUFDdEIsYUFBUSxHQUFHLEVBQUUsQ0FB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QUMsQ0FBQyxJQUFJLENBQUM7SUFDckQsT0FBTyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxLQUFLLElBQUksQ0FBQztBQUN0RCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQ29tcG9uZW50LCBJbnB1dCwgVmlld0NoaWxkLCBBZnRlclZpZXdJbml0LCBSZW5kZXJlcjIsIEluamVjdCwgT25EZXN0cm95IH0gZnJvbSAnQGFuZ3VsYXIvY29yZSc7XG5pbXBvcnQgeyBEb21TYW5pdGl6ZXIgfSBmcm9tICdAYW5ndWxhci9wbGF0Zm9ybS1icm93c2VyJztcbmltcG9ydCB7IFN1YnNjcmlwdGlvbiB9IGZyb20gJ3J4anMnO1xuXG5pbXBvcnQgeyBJbWFnZVZpZXdlckNvbmZpZywgSU1BR0VWSUVXRVJfQ09ORklHLCBJTUFHRVZJRVdFUl9DT05GSUdfREVGQVVMVCwgQnV0dG9uQ29uZmlnLCBCdXR0b25TdHlsZSB9IGZyb20gJy4vaW1hZ2V2aWV3ZXIuY29uZmlnJztcbmltcG9ydCB7IFZpZXdwb3J0LCBCdXR0b24sIHRvU3F1YXJlQW5nbGUsIFJlc291cmNlTG9hZGVyIH0gZnJvbSAnLi9pbWFnZXZpZXdlci5tb2RlbCc7XG5pbXBvcnQgeyBJbWFnZVJlc291cmNlTG9hZGVyIH0gZnJvbSAnLi9pbWFnZS5sb2FkZXInO1xuaW1wb3J0IHsgSW1hZ2VDYWNoZVNlcnZpY2UgfSBmcm9tICcuL2ltYWdlY2FjaGUuc2VydmljZSc7XG5pbXBvcnQgeyBQZGZSZXNvdXJjZUxvYWRlciB9IGZyb20gJy4vcGRmLmxvYWRlcic7XG5cbmNvbnN0IE1JTl9UT09MVElQX1dJRFRIX1NQQUNFID0gNTAwO1xuXG5AQ29tcG9uZW50KHtcbiAgc2VsZWN0b3I6ICduZ3gtaW1hZ2V2aWV3ZXInLFxuICB0ZW1wbGF0ZTogYFxuICAgIDxjYW52YXMgI2ltYWdlQ29udGFpbmVyIFt3aWR0aF09XCJ3aWR0aFwiIFtoZWlnaHRdPVwiaGVpZ2h0XCJcbiAgICAgIChjbGljayk9XCJvblRhcCgkZXZlbnQpXCIgKHBpbmNoaW4pPVwicHJvY2Vzc1RvdWNoRXZlbnQoJGV2ZW50KVwiIChwaW5jaG91dCk9XCJwcm9jZXNzVG91Y2hFdmVudCgkZXZlbnQpXCJcbiAgICAgIChwYW5tb3ZlKT1cInByb2Nlc3NUb3VjaEV2ZW50KCRldmVudClcIiAocGFuZW5kKT1cIm9uVG91Y2hFbmQoKVwiIChyb3RhdGVtb3ZlKT1cInByb2Nlc3NUb3VjaEV2ZW50KCRldmVudClcIlxuICAgICAgKHJvdGF0ZWVuZCk9XCJvblRvdWNoRW5kKClcIj5cbiAgICA8L2NhbnZhcz5cbiAgYCxcbiAgc3R5bGVzOiBbYFxuICAgIDpob3N0IHsgZGlzcGxheTogYmxvY2sgfVxuICAgIDpob3N0IGNhbnZhcyB7IG1hcmdpbjogMCBhdXRvOyBkaXNwbGF5OiBibG9jayB9XG4gICAgW2hpZGRlbl0geyBkaXNwbGF5OiBub25lICFpbXBvcnRhbnQgfVxuICBgXVxufSlcbmV4cG9ydCBjbGFzcyBJbWFnZVZpZXdlckNvbXBvbmVudCBpbXBsZW1lbnRzIEFmdGVyVmlld0luaXQsIE9uRGVzdHJveSB7XG5cbiAgLy8jcmVnaW9uIElucHV0IHByb3BlcnRpZXNcbiAgcHJpdmF0ZSBfc3JjOiBzdHJpbmcgfCBGaWxlO1xuICBnZXQgc3JjKCkgeyByZXR1cm4gdGhpcy5fc3JjOyB9XG4gIEBJbnB1dCgnc3JjJykgc2V0IHNyYyh2YWx1ZSkge1xuICAgIGlmICh2YWx1ZSA9PT0gdGhpcy5fc3JjKSB7IHJldHVybjsgfVxuICAgIHRoaXMuX3NyYyA9IHZhbHVlO1xuICAgIHRoaXMuc2V0VXBSZXNvdXJjZSgpO1xuICB9XG5cbiAgLy8gRklYIG5vdCB3b3JraWduIHByb3Blcmx5XG4gIHByaXZhdGUgX2ZpbGV0eXBlOiBzdHJpbmc7XG4gIGdldCBmaWxldHlwZSgpIHsgcmV0dXJuIHRoaXMuX2ZpbGV0eXBlOyB9XG4gIEBJbnB1dCgnZmlsZXR5cGUnKSBzZXQgZmlsZXR5cGUodmFsdWU6IHN0cmluZykge1xuICAgIGlmICh2YWx1ZSA9PT0gdGhpcy5fZmlsZXR5cGUpIHsgcmV0dXJuOyB9XG4gICAgdGhpcy5fZmlsZXR5cGUgPSB2YWx1ZTtcbiAgICB0aGlzLnNldFVwUmVzb3VyY2UoKTtcbiAgfVxuXG4gIHByaXZhdGUgX3dpZHRoOiBudW1iZXI7XG4gIGdldCB3aWR0aCgpIHsgcmV0dXJuIHRoaXMuX3dpZHRoOyB9XG4gIEBJbnB1dCgnd2lkdGgnKSBzZXQgd2lkdGgodmFsdWUpIHtcbiAgICBpZiAodmFsdWUgPT09IHRoaXMuX3dpZHRoKSB7IHJldHVybjsgfVxuICAgIHRoaXMuX3dpZHRoID0gdmFsdWU7XG4gICAgaWYgKHRoaXMuX2NhbnZhcykgeyB0aGlzLl9jYW52YXMud2lkdGggPSB0aGlzLl93aWR0aDsgfVxuICAgIHRoaXMucmVzZXRJbWFnZSgpO1xuICB9XG5cbiAgcHJpdmF0ZSBfaGVpZ2h0OiBudW1iZXI7XG4gIGdldCBoZWlnaHQoKSB7IHJldHVybiB0aGlzLl9oZWlnaHQ7IH1cbiAgQElucHV0KCdoZWlnaHQnKSBzZXQgaGVpZ2h0KHZhbHVlKSB7XG4gICAgaWYgKHZhbHVlID09PSB0aGlzLl9oZWlnaHQpIHsgcmV0dXJuOyB9XG4gICAgdGhpcy5faGVpZ2h0ID0gdmFsdWU7XG4gICAgaWYgKHRoaXMuX2NhbnZhcykgeyB0aGlzLl9jYW52YXMuaGVpZ2h0ID0gdGhpcy5faGVpZ2h0OyB9XG4gICAgdGhpcy5yZXNldEltYWdlKCk7XG4gIH1cblxuICBAVmlld0NoaWxkKCdpbWFnZUNvbnRhaW5lcicsIHtzdGF0aWM6IGZhbHNlfSkgY2FudmFzUmVmOiBhbnk7XG4gIC8vI2VuZHJlZ2lvblxuXG4gIC8vI3JlZ2lvbiBQcml2YXRlIHByb3BlcnRpZXNcbiAgLy8gQ2FudmFzIDJEIGNvbnRleHRcbiAgcHJpdmF0ZSBfY2FudmFzOiBIVE1MQ2FudmFzRWxlbWVudDtcbiAgcHJpdmF0ZSBfY29udGV4dDogQ2FudmFzUmVuZGVyaW5nQ29udGV4dDJEO1xuXG4gIC8vIGRpcnR5IHN0YXRlXG4gIHByaXZhdGUgX2RpcnR5ID0gdHJ1ZTtcblxuICAvLyBhY3Rpb24gYnV0dG9uc1xuICBwcml2YXRlIF9uZXh0UGFnZUJ1dHRvbjogQnV0dG9uO1xuICBwcml2YXRlIF9iZWZvcmVQYWdlQnV0dG9uOiBCdXR0b247XG4gIHByaXZhdGUgX3pvb21PdXRCdXR0b246IEJ1dHRvbjtcbiAgcHJpdmF0ZSBfem9vbUluQnV0dG9uOiBCdXR0b247XG4gIHByaXZhdGUgX3JvdGF0ZUxlZnRCdXR0b246IEJ1dHRvbjtcbiAgcHJpdmF0ZSBfcm90YXRlUmlnaHRCdXR0b246IEJ1dHRvbjtcbiAgcHJpdmF0ZSBfcmVzZXRCdXR0b246IEJ1dHRvbjtcblxuICAvLyBjb250YWlucyBhbGwgYWN0aXZlIGJ1dHRvbnNcbiAgcHJpdmF0ZSBfYnV0dG9ucyA9IFtdO1xuXG4gIC8vIGN1cnJlbnQgdG9vbCB0aXAgKHVzZWQgdG8gdHJhY2sgY2hhbmdlIG9mIHRvb2wgdGlwKVxuICBwcml2YXRlIF9jdXJyZW50VG9vbHRpcCA9IG51bGw7XG5cbiAgLy8gY2FjaGVkIGRhdGEgd2hlbiB0b3VjaCBldmVudHMgc3RhcnRlZFxuICBwcml2YXRlIF90b3VjaFN0YXJ0U3RhdGU6IGFueSA9IHt9O1xuXG4gIC8vIGxpc3Qgb2YgZXZlbnQgbGlzdGVuZXIgZGVzdHJveWVyc1xuICBwcml2YXRlIF9saXN0ZW5EZXN0cm95TGlzdCA9IFtdO1xuXG4gIC8vIGltYWdlIC8gUGRmIERyYXdhYmxlIFJlc291cmNlXG4gIHByaXZhdGUgX3Jlc291cmNlOiBSZXNvdXJjZUxvYWRlcjtcbiAgcHJpdmF0ZSBfcmVzb3VyY2VDaGFuZ2VTdWI6IFN1YnNjcmlwdGlvbjtcblxuICAvLyBDYWNoaW5nIHJlc291cmNlTG9hZGVyIGluc3RhbmNlcyB0byByZXVzZVxuICBwcml2YXRlIF9pbWFnZVJlc291cmNlOiBJbWFnZVJlc291cmNlTG9hZGVyO1xuICBwcml2YXRlIF9wZGZSZXNvdXJjZTogUGRmUmVzb3VyY2VMb2FkZXI7XG5cbiAgLy8jZW5kcmVnaW9uXG5cbiAgLy8jcmVnaW9uIExpZmVjeWNsZSBldmVudHNcbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSBfc2FuaXRpemVyOiBEb21TYW5pdGl6ZXIsXG4gICAgcHJpdmF0ZSBfcmVuZGVyZXI6IFJlbmRlcmVyMixcbiAgICBwcml2YXRlIF9pbWFnZUNhY2hlOiBJbWFnZUNhY2hlU2VydmljZSxcbiAgICBASW5qZWN0KElNQUdFVklFV0VSX0NPTkZJRykgcHJpdmF0ZSBjb25maWc6IEltYWdlVmlld2VyQ29uZmlnXG4gICkge1xuICAgIHRoaXMuY29uZmlnID0gdGhpcy5leHRlbmRzRGVmYXVsdENvbmZpZyhjb25maWcpO1xuICAgIHRoaXMuX25leHRQYWdlQnV0dG9uID0gbmV3IEJ1dHRvbih0aGlzLmNvbmZpZy5uZXh0UGFnZUJ1dHRvbiwgdGhpcy5jb25maWcuYnV0dG9uU3R5bGUpO1xuICAgIHRoaXMuX2JlZm9yZVBhZ2VCdXR0b24gPSBuZXcgQnV0dG9uKHRoaXMuY29uZmlnLmJlZm9yZVBhZ2VCdXR0b24sIHRoaXMuY29uZmlnLmJ1dHRvblN0eWxlKTtcbiAgICB0aGlzLl96b29tT3V0QnV0dG9uID0gbmV3IEJ1dHRvbih0aGlzLmNvbmZpZy56b29tT3V0QnV0dG9uLCB0aGlzLmNvbmZpZy5idXR0b25TdHlsZSk7XG4gICAgdGhpcy5fem9vbUluQnV0dG9uID0gbmV3IEJ1dHRvbih0aGlzLmNvbmZpZy56b29tSW5CdXR0b24sIHRoaXMuY29uZmlnLmJ1dHRvblN0eWxlKTtcbiAgICB0aGlzLl9yb3RhdGVMZWZ0QnV0dG9uID0gbmV3IEJ1dHRvbih0aGlzLmNvbmZpZy5yb3RhdGVMZWZ0QnV0dG9uLCB0aGlzLmNvbmZpZy5idXR0b25TdHlsZSk7XG4gICAgdGhpcy5fcm90YXRlUmlnaHRCdXR0b24gPSBuZXcgQnV0dG9uKHRoaXMuY29uZmlnLnJvdGF0ZVJpZ2h0QnV0dG9uLCB0aGlzLmNvbmZpZy5idXR0b25TdHlsZSk7XG4gICAgdGhpcy5fcmVzZXRCdXR0b24gPSBuZXcgQnV0dG9uKHRoaXMuY29uZmlnLnJlc2V0QnV0dG9uLCB0aGlzLmNvbmZpZy5idXR0b25TdHlsZSk7XG4gICAgdGhpcy5fYnV0dG9ucyA9IFtcbiAgICAgIHRoaXMuX3pvb21PdXRCdXR0b24sXG4gICAgICB0aGlzLl96b29tSW5CdXR0b24sXG4gICAgICB0aGlzLl9yb3RhdGVMZWZ0QnV0dG9uLFxuICAgICAgdGhpcy5fcm90YXRlUmlnaHRCdXR0b24sXG4gICAgICB0aGlzLl9yZXNldEJ1dHRvblxuICAgIF0uZmlsdGVyKGl0ZW0gPT4gaXRlbS5kaXNwbGF5KVxuICAgICAgLnNvcnQoKGEsIGIpID0+IGEuc29ydElkIC0gYi5zb3J0SWQpO1xuICB9XG5cbiAgbmdBZnRlclZpZXdJbml0KCkge1xuICAgIHRoaXMuX2NhbnZhcyA9IHRoaXMuY2FudmFzUmVmLm5hdGl2ZUVsZW1lbnQ7XG4gICAgdGhpcy5fY29udGV4dCA9IHRoaXMuX2NhbnZhcy5nZXRDb250ZXh0KCcyZCcpO1xuXG4gICAgLy8gc2V0dGluZyBjYW52YXMgZGltZW50aW9uXG4gICAgdGhpcy5fY2FudmFzLndpZHRoID0gdGhpcy53aWR0aCB8fCB0aGlzLmNvbmZpZy53aWR0aDtcbiAgICB0aGlzLl9jYW52YXMuaGVpZ2h0ID0gdGhpcy5oZWlnaHQgfHwgdGhpcy5jb25maWcuaGVpZ2h0O1xuXG4gICAgLy8gc2V0dGluZyBidXR0b25zIGFjdGlvbnNcbiAgICB0aGlzLl9uZXh0UGFnZUJ1dHRvbi5vbkNsaWNrID0gKGV2dCkgPT4geyB0aGlzLm5leHRQYWdlKCk7IHJldHVybiBmYWxzZTsgfTtcbiAgICB0aGlzLl9iZWZvcmVQYWdlQnV0dG9uLm9uQ2xpY2sgPSAoZXZ0KSA9PiB7IHRoaXMucHJldmlvdXNQYWdlKCk7IHJldHVybiBmYWxzZTsgfTtcbiAgICB0aGlzLl96b29tT3V0QnV0dG9uLm9uQ2xpY2sgPSAoZXZ0KSA9PiB7IHRoaXMuem9vbU91dCgpOyByZXR1cm4gZmFsc2U7IH07XG4gICAgdGhpcy5fem9vbUluQnV0dG9uLm9uQ2xpY2sgPSAoZXZ0KSA9PiB7IHRoaXMuem9vbUluKCk7IHJldHVybiBmYWxzZTsgfTtcbiAgICB0aGlzLl9yb3RhdGVMZWZ0QnV0dG9uLm9uQ2xpY2sgPSAoZXZ0KSA9PiB7IHRoaXMucm90YXRlTGVmdCgpOyByZXR1cm4gZmFsc2U7IH07XG4gICAgdGhpcy5fcm90YXRlUmlnaHRCdXR0b24ub25DbGljayA9IChldnQpID0+IHsgdGhpcy5yb3RhdGVSaWdodCgpOyByZXR1cm4gZmFsc2U7IH07XG4gICAgdGhpcy5fcmVzZXRCdXR0b24ub25DbGljayA9IChldnQpID0+IHsgdGhpcy5yZXNldEltYWdlKCk7IHJldHVybiBmYWxzZTsgfTtcblxuICAgIC8vIHJlZ2lzdGVyIGV2ZW50IGxpc3RlbmVyc1xuICAgIHRoaXMuYWRkRXZlbnRMaXN0ZW5lcnMoKTtcblxuICAgIHRoaXMudXBkYXRlQ2FudmFzKCk7XG4gIH1cblxuICBuZ09uRGVzdHJveSgpIHtcbiAgICAvLyB1bnJlZ2lzdGUgZXZlbnQgbGlzdGVuZXJzXG4gICAgdGhpcy5fbGlzdGVuRGVzdHJveUxpc3QuZm9yRWFjaChsaXN0ZW5EZXN0cm95ID0+IHtcbiAgICAgIGlmICh0eXBlb2YgbGlzdGVuRGVzdHJveSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBsaXN0ZW5EZXN0cm95KCk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgdGhpcy5faW1hZ2VDYWNoZS5kaXNwb3NlQ2FjaGUoKTtcbiAgfVxuXG4gIHNldFVwUmVzb3VyY2UoKSB7XG4gICAgaWYgKHRoaXMuaXNJbWFnZSh0aGlzLnNyYykgJiYgKCF0aGlzLl9yZXNvdXJjZSB8fCAhKHRoaXMuX3Jlc291cmNlIGluc3RhbmNlb2YgSW1hZ2VSZXNvdXJjZUxvYWRlcikpKSB7XG4gICAgICBpZiAodGhpcy5fcmVzb3VyY2VDaGFuZ2VTdWIpIHtcbiAgICAgICAgdGhpcy5fcmVzb3VyY2VDaGFuZ2VTdWIudW5zdWJzY3JpYmUoKTtcbiAgICAgIH1cbiAgICAgIGlmICghdGhpcy5faW1hZ2VSZXNvdXJjZSkge1xuICAgICAgICB0aGlzLl9pbWFnZVJlc291cmNlID0gbmV3IEltYWdlUmVzb3VyY2VMb2FkZXIoKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuX3Jlc291cmNlID0gdGhpcy5faW1hZ2VSZXNvdXJjZTtcbiAgICB9IGVsc2UgaWYgKHRoaXMuaXNQZGYodGhpcy5zcmMpICYmICghdGhpcy5fcmVzb3VyY2UgfHwgISh0aGlzLl9yZXNvdXJjZSBpbnN0YW5jZW9mIFBkZlJlc291cmNlTG9hZGVyKSkpIHtcbiAgICAgIGlmICh0aGlzLl9yZXNvdXJjZUNoYW5nZVN1Yikge1xuICAgICAgICB0aGlzLl9yZXNvdXJjZUNoYW5nZVN1Yi51bnN1YnNjcmliZSgpO1xuICAgICAgfVxuICAgICAgaWYgKCF0aGlzLl9wZGZSZXNvdXJjZSkge1xuICAgICAgICB0aGlzLl9wZGZSZXNvdXJjZSA9IG5ldyBQZGZSZXNvdXJjZUxvYWRlcih0aGlzLl9pbWFnZUNhY2hlKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuX3Jlc291cmNlID0gdGhpcy5fcGRmUmVzb3VyY2U7XG4gICAgfVxuICAgIGlmICh0aGlzLl9yZXNvdXJjZSkge1xuICAgICAgdGhpcy5fcmVzb3VyY2Uuc3JjID0gdGhpcy5zcmMgaW5zdGFuY2VvZiBGaWxlID8gVVJMLmNyZWF0ZU9iamVjdFVSTCh0aGlzLnNyYykgOiB0aGlzLnNyYztcbiAgICAgIHRoaXMuX3Jlc291cmNlQ2hhbmdlU3ViID0gdGhpcy5fcmVzb3VyY2Uub25SZXNvdXJjZUNoYW5nZSgpLnN1YnNjcmliZSgoKSA9PiB7XG4gICAgICAgIHRoaXMudXBkYXRlQ2FudmFzKCk7XG4gICAgICAgIGlmICh0aGlzLnNyYyBpbnN0YW5jZW9mIEZpbGUpIHtcbiAgICAgICAgICBVUkwucmV2b2tlT2JqZWN0VVJMKHRoaXMuX3Jlc291cmNlLnNyYyk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgdGhpcy5fcmVzb3VyY2Uuc2V0VXAoKTtcbiAgICAgIHRoaXMucmVzZXRJbWFnZSgpO1xuICAgICAgaWYgKHRoaXMuX2NvbnRleHQpIHsgdGhpcy51cGRhdGVDYW52YXMoKTsgfVxuICAgIH1cbiAgfVxuICAvLyNlbmRyZWdpb25cblxuICAvLyNyZWdpb24gVG91Y2ggZXZlbnRzXG4gIG9uVGFwKGV2dCkge1xuICAgIGNvbnN0IHBvc2l0aW9uID0geyB4OiBldnQucGFnZVgsIHk6IGV2dC5wYWdlWSB9O1xuICAgIGNvbnN0IGFjdGl2ZUVsZW1lbnQgPSB0aGlzLmdldFVJRWxlbWVudCh0aGlzLnNjcmVlblRvQ2FudmFzQ2VudHJlKHBvc2l0aW9uKSk7XG4gICAgaWYgKGFjdGl2ZUVsZW1lbnQgIT09IG51bGwpIHsgYWN0aXZlRWxlbWVudC5vbkNsaWNrKGV2dCk7IH1cbiAgfVxuXG4gIG9uVG91Y2hFbmQoKSB7XG4gICAgdGhpcy5fdG91Y2hTdGFydFN0YXRlLnZpZXdwb3J0ID0gdW5kZWZpbmVkO1xuICAgIHRoaXMuX3RvdWNoU3RhcnRTdGF0ZS5zY2FsZSA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLl90b3VjaFN0YXJ0U3RhdGUucm90YXRlID0gdW5kZWZpbmVkO1xuICB9XG5cbiAgcHJvY2Vzc1RvdWNoRXZlbnQoZXZ0KSB7XG4gICAgLy8gcHJvY2VzcyBwYW5cbiAgICBpZiAoIXRoaXMuX3RvdWNoU3RhcnRTdGF0ZS52aWV3cG9ydCkgeyB0aGlzLl90b3VjaFN0YXJ0U3RhdGUudmlld3BvcnQgPSBPYmplY3QuYXNzaWduKHt9LCB0aGlzLl9yZXNvdXJjZS52aWV3cG9ydCk7IH1cblxuICAgIGNvbnN0IHZpZXdwb3J0ID0gdGhpcy5fcmVzb3VyY2Uudmlld3BvcnQ7XG4gICAgdmlld3BvcnQueCA9IHRoaXMuX3RvdWNoU3RhcnRTdGF0ZS52aWV3cG9ydC54ICsgZXZ0LmRlbHRhWDtcbiAgICB2aWV3cG9ydC55ID0gdGhpcy5fdG91Y2hTdGFydFN0YXRlLnZpZXdwb3J0LnkgKyBldnQuZGVsdGFZO1xuXG4gICAgLy8gcHJvY2VzcyBwaW5jaCBpbi9vdXRcbiAgICBpZiAoIXRoaXMuX3RvdWNoU3RhcnRTdGF0ZS5zY2FsZSkgeyB0aGlzLl90b3VjaFN0YXJ0U3RhdGUuc2NhbGUgPSB0aGlzLl9yZXNvdXJjZS52aWV3cG9ydC5zY2FsZTsgfVxuICAgIGNvbnN0IG5ld1NjYWxlID0gdGhpcy5fdG91Y2hTdGFydFN0YXRlLnNjYWxlICogZXZ0LnNjYWxlO1xuICAgIHZpZXdwb3J0LnNjYWxlID0gbmV3U2NhbGUgPiB0aGlzLl9yZXNvdXJjZS5tYXhTY2FsZSA/IHRoaXMuX3Jlc291cmNlLm1heFNjYWxlIDpcbiAgICAgIG5ld1NjYWxlIDwgdGhpcy5fcmVzb3VyY2UubWluU2NhbGUgPyB0aGlzLl9yZXNvdXJjZS5taW5TY2FsZSA6IG5ld1NjYWxlO1xuXG4gICAgLy8gcHJvY2VzcyByb3RhdGUgbGVmdC9yaWdodFxuICAgIGlmICghdGhpcy5fdG91Y2hTdGFydFN0YXRlLnJvdGF0ZSkgeyB0aGlzLl90b3VjaFN0YXJ0U3RhdGUucm90YXRlID0geyByb3RhdGlvbjogdmlld3BvcnQucm90YXRpb24sIHN0YXJ0Um90YXRlOiBldnQucm90YXRpb24gfTsgfVxuICAgIGlmIChldnQucm90YXRpb24gIT09IDApIHtcbiAgICAgIGNvbnN0IG5ld0FuZ2xlID0gdGhpcy5fdG91Y2hTdGFydFN0YXRlLnJvdGF0ZS5yb3RhdGlvbiArIGV2dC5yb3RhdGlvbiAtIHRoaXMuX3RvdWNoU3RhcnRTdGF0ZS5yb3RhdGUuc3RhcnRSb3RhdGU7XG4gICAgICB2aWV3cG9ydC5yb3RhdGlvbiA9IHRoaXMuY29uZmlnLnJvdGF0ZVN0ZXBwZXIgPyB0b1NxdWFyZUFuZ2xlKG5ld0FuZ2xlKSA6IG5ld0FuZ2xlO1xuICAgIH1cbiAgICB0aGlzLl9kaXJ0eSA9IHRydWU7XG4gIH1cbiAgLy8jZW5kcmVnaW9uXG5cbiAgLy8jcmVnaW9uIE1vdXNlIEV2ZW50c1xuICBwcml2YXRlIGFkZEV2ZW50TGlzdGVuZXJzKCkge1xuICAgIC8vIHpvb21pbmdcbiAgICB0aGlzLl9saXN0ZW5EZXN0cm95TGlzdC5wdXNoKHRoaXMuX3JlbmRlcmVyLmxpc3Rlbih0aGlzLl9jYW52YXMsICdET01Nb3VzZVNjcm9sbCcsIChldnQpID0+IHRoaXMub25Nb3VzZVdoZWVsKGV2dCkpKTtcbiAgICB0aGlzLl9saXN0ZW5EZXN0cm95TGlzdC5wdXNoKHRoaXMuX3JlbmRlcmVyLmxpc3Rlbih0aGlzLl9jYW52YXMsICdtb3VzZXdoZWVsJywgKGV2dCkgPT4gdGhpcy5vbk1vdXNlV2hlZWwoZXZ0KSkpO1xuXG4gICAgLy8gc2hvdyB0b29sdGlwIHdoZW4gbW91c2VvdmVyIGl0XG4gICAgdGhpcy5fbGlzdGVuRGVzdHJveUxpc3QucHVzaCh0aGlzLl9yZW5kZXJlci5saXN0ZW4odGhpcy5fY2FudmFzLCAnbW91c2Vtb3ZlJywgKGV2dCkgPT5cbiAgICAgIHRoaXMuY2hlY2tUb29sdGlwQWN0aXZhdGlvbih0aGlzLnNjcmVlblRvQ2FudmFzQ2VudHJlKHsgeDogZXZ0LmNsaWVudFgsIHk6IGV2dC5jbGllbnRZIH0pKVxuICAgICkpO1xuICB9XG5cbiAgcHJpdmF0ZSBvbk1vdXNlV2hlZWwoZXZ0KSB7XG4gICAgaWYgKCFldnQpIHsgZXZ0ID0gZXZlbnQ7IH1cbiAgICBldnQucHJldmVudERlZmF1bHQoKTtcbiAgICBpZiAoZXZ0LmRldGFpbCA8IDAgfHwgZXZ0LndoZWVsRGVsdGEgPiAwKSB7IC8vIHVwIC0+IGxhcmdlclxuICAgICAgdGhpcy56b29tSW4oKTtcbiAgICB9IGVsc2UgeyAvLyBkb3duIC0+IHNtYWxsZXJcbiAgICAgIHRoaXMuem9vbU91dCgpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgY2hlY2tUb29sdGlwQWN0aXZhdGlvbihwb3M6IHsgeDogbnVtYmVyLCB5OiBudW1iZXIgfSkge1xuICAgIHRoaXMuZ2V0VUlFbGVtZW50cygpLmZvckVhY2goeCA9PiB4LmhvdmVyID0gZmFsc2UpO1xuICAgIGNvbnN0IGFjdGl2ZUVsZW1lbnQgPSB0aGlzLmdldFVJRWxlbWVudChwb3MpO1xuICAgIGNvbnN0IG9sZFRvb2xUaXAgPSB0aGlzLl9jdXJyZW50VG9vbHRpcDtcbiAgICBpZiAoYWN0aXZlRWxlbWVudCAhPT0gbnVsbCkge1xuICAgICAgaWYgKHR5cGVvZiBhY3RpdmVFbGVtZW50LmhvdmVyICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICBhY3RpdmVFbGVtZW50LmhvdmVyID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIGlmICh0eXBlb2YgYWN0aXZlRWxlbWVudC50b29sdGlwICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICB0aGlzLl9jdXJyZW50VG9vbHRpcCA9IGFjdGl2ZUVsZW1lbnQudG9vbHRpcDtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKG9sZFRvb2xUaXAgIT09IHRoaXMuX2N1cnJlbnRUb29sdGlwKSB7IHRoaXMuX2RpcnR5ID0gdHJ1ZTsgfVxuICB9XG4gIC8vI2VuZHJlZ2lvblxuXG4gIC8vI3JlZ2lvbiBCdXR0b24gQWN0aW9uc1xuXG4gIHByaXZhdGUgbmV4dFBhZ2UoKSB7XG4gICAgaWYgKCF0aGlzLl9yZXNvdXJjZSkgeyByZXR1cm47IH1cbiAgICBpZiAodGhpcy5fcmVzb3VyY2UuY3VycmVudEl0ZW0gPj0gdGhpcy5fcmVzb3VyY2UudG90YWxJdGVtKSB7IHJldHVybjsgfVxuICAgIGlmICh0aGlzLl9yZXNvdXJjZS5jdXJyZW50SXRlbSA8IDEpIHsgdGhpcy5fcmVzb3VyY2UuY3VycmVudEl0ZW0gPSAwOyB9XG4gICAgdGhpcy5fcmVzb3VyY2UuY3VycmVudEl0ZW0rKztcbiAgICB0aGlzLl9yZXNvdXJjZS5sb2FkUmVzb3VyY2UoKTtcbiAgICB0aGlzLl9kaXJ0eSA9IHRydWU7XG4gIH1cblxuICBwcml2YXRlIHByZXZpb3VzUGFnZSgpIHtcbiAgICBpZiAoIXRoaXMuX3Jlc291cmNlKSB7IHJldHVybjsgfVxuICAgIGlmICh0aGlzLl9yZXNvdXJjZS5jdXJyZW50SXRlbSA8PSAxKSB7IHJldHVybjsgfVxuICAgIGlmICh0aGlzLl9yZXNvdXJjZS5jdXJyZW50SXRlbSA+IHRoaXMuX3Jlc291cmNlLnRvdGFsSXRlbSkgeyB0aGlzLl9yZXNvdXJjZS5jdXJyZW50SXRlbSA9IHRoaXMuX3Jlc291cmNlLnRvdGFsSXRlbSArIDE7IH1cbiAgICB0aGlzLl9yZXNvdXJjZS5jdXJyZW50SXRlbS0tO1xuICAgIHRoaXMuX3Jlc291cmNlLmxvYWRSZXNvdXJjZSgpO1xuICAgIHRoaXMuX2RpcnR5ID0gdHJ1ZTtcbiAgfVxuXG4gIHByaXZhdGUgem9vbUluKCkge1xuICAgIGlmICghdGhpcy5fcmVzb3VyY2UpIHsgcmV0dXJuOyB9XG4gICAgY29uc3QgbmV3U2NhbGUgPSB0aGlzLl9yZXNvdXJjZS52aWV3cG9ydC5zY2FsZSAqICgxICsgdGhpcy5jb25maWcuc2NhbGVTdGVwKTtcbiAgICB0aGlzLl9yZXNvdXJjZS52aWV3cG9ydC5zY2FsZSA9IG5ld1NjYWxlID4gdGhpcy5fcmVzb3VyY2UubWF4U2NhbGUgPyB0aGlzLl9yZXNvdXJjZS5tYXhTY2FsZSA6IG5ld1NjYWxlO1xuICAgIHRoaXMuX2RpcnR5ID0gdHJ1ZTtcbiAgfVxuXG4gIHByaXZhdGUgem9vbU91dCgpIHtcbiAgICBpZiAoIXRoaXMuX3Jlc291cmNlKSB7IHJldHVybjsgfVxuICAgIGNvbnN0IG5ld1NjYWxlID0gdGhpcy5fcmVzb3VyY2Uudmlld3BvcnQuc2NhbGUgKiAoMSAtIHRoaXMuY29uZmlnLnNjYWxlU3RlcCk7XG4gICAgdGhpcy5fcmVzb3VyY2Uudmlld3BvcnQuc2NhbGUgPSBuZXdTY2FsZSA8IHRoaXMuX3Jlc291cmNlLm1pblNjYWxlID8gdGhpcy5fcmVzb3VyY2UubWluU2NhbGUgOiBuZXdTY2FsZTtcbiAgICB0aGlzLl9kaXJ0eSA9IHRydWU7XG4gIH1cblxuICBwcml2YXRlIHJvdGF0ZUxlZnQoKSB7XG4gICAgaWYgKCF0aGlzLl9yZXNvdXJjZSkgeyByZXR1cm47IH1cbiAgICBjb25zdCB2aWV3cG9ydCA9IHRoaXMuX3Jlc291cmNlLnZpZXdwb3J0O1xuICAgIHZpZXdwb3J0LnJvdGF0aW9uID0gdmlld3BvcnQucm90YXRpb24gPT09IDAgPyAyNzAgOiB2aWV3cG9ydC5yb3RhdGlvbiAtIDkwO1xuICAgIHRoaXMuX2RpcnR5ID0gdHJ1ZTtcbiAgfVxuXG4gIHByaXZhdGUgcm90YXRlUmlnaHQoKSB7XG4gICAgaWYgKCF0aGlzLl9yZXNvdXJjZSkgeyByZXR1cm47IH1cbiAgICBjb25zdCB2aWV3cG9ydCA9IHRoaXMuX3Jlc291cmNlLnZpZXdwb3J0O1xuICAgIHZpZXdwb3J0LnJvdGF0aW9uID0gdmlld3BvcnQucm90YXRpb24gPT09IDI3MCA/IDAgOiB2aWV3cG9ydC5yb3RhdGlvbiArIDkwO1xuICAgIHRoaXMuX2RpcnR5ID0gdHJ1ZTtcbiAgfVxuXG4gIHByaXZhdGUgcmVzZXRJbWFnZSgpIHtcbiAgICBpZiAoIXRoaXMuX3Jlc291cmNlKSB7IHJldHVybjsgfVxuICAgIHRoaXMuX3Jlc291cmNlLnJlc2V0Vmlld3BvcnQodGhpcy5fY2FudmFzKTtcbiAgICB0aGlzLl9kaXJ0eSA9IHRydWU7XG4gIH1cbiAgLy8jZW5kcmVnaW9uXG5cbiAgLy8jcmVnaW9uIERyYXcgQ2FudmFzXG4gIHByaXZhdGUgdXBkYXRlQ2FudmFzKCkge1xuICAgIHRoaXMucmVzZXRJbWFnZSgpO1xuXG4gICAgLy8gc3RhcnQgbmV3IHJlbmRlciBsb29wXG4gICAgdGhpcy5yZW5kZXIoKTtcbiAgfVxuXG4gIHByaXZhdGUgcmVuZGVyKCkge1xuICAgIGNvbnN0IHZtID0gdGhpcztcbiAgICAvLyBvbmx5IHJlLXJlbmRlciBpZiBkaXJ0eVxuICAgIGlmICh0aGlzLl9kaXJ0eSAmJiB0aGlzLl9yZXNvdXJjZSkge1xuICAgICAgdGhpcy5fZGlydHkgPSBmYWxzZTtcblxuICAgICAgY29uc3QgY3R4ID0gdGhpcy5fY29udGV4dDtcbiAgICAgIGN0eC5zYXZlKCk7XG5cbiAgICAgIHRoaXMuX3Jlc291cmNlLmRyYXcoY3R4LCB0aGlzLmNvbmZpZywgdGhpcy5fY2FudmFzLCAoKSA9PiB7XG4gICAgICAgIGN0eC5yZXN0b3JlKCk7XG5cbiAgICAgICAgaWYgKHZtLl9yZXNvdXJjZS5sb2FkZWQpIHtcbiAgICAgICAgICAvLyBkcmF3IGJ1dHRvbnNcbiAgICAgICAgICB0aGlzLmRyYXdCdXR0b25zKGN0eCk7XG5cbiAgICAgICAgICAvLyBkcmF3IHBhZ2luYXRvclxuICAgICAgICAgIGlmICh0aGlzLl9yZXNvdXJjZS5zaG93SXRlbXNRdWFudGl0eSkge1xuICAgICAgICAgICAgdGhpcy5kcmF3UGFnaW5hdG9yKGN0eCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gICAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKCgpID0+IHRoaXMucmVuZGVyKCkpO1xuICB9XG5cbiAgcHJpdmF0ZSBkcmF3QnV0dG9ucyhjdHgpIHtcbiAgICBjb25zdCBwYWRkaW5nID0gdGhpcy5jb25maWcudG9vbHRpcHMucGFkZGluZztcbiAgICBjb25zdCByYWRpdXMgPSB0aGlzLmNvbmZpZy50b29sdGlwcy5yYWRpdXM7XG4gICAgY29uc3QgZ2FwID0gMiAqIHJhZGl1cyArIHBhZGRpbmc7XG4gICAgY29uc3QgeCA9IHRoaXMuX2NhbnZhcy53aWR0aCAtIHJhZGl1cyAtIHBhZGRpbmc7XG4gICAgY29uc3QgeSA9IHRoaXMuX2NhbnZhcy5oZWlnaHQgLSByYWRpdXMgLSBwYWRkaW5nO1xuXG4gICAgLy8gZHJhdyBidXR0b25zXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9idXR0b25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICB0aGlzLl9idXR0b25zW2ldLmRyYXcoY3R4LCB4LCB5IC0gZ2FwICogaSwgcmFkaXVzKTtcbiAgICB9XG5cbiAgICAvLyBkcmF3IHRvb2x0aXBcbiAgICBpZiAodGhpcy5fY3VycmVudFRvb2x0aXAgIT09IG51bGwgJiYgdGhpcy5fY2FudmFzLndpZHRoID4gTUlOX1RPT0xUSVBfV0lEVEhfU1BBQ0UpIHtcbiAgICAgIGN0eC5zYXZlKCk7XG4gICAgICBjb25zdCBmb250U2l6ZSA9IHJhZGl1cztcbiAgICAgIGN0eC5mb250ID0gZm9udFNpemUgKyAncHggc2Fucy1zZXJpZic7XG5cbiAgICAgIC8vIGNhbGN1bGF0ZSBwb3NpdGlvblxuICAgICAgY29uc3QgdGV4dFNpemUgPSBjdHgubWVhc3VyZVRleHQodGhpcy5fY3VycmVudFRvb2x0aXApLndpZHRoXG4gICAgICAgICwgcmVjdFdpZHRoID0gdGV4dFNpemUgKyBwYWRkaW5nXG4gICAgICAgICwgcmVjdEhlaWdodCA9IGZvbnRTaXplICogMC43MCArIHBhZGRpbmdcbiAgICAgICAgLCByZWN0WCA9IHRoaXMuX2NhbnZhcy53aWR0aFxuICAgICAgICAgIC0gKDIgKiByYWRpdXMgKyAyICogcGFkZGluZykgLy8gYnV0dG9uc1xuICAgICAgICAgIC0gcmVjdFdpZHRoXG4gICAgICAgICwgcmVjdFkgPSB0aGlzLl9jYW52YXMuaGVpZ2h0IC0gcmVjdEhlaWdodCAtIHBhZGRpbmdcbiAgICAgICAgLCB0ZXh0WCA9IHJlY3RYICsgMC41ICogcGFkZGluZ1xuICAgICAgICAsIHRleHRZID0gdGhpcy5fY2FudmFzLmhlaWdodCAtIDEuNSAqIHBhZGRpbmc7XG5cbiAgICAgIGN0eC5nbG9iYWxBbHBoYSA9IHRoaXMuY29uZmlnLnRvb2x0aXBzLmJnQWxwaGE7XG4gICAgICBjdHguZmlsbFN0eWxlID0gdGhpcy5jb25maWcudG9vbHRpcHMuYmdTdHlsZTtcbiAgICAgIHRoaXMuZHJhd1JvdW5kUmVjdGFuZ2xlKGN0eCwgcmVjdFgsIHJlY3RZLCByZWN0V2lkdGgsIHJlY3RIZWlnaHQsIDgsIHRydWUsIGZhbHNlKTtcblxuICAgICAgY3R4Lmdsb2JhbEFscGhhID0gdGhpcy5jb25maWcudG9vbHRpcHMudGV4dEFscGhhO1xuICAgICAgY3R4LmZpbGxTdHlsZSA9IHRoaXMuY29uZmlnLnRvb2x0aXBzLnRleHRTdHlsZTtcbiAgICAgIGN0eC5maWxsVGV4dCh0aGlzLl9jdXJyZW50VG9vbHRpcCwgdGV4dFgsIHRleHRZKTtcblxuICAgICAgY3R4LnJlc3RvcmUoKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGRyYXdQYWdpbmF0b3IoY3R4KSB7XG4gICAgY29uc3QgcGFkZGluZyA9IHRoaXMuY29uZmlnLnRvb2x0aXBzLnBhZGRpbmc7XG4gICAgY29uc3QgcmFkaXVzID0gdGhpcy5jb25maWcudG9vbHRpcHMucmFkaXVzO1xuICAgIGNvbnN0IGxhYmVsV2lkdGggPSA1MDtcbiAgICBjb25zdCB4MSA9ICh0aGlzLl9jYW52YXMud2lkdGggLSBsYWJlbFdpZHRoKSAvIDIgLSByYWRpdXMgLSBwYWRkaW5nOyAvLyBQcmV2UGFnZUJ1dHRvblxuICAgIGNvbnN0IHgyID0gdGhpcy5fY2FudmFzLndpZHRoIC8gMjsgLy8gTGFiZWxcbiAgICBjb25zdCB4MyA9ICh0aGlzLl9jYW52YXMud2lkdGggKyBsYWJlbFdpZHRoKSAvIDIgKyByYWRpdXMgKyBwYWRkaW5nOyAvLyBOZXh0UGFnZUJ1dHRvblxuICAgIGNvbnN0IHkgPSB0aGlzLl9jYW52YXMuaGVpZ2h0IC0gcmFkaXVzIC0gcGFkZGluZztcbiAgICBjb25zdCBsYWJlbCA9IHRoaXMuX3Jlc291cmNlLmN1cnJlbnRJdGVtICsgJy8nICsgdGhpcy5fcmVzb3VyY2UudG90YWxJdGVtO1xuICAgIGNvbnN0IGZvbnRTaXplID0gMjU7XG5cbiAgICBjdHguc2F2ZSgpO1xuICAgIHRoaXMuX2JlZm9yZVBhZ2VCdXR0b24uZHJhdyhjdHgsIHgxLCB5LCByYWRpdXMpO1xuICAgIHRoaXMuX25leHRQYWdlQnV0dG9uLmRyYXcoY3R4LCB4MywgeSwgcmFkaXVzKTtcbiAgICBjdHgucmVzdG9yZSgpO1xuXG4gICAgY3R4LnNhdmUoKTtcbiAgICBjdHguZm9udCA9IGZvbnRTaXplICsgJ3B4IFZlcmRhbmEnO1xuICAgIGN0eC50ZXh0QWxpZ24gPSAnY2VudGVyJztcbiAgICBjdHguZmlsbFRleHQobGFiZWwsIHgyLCB0aGlzLl9jYW52YXMuaGVpZ2h0IC0gcGFkZGluZyAtIGZvbnRTaXplIC8gMiwgbGFiZWxXaWR0aCk7XG4gICAgY3R4LnJlc3RvcmUoKTtcbiAgfVxuXG4gIHByaXZhdGUgZHJhd1JvdW5kUmVjdGFuZ2xlKGN0eCwgeCwgeSwgd2lkdGgsIGhlaWdodCwgcmFkaXVzLCBmaWxsLCBzdHJva2UpIHtcbiAgICByYWRpdXMgPSAodHlwZW9mIHJhZGl1cyA9PT0gJ251bWJlcicpID8gcmFkaXVzIDogNTtcbiAgICBmaWxsID0gKHR5cGVvZiBmaWxsID09PSAnYm9vbGVhbicpID8gZmlsbCA6IHRydWU7IC8vIGZpbGwgPSBkZWZhdWx0XG4gICAgc3Ryb2tlID0gKHR5cGVvZiBzdHJva2UgPT09ICdib29sZWFuJykgPyBzdHJva2UgOiBmYWxzZTtcblxuICAgIC8vIGRyYXcgcm91bmQgcmVjdGFuZ2xlXG4gICAgY3R4LmJlZ2luUGF0aCgpO1xuICAgIGN0eC5tb3ZlVG8oeCArIHJhZGl1cywgeSk7XG4gICAgY3R4LmxpbmVUbyh4ICsgd2lkdGggLSByYWRpdXMsIHkpO1xuICAgIGN0eC5xdWFkcmF0aWNDdXJ2ZVRvKHggKyB3aWR0aCwgeSwgeCArIHdpZHRoLCB5ICsgcmFkaXVzKTtcbiAgICBjdHgubGluZVRvKHggKyB3aWR0aCwgeSArIGhlaWdodCAtIHJhZGl1cyk7XG4gICAgY3R4LnF1YWRyYXRpY0N1cnZlVG8oeCArIHdpZHRoLCB5ICsgaGVpZ2h0LCB4ICsgd2lkdGggLSByYWRpdXMsIHkgKyBoZWlnaHQpO1xuICAgIGN0eC5saW5lVG8oeCArIHJhZGl1cywgeSArIGhlaWdodCk7XG4gICAgY3R4LnF1YWRyYXRpY0N1cnZlVG8oeCwgeSArIGhlaWdodCwgeCwgeSArIGhlaWdodCAtIHJhZGl1cyk7XG4gICAgY3R4LmxpbmVUbyh4LCB5ICsgcmFkaXVzKTtcbiAgICBjdHgucXVhZHJhdGljQ3VydmVUbyh4LCB5LCB4ICsgcmFkaXVzLCB5KTtcbiAgICBjdHguY2xvc2VQYXRoKCk7XG5cbiAgICBpZiAoZmlsbCkgeyBjdHguZmlsbCgpOyB9XG4gICAgaWYgKHN0cm9rZSkgeyBjdHguc3Ryb2tlKCk7IH1cbiAgfVxuXG4gIC8vI2VuZHJlZ2lvblxuXG4gIC8vI3JlZ2lvbiBVdGlsc1xuXG4gIHByaXZhdGUgZXh0ZW5kc0RlZmF1bHRDb25maWcoY2ZnOiBJbWFnZVZpZXdlckNvbmZpZykge1xuICAgIGNvbnN0IGRlZmF1bHRDZmcgPSBJTUFHRVZJRVdFUl9DT05GSUdfREVGQVVMVDtcbiAgICBjb25zdCBsb2NhbENmZyA9IE9iamVjdC5hc3NpZ24oe30sIGRlZmF1bHRDZmcsIGNmZyk7XG4gICAgaWYgKGNmZy5idXR0b25TdHlsZSkgeyBsb2NhbENmZy5idXR0b25TdHlsZSA9IE9iamVjdC5hc3NpZ24oZGVmYXVsdENmZy5idXR0b25TdHlsZSwgY2ZnLmJ1dHRvblN0eWxlKTsgfVxuICAgIGlmIChjZmcudG9vbHRpcHMpIHsgbG9jYWxDZmcudG9vbHRpcHMgPSBPYmplY3QuYXNzaWduKGRlZmF1bHRDZmcudG9vbHRpcHMsIGNmZy50b29sdGlwcyk7IH1cbiAgICBpZiAoY2ZnLm5leHRQYWdlQnV0dG9uKSB7IGxvY2FsQ2ZnLm5leHRQYWdlQnV0dG9uID0gT2JqZWN0LmFzc2lnbihkZWZhdWx0Q2ZnLm5leHRQYWdlQnV0dG9uLCBjZmcubmV4dFBhZ2VCdXR0b24pOyB9XG4gICAgaWYgKGNmZy5iZWZvcmVQYWdlQnV0dG9uKSB7IGxvY2FsQ2ZnLmJlZm9yZVBhZ2VCdXR0b24gPSBPYmplY3QuYXNzaWduKGRlZmF1bHRDZmcuYmVmb3JlUGFnZUJ1dHRvbiwgY2ZnLmJlZm9yZVBhZ2VCdXR0b24pOyB9XG4gICAgaWYgKGNmZy56b29tT3V0QnV0dG9uKSB7IGxvY2FsQ2ZnLnpvb21PdXRCdXR0b24gPSBPYmplY3QuYXNzaWduKGRlZmF1bHRDZmcuem9vbU91dEJ1dHRvbiwgY2ZnLnpvb21PdXRCdXR0b24pOyB9XG4gICAgaWYgKGNmZy56b29tT3V0QnV0dG9uKSB7IGxvY2FsQ2ZnLnpvb21PdXRCdXR0b24gPSBPYmplY3QuYXNzaWduKGRlZmF1bHRDZmcuem9vbU91dEJ1dHRvbiwgY2ZnLnpvb21PdXRCdXR0b24pOyB9XG4gICAgaWYgKGNmZy56b29tSW5CdXR0b24pIHsgbG9jYWxDZmcuem9vbUluQnV0dG9uID0gT2JqZWN0LmFzc2lnbihkZWZhdWx0Q2ZnLnpvb21JbkJ1dHRvbiwgY2ZnLnpvb21JbkJ1dHRvbik7IH1cbiAgICBpZiAoY2ZnLnJvdGF0ZUxlZnRCdXR0b24pIHsgbG9jYWxDZmcucm90YXRlTGVmdEJ1dHRvbiA9IE9iamVjdC5hc3NpZ24oZGVmYXVsdENmZy5yb3RhdGVMZWZ0QnV0dG9uLCBjZmcucm90YXRlTGVmdEJ1dHRvbik7IH1cbiAgICBpZiAoY2ZnLnJvdGF0ZVJpZ2h0QnV0dG9uKSB7IGxvY2FsQ2ZnLnJvdGF0ZVJpZ2h0QnV0dG9uID0gT2JqZWN0LmFzc2lnbihkZWZhdWx0Q2ZnLnJvdGF0ZVJpZ2h0QnV0dG9uLCBjZmcucm90YXRlUmlnaHRCdXR0b24pOyB9XG4gICAgaWYgKGNmZy5yZXNldEJ1dHRvbikgeyBsb2NhbENmZy5yZXNldEJ1dHRvbiA9IE9iamVjdC5hc3NpZ24oZGVmYXVsdENmZy5yZXNldEJ1dHRvbiwgY2ZnLnJlc2V0QnV0dG9uKTsgfVxuICAgIHJldHVybiBsb2NhbENmZztcbiAgfVxuXG4gIHByaXZhdGUgc2NyZWVuVG9DYW52YXNDZW50cmUocG9zOiB7IHg6IG51bWJlciwgeTogbnVtYmVyIH0pIHtcbiAgICBjb25zdCByZWN0ID0gdGhpcy5fY2FudmFzLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgIHJldHVybiB7IHg6IHBvcy54IC0gcmVjdC5sZWZ0LCB5OiBwb3MueSAtIHJlY3QudG9wIH07XG4gIH1cblxuICBwcml2YXRlIGdldFVJRWxlbWVudHMoKTogQnV0dG9uW10ge1xuICAgIGNvbnN0IGhvdmVyRWxlbWVudHMgPSB0aGlzLl9idXR0b25zLnNsaWNlKCk7XG4gICAgaG92ZXJFbGVtZW50cy5wdXNoKHRoaXMuX25leHRQYWdlQnV0dG9uKTtcbiAgICBob3ZlckVsZW1lbnRzLnB1c2godGhpcy5fYmVmb3JlUGFnZUJ1dHRvbik7XG4gICAgcmV0dXJuIGhvdmVyRWxlbWVudHM7XG4gIH1cblxuICBwcml2YXRlIGdldFVJRWxlbWVudChwb3M6IHsgeDogbnVtYmVyLCB5OiBudW1iZXIgfSkge1xuICAgIGNvbnN0IGFjdGl2ZVVJRWxlbWVudCA9IHRoaXMuZ2V0VUlFbGVtZW50cygpLmZpbHRlcigodWlFbGVtZW50KSA9PiB7XG4gICAgICByZXR1cm4gdWlFbGVtZW50LmlzV2l0aGluQm91bmRzKHBvcy54LCBwb3MueSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIChhY3RpdmVVSUVsZW1lbnQubGVuZ3RoID4gMCkgPyBhY3RpdmVVSUVsZW1lbnRbMF0gOiBudWxsO1xuICB9XG5cbiAgcHJpdmF0ZSBpc0ltYWdlKGZpbGU6IHN0cmluZyB8IEZpbGUpIHtcbiAgICBpZiAodGhpcy5fZmlsZXR5cGUgJiYgdGhpcy5fZmlsZXR5cGUudG9Mb3dlckNhc2UoKSA9PT0gJ2ltYWdlJykgeyByZXR1cm4gdHJ1ZTsgfVxuICAgIHJldHVybiB0ZXN0RmlsZShmaWxlLCAnXFxcXC4ocG5nfGpwZ3xqcGVnfGdpZil8aW1hZ2UvcG5nJyk7XG4gIH1cblxuICBwcml2YXRlIGlzUGRmKGZpbGU6IHN0cmluZyB8IEZpbGUpIHtcbiAgICBpZiAodGhpcy5fZmlsZXR5cGUgJiYgdGhpcy5fZmlsZXR5cGUudG9Mb3dlckNhc2UoKSA9PT0gJ3BkZicpIHsgcmV0dXJuIHRydWU7IH1cbiAgICByZXR1cm4gdGVzdEZpbGUoZmlsZSwgJ1xcXFwuKHBkZil8YXBwbGljYXRpb24vcGRmJyk7XG4gIH1cbiAgLy8jZW5kcmVnaW9uXG59XG5cbmZ1bmN0aW9uIHRlc3RGaWxlKGZpbGU6IHN0cmluZyB8IEZpbGUsIHJlZ2V4VGVzdDogc3RyaW5nKSB7XG4gIGlmICghZmlsZSkgeyByZXR1cm4gZmFsc2U7IH1cbiAgY29uc3QgbmFtZSA9IGZpbGUgaW5zdGFuY2VvZiBGaWxlID8gZmlsZS5uYW1lIDogZmlsZTtcbiAgcmV0dXJuIG5hbWUudG9Mb3dlckNhc2UoKS5tYXRjaChyZWdleFRlc3QpICE9PSBudWxsO1xufVxuIl19