import { Component, Input, ViewChild, Renderer2, Inject } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { ImageViewerConfig, IMAGEVIEWER_CONFIG, IMAGEVIEWER_CONFIG_DEFAULT } from './imageviewer.config';
import { Button, toSquareAngle } from './imageviewer.model';
import { ImageResourceLoader } from './image.loader';
import { ImageCacheService } from './imagecache.service';
import { PdfResourceLoader } from './pdf.loader';
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
ImageViewerComponent.decorators = [
    { type: Component, args: [{
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
            },] }
];
ImageViewerComponent.ctorParameters = () => [
    { type: DomSanitizer },
    { type: Renderer2 },
    { type: ImageCacheService },
    { type: ImageViewerConfig, decorators: [{ type: Inject, args: [IMAGEVIEWER_CONFIG,] }] }
];
ImageViewerComponent.propDecorators = {
    src: [{ type: Input, args: ['src',] }],
    filetype: [{ type: Input, args: ['filetype',] }],
    width: [{ type: Input, args: ['width',] }],
    height: [{ type: Input, args: ['height',] }],
    canvasRef: [{ type: ViewChild, args: ['imageContainer', { static: false },] }]
};
function testFile(file, regexTest) {
    if (!file) {
        return false;
    }
    const name = file instanceof File ? file.name : file;
    return name.toLowerCase().match(regexTest) !== null;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW1hZ2V2aWV3ZXIuY29tcG9uZW50LmpzIiwic291cmNlUm9vdCI6Ii9ob21lL3RyYXZpcy9idWlsZC9lbWF6djcyL25neC1pbWFnZXZpZXdlci9wcm9qZWN0cy9uZ3gtaW1hZ2V2aWV3ZXIvc3JjLyIsInNvdXJjZXMiOlsibGliL2ltYWdldmlld2VyLmNvbXBvbmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsU0FBUyxFQUFFLEtBQUssRUFBRSxTQUFTLEVBQWlCLFNBQVMsRUFBRSxNQUFNLEVBQWEsTUFBTSxlQUFlLENBQUM7QUFDekcsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBR3pELE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxrQkFBa0IsRUFBRSwwQkFBMEIsRUFBNkIsTUFBTSxzQkFBc0IsQ0FBQztBQUNwSSxPQUFPLEVBQVksTUFBTSxFQUFFLGFBQWEsRUFBa0IsTUFBTSxxQkFBcUIsQ0FBQztBQUN0RixPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSxnQkFBZ0IsQ0FBQztBQUNyRCxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxzQkFBc0IsQ0FBQztBQUN6RCxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxjQUFjLENBQUM7QUFFakQsTUFBTSx1QkFBdUIsR0FBRyxHQUFHLENBQUM7QUFpQnBDLE1BQU0sT0FBTyxvQkFBb0I7SUE4RS9CLFlBQVk7SUFFWiwwQkFBMEI7SUFDMUIsWUFDVSxVQUF3QixFQUN4QixTQUFvQixFQUNwQixXQUE4QixFQUNGLE1BQXlCO1FBSHJELGVBQVUsR0FBVixVQUFVLENBQWM7UUFDeEIsY0FBUyxHQUFULFNBQVMsQ0FBVztRQUNwQixnQkFBVyxHQUFYLFdBQVcsQ0FBbUI7UUFDRixXQUFNLEdBQU4sTUFBTSxDQUFtQjtRQXZDL0QsY0FBYztRQUNOLFdBQU0sR0FBRyxJQUFJLENBQUM7UUFXdEIsOEJBQThCO1FBQ3RCLGFBQVEsR0FBRyxFQUFFLENBQUM7UUFF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Qy9CLElBQUksSUFBSSxDQUFDLFNBQVMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLFdBQVcsRUFBRSxLQUFLLEtBQUssRUFBRTtZQUFFLE9BQU8sSUFBSSxDQUFDO1NBQUU7UUFDOUUsT0FBTyxRQUFRLENBQUMsSUFBSSxFQUFFLDBCQUEwQixDQUFDLENBQUM7SUFDcEQsQ0FBQzs7O1lBbmVGLFNBQVMsU0FBQztnQkFDVCxRQUFRLEVBQUUsaUJBQWlCO2dCQUMzQixRQUFRLEVBQUU7Ozs7OztHQU1UO3lCQUNROzs7O0dBSVI7YUFDRjs7O1lBekJRLFlBQVk7WUFEZ0MsU0FBUztZQU9yRCxpQkFBaUI7WUFIakIsaUJBQWlCLHVCQTRHckIsTUFBTSxTQUFDLGtCQUFrQjs7O2tCQWhGM0IsS0FBSyxTQUFDLEtBQUs7dUJBU1gsS0FBSyxTQUFDLFVBQVU7b0JBUWhCLEtBQUssU0FBQyxPQUFPO3FCQVNiLEtBQUssU0FBQyxRQUFRO3dCQU9kLFNBQVMsU0FBQyxnQkFBZ0IsRUFBRSxFQUFDLE1BQU0sRUFBRSxLQUFLLEVBQUM7O0FBa2I5QyxTQUFTLFFBQVEsQ0FBQyxJQUFtQixFQUFFLFNBQWlCO0lBQ3RELElBQUksQ0FBQyxJQUFJLEVBQUU7UUFBRSxPQUFPLEtBQUssQ0FBQztLQUFFO0lBQzVCLE1BQU0sSUFBSSxHQUFHLElBQUksWUFBWSxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztJQUNyRCxPQUFPLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLEtBQUssSUFBSSxDQUFDO0FBQ3RELENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBDb21wb25lbnQsIElucHV0LCBWaWV3Q2hpbGQsIEFmdGVyVmlld0luaXQsIFJlbmRlcmVyMiwgSW5qZWN0LCBPbkRlc3Ryb3kgfSBmcm9tICdAYW5ndWxhci9jb3JlJztcbmltcG9ydCB7IERvbVNhbml0aXplciB9IGZyb20gJ0Bhbmd1bGFyL3BsYXRmb3JtLWJyb3dzZXInO1xuaW1wb3J0IHsgU3Vic2NyaXB0aW9uIH0gZnJvbSAncnhqcyc7XG5cbmltcG9ydCB7IEltYWdlVmlld2VyQ29uZmlnLCBJTUFHRVZJRVdFUl9DT05GSUcsIElNQUdFVklFV0VSX0NPTkZJR19ERUZBVUxULCBCdXR0b25Db25maWcsIEJ1dHRvblN0eWxlIH0gZnJvbSAnLi9pbWFnZXZpZXdlci5jb25maWcnO1xuaW1wb3J0IHsgVmlld3BvcnQsIEJ1dHRvbiwgdG9TcXVhcmVBbmdsZSwgUmVzb3VyY2VMb2FkZXIgfSBmcm9tICcuL2ltYWdldmlld2VyLm1vZGVsJztcbmltcG9ydCB7IEltYWdlUmVzb3VyY2VMb2FkZXIgfSBmcm9tICcuL2ltYWdlLmxvYWRlcic7XG5pbXBvcnQgeyBJbWFnZUNhY2hlU2VydmljZSB9IGZyb20gJy4vaW1hZ2VjYWNoZS5zZXJ2aWNlJztcbmltcG9ydCB7IFBkZlJlc291cmNlTG9hZGVyIH0gZnJvbSAnLi9wZGYubG9hZGVyJztcblxuY29uc3QgTUlOX1RPT0xUSVBfV0lEVEhfU1BBQ0UgPSA1MDA7XG5cbkBDb21wb25lbnQoe1xuICBzZWxlY3RvcjogJ25neC1pbWFnZXZpZXdlcicsXG4gIHRlbXBsYXRlOiBgXG4gICAgPGNhbnZhcyAjaW1hZ2VDb250YWluZXIgW3dpZHRoXT1cIndpZHRoXCIgW2hlaWdodF09XCJoZWlnaHRcIlxuICAgICAgKGNsaWNrKT1cIm9uVGFwKCRldmVudClcIiAocGluY2hpbik9XCJwcm9jZXNzVG91Y2hFdmVudCgkZXZlbnQpXCIgKHBpbmNob3V0KT1cInByb2Nlc3NUb3VjaEV2ZW50KCRldmVudClcIlxuICAgICAgKHBhbm1vdmUpPVwicHJvY2Vzc1RvdWNoRXZlbnQoJGV2ZW50KVwiIChwYW5lbmQpPVwib25Ub3VjaEVuZCgpXCIgKHJvdGF0ZW1vdmUpPVwicHJvY2Vzc1RvdWNoRXZlbnQoJGV2ZW50KVwiXG4gICAgICAocm90YXRlZW5kKT1cIm9uVG91Y2hFbmQoKVwiPlxuICAgIDwvY2FudmFzPlxuICBgLFxuICBzdHlsZXM6IFtgXG4gICAgOmhvc3QgeyBkaXNwbGF5OiBibG9jayB9XG4gICAgOmhvc3QgY2FudmFzIHsgbWFyZ2luOiAwIGF1dG87IGRpc3BsYXk6IGJsb2NrIH1cbiAgICBbaGlkZGVuXSB7IGRpc3BsYXk6IG5vbmUgIWltcG9ydGFudCB9XG4gIGBdXG59KVxuZXhwb3J0IGNsYXNzIEltYWdlVmlld2VyQ29tcG9uZW50IGltcGxlbWVudHMgQWZ0ZXJWaWV3SW5pdCwgT25EZXN0cm95IHtcblxuICAvLyNyZWdpb24gSW5wdXQgcHJvcGVydGllc1xuICBwcml2YXRlIF9zcmM6IHN0cmluZyB8IEZpbGU7XG4gIGdldCBzcmMoKSB7IHJldHVybiB0aGlzLl9zcmM7IH1cbiAgQElucHV0KCdzcmMnKSBzZXQgc3JjKHZhbHVlKSB7XG4gICAgaWYgKHZhbHVlID09PSB0aGlzLl9zcmMpIHsgcmV0dXJuOyB9XG4gICAgdGhpcy5fc3JjID0gdmFsdWU7XG4gICAgdGhpcy5zZXRVcFJlc291cmNlKCk7XG4gIH1cblxuICAvLyBGSVggbm90IHdvcmtpZ24gcHJvcGVybHlcbiAgcHJpdmF0ZSBfZmlsZXR5cGU6IHN0cmluZztcbiAgZ2V0IGZpbGV0eXBlKCkgeyByZXR1cm4gdGhpcy5fZmlsZXR5cGU7IH1cbiAgQElucHV0KCdmaWxldHlwZScpIHNldCBmaWxldHlwZSh2YWx1ZTogc3RyaW5nKSB7XG4gICAgaWYgKHZhbHVlID09PSB0aGlzLl9maWxldHlwZSkgeyByZXR1cm47IH1cbiAgICB0aGlzLl9maWxldHlwZSA9IHZhbHVlO1xuICAgIHRoaXMuc2V0VXBSZXNvdXJjZSgpO1xuICB9XG5cbiAgcHJpdmF0ZSBfd2lkdGg6IG51bWJlcjtcbiAgZ2V0IHdpZHRoKCkgeyByZXR1cm4gdGhpcy5fd2lkdGg7IH1cbiAgQElucHV0KCd3aWR0aCcpIHNldCB3aWR0aCh2YWx1ZSkge1xuICAgIGlmICh2YWx1ZSA9PT0gdGhpcy5fd2lkdGgpIHsgcmV0dXJuOyB9XG4gICAgdGhpcy5fd2lkdGggPSB2YWx1ZTtcbiAgICBpZiAodGhpcy5fY2FudmFzKSB7IHRoaXMuX2NhbnZhcy53aWR0aCA9IHRoaXMuX3dpZHRoOyB9XG4gICAgdGhpcy5yZXNldEltYWdlKCk7XG4gIH1cblxuICBwcml2YXRlIF9oZWlnaHQ6IG51bWJlcjtcbiAgZ2V0IGhlaWdodCgpIHsgcmV0dXJuIHRoaXMuX2hlaWdodDsgfVxuICBASW5wdXQoJ2hlaWdodCcpIHNldCBoZWlnaHQodmFsdWUpIHtcbiAgICBpZiAodmFsdWUgPT09IHRoaXMuX2hlaWdodCkgeyByZXR1cm47IH1cbiAgICB0aGlzLl9oZWlnaHQgPSB2YWx1ZTtcbiAgICBpZiAodGhpcy5fY2FudmFzKSB7IHRoaXMuX2NhbnZhcy5oZWlnaHQgPSB0aGlzLl9oZWlnaHQ7IH1cbiAgICB0aGlzLnJlc2V0SW1hZ2UoKTtcbiAgfVxuXG4gIEBWaWV3Q2hpbGQoJ2ltYWdlQ29udGFpbmVyJywge3N0YXRpYzogZmFsc2V9KSBjYW52YXNSZWY6IGFueTtcbiAgLy8jZW5kcmVnaW9uXG5cbiAgLy8jcmVnaW9uIFByaXZhdGUgcHJvcGVydGllc1xuICAvLyBDYW52YXMgMkQgY29udGV4dFxuICBwcml2YXRlIF9jYW52YXM6IEhUTUxDYW52YXNFbGVtZW50O1xuICBwcml2YXRlIF9jb250ZXh0OiBDYW52YXNSZW5kZXJpbmdDb250ZXh0MkQ7XG5cbiAgLy8gZGlydHkgc3RhdGVcbiAgcHJpdmF0ZSBfZGlydHkgPSB0cnVlO1xuXG4gIC8vIGFjdGlvbiBidXR0b25zXG4gIHByaXZhdGUgX25leHRQYWdlQnV0dG9uOiBCdXR0b247XG4gIHByaXZhdGUgX2JlZm9yZVBhZ2VCdXR0b246IEJ1dHRvbjtcbiAgcHJpdmF0ZSBfem9vbU91dEJ1dHRvbjogQnV0dG9uO1xuICBwcml2YXRlIF96b29tSW5CdXR0b246IEJ1dHRvbjtcbiAgcHJpdmF0ZSBfcm90YXRlTGVmdEJ1dHRvbjogQnV0dG9uO1xuICBwcml2YXRlIF9yb3RhdGVSaWdodEJ1dHRvbjogQnV0dG9uO1xuICBwcml2YXRlIF9yZXNldEJ1dHRvbjogQnV0dG9uO1xuXG4gIC8vIGNvbnRhaW5zIGFsbCBhY3RpdmUgYnV0dG9uc1xuICBwcml2YXRlIF9idXR0b25zID0gW107XG5cbiAgLy8gY3VycmVudCB0b29sIHRpcCAodXNlZCB0byB0cmFjayBjaGFuZ2Ugb2YgdG9vbCB0aXApXG4gIHByaXZhdGUgX2N1cnJlbnRUb29sdGlwID0gbnVsbDtcblxuICAvLyBjYWNoZWQgZGF0YSB3aGVuIHRvdWNoIGV2ZW50cyBzdGFydGVkXG4gIHByaXZhdGUgX3RvdWNoU3RhcnRTdGF0ZTogYW55ID0ge307XG5cbiAgLy8gbGlzdCBvZiBldmVudCBsaXN0ZW5lciBkZXN0cm95ZXJzXG4gIHByaXZhdGUgX2xpc3RlbkRlc3Ryb3lMaXN0ID0gW107XG5cbiAgLy8gaW1hZ2UgLyBQZGYgRHJhd2FibGUgUmVzb3VyY2VcbiAgcHJpdmF0ZSBfcmVzb3VyY2U6IFJlc291cmNlTG9hZGVyO1xuICBwcml2YXRlIF9yZXNvdXJjZUNoYW5nZVN1YjogU3Vic2NyaXB0aW9uO1xuXG4gIC8vIENhY2hpbmcgcmVzb3VyY2VMb2FkZXIgaW5zdGFuY2VzIHRvIHJldXNlXG4gIHByaXZhdGUgX2ltYWdlUmVzb3VyY2U6IEltYWdlUmVzb3VyY2VMb2FkZXI7XG4gIHByaXZhdGUgX3BkZlJlc291cmNlOiBQZGZSZXNvdXJjZUxvYWRlcjtcblxuICAvLyNlbmRyZWdpb25cblxuICAvLyNyZWdpb24gTGlmZWN5Y2xlIGV2ZW50c1xuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIF9zYW5pdGl6ZXI6IERvbVNhbml0aXplcixcbiAgICBwcml2YXRlIF9yZW5kZXJlcjogUmVuZGVyZXIyLFxuICAgIHByaXZhdGUgX2ltYWdlQ2FjaGU6IEltYWdlQ2FjaGVTZXJ2aWNlLFxuICAgIEBJbmplY3QoSU1BR0VWSUVXRVJfQ09ORklHKSBwcml2YXRlIGNvbmZpZzogSW1hZ2VWaWV3ZXJDb25maWdcbiAgKSB7XG4gICAgdGhpcy5jb25maWcgPSB0aGlzLmV4dGVuZHNEZWZhdWx0Q29uZmlnKGNvbmZpZyk7XG4gICAgdGhpcy5fbmV4dFBhZ2VCdXR0b24gPSBuZXcgQnV0dG9uKHRoaXMuY29uZmlnLm5leHRQYWdlQnV0dG9uLCB0aGlzLmNvbmZpZy5idXR0b25TdHlsZSk7XG4gICAgdGhpcy5fYmVmb3JlUGFnZUJ1dHRvbiA9IG5ldyBCdXR0b24odGhpcy5jb25maWcuYmVmb3JlUGFnZUJ1dHRvbiwgdGhpcy5jb25maWcuYnV0dG9uU3R5bGUpO1xuICAgIHRoaXMuX3pvb21PdXRCdXR0b24gPSBuZXcgQnV0dG9uKHRoaXMuY29uZmlnLnpvb21PdXRCdXR0b24sIHRoaXMuY29uZmlnLmJ1dHRvblN0eWxlKTtcbiAgICB0aGlzLl96b29tSW5CdXR0b24gPSBuZXcgQnV0dG9uKHRoaXMuY29uZmlnLnpvb21JbkJ1dHRvbiwgdGhpcy5jb25maWcuYnV0dG9uU3R5bGUpO1xuICAgIHRoaXMuX3JvdGF0ZUxlZnRCdXR0b24gPSBuZXcgQnV0dG9uKHRoaXMuY29uZmlnLnJvdGF0ZUxlZnRCdXR0b24sIHRoaXMuY29uZmlnLmJ1dHRvblN0eWxlKTtcbiAgICB0aGlzLl9yb3RhdGVSaWdodEJ1dHRvbiA9IG5ldyBCdXR0b24odGhpcy5jb25maWcucm90YXRlUmlnaHRCdXR0b24sIHRoaXMuY29uZmlnLmJ1dHRvblN0eWxlKTtcbiAgICB0aGlzLl9yZXNldEJ1dHRvbiA9IG5ldyBCdXR0b24odGhpcy5jb25maWcucmVzZXRCdXR0b24sIHRoaXMuY29uZmlnLmJ1dHRvblN0eWxlKTtcbiAgICB0aGlzLl9idXR0b25zID0gW1xuICAgICAgdGhpcy5fem9vbU91dEJ1dHRvbixcbiAgICAgIHRoaXMuX3pvb21JbkJ1dHRvbixcbiAgICAgIHRoaXMuX3JvdGF0ZUxlZnRCdXR0b24sXG4gICAgICB0aGlzLl9yb3RhdGVSaWdodEJ1dHRvbixcbiAgICAgIHRoaXMuX3Jlc2V0QnV0dG9uXG4gICAgXS5maWx0ZXIoaXRlbSA9PiBpdGVtLmRpc3BsYXkpXG4gICAgICAuc29ydCgoYSwgYikgPT4gYS5zb3J0SWQgLSBiLnNvcnRJZCk7XG4gIH1cblxuICBuZ0FmdGVyVmlld0luaXQoKSB7XG4gICAgdGhpcy5fY2FudmFzID0gdGhpcy5jYW52YXNSZWYubmF0aXZlRWxlbWVudDtcbiAgICB0aGlzLl9jb250ZXh0ID0gdGhpcy5fY2FudmFzLmdldENvbnRleHQoJzJkJyk7XG5cbiAgICAvLyBzZXR0aW5nIGNhbnZhcyBkaW1lbnRpb25cbiAgICB0aGlzLl9jYW52YXMud2lkdGggPSB0aGlzLndpZHRoIHx8IHRoaXMuY29uZmlnLndpZHRoO1xuICAgIHRoaXMuX2NhbnZhcy5oZWlnaHQgPSB0aGlzLmhlaWdodCB8fCB0aGlzLmNvbmZpZy5oZWlnaHQ7XG5cbiAgICAvLyBzZXR0aW5nIGJ1dHRvbnMgYWN0aW9uc1xuICAgIHRoaXMuX25leHRQYWdlQnV0dG9uLm9uQ2xpY2sgPSAoZXZ0KSA9PiB7IHRoaXMubmV4dFBhZ2UoKTsgcmV0dXJuIGZhbHNlOyB9O1xuICAgIHRoaXMuX2JlZm9yZVBhZ2VCdXR0b24ub25DbGljayA9IChldnQpID0+IHsgdGhpcy5wcmV2aW91c1BhZ2UoKTsgcmV0dXJuIGZhbHNlOyB9O1xuICAgIHRoaXMuX3pvb21PdXRCdXR0b24ub25DbGljayA9IChldnQpID0+IHsgdGhpcy56b29tT3V0KCk7IHJldHVybiBmYWxzZTsgfTtcbiAgICB0aGlzLl96b29tSW5CdXR0b24ub25DbGljayA9IChldnQpID0+IHsgdGhpcy56b29tSW4oKTsgcmV0dXJuIGZhbHNlOyB9O1xuICAgIHRoaXMuX3JvdGF0ZUxlZnRCdXR0b24ub25DbGljayA9IChldnQpID0+IHsgdGhpcy5yb3RhdGVMZWZ0KCk7IHJldHVybiBmYWxzZTsgfTtcbiAgICB0aGlzLl9yb3RhdGVSaWdodEJ1dHRvbi5vbkNsaWNrID0gKGV2dCkgPT4geyB0aGlzLnJvdGF0ZVJpZ2h0KCk7IHJldHVybiBmYWxzZTsgfTtcbiAgICB0aGlzLl9yZXNldEJ1dHRvbi5vbkNsaWNrID0gKGV2dCkgPT4geyB0aGlzLnJlc2V0SW1hZ2UoKTsgcmV0dXJuIGZhbHNlOyB9O1xuXG4gICAgLy8gcmVnaXN0ZXIgZXZlbnQgbGlzdGVuZXJzXG4gICAgdGhpcy5hZGRFdmVudExpc3RlbmVycygpO1xuXG4gICAgdGhpcy51cGRhdGVDYW52YXMoKTtcbiAgfVxuXG4gIG5nT25EZXN0cm95KCkge1xuICAgIC8vIHVucmVnaXN0ZSBldmVudCBsaXN0ZW5lcnNcbiAgICB0aGlzLl9saXN0ZW5EZXN0cm95TGlzdC5mb3JFYWNoKGxpc3RlbkRlc3Ryb3kgPT4ge1xuICAgICAgaWYgKHR5cGVvZiBsaXN0ZW5EZXN0cm95ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGxpc3RlbkRlc3Ryb3koKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICB0aGlzLl9pbWFnZUNhY2hlLmRpc3Bvc2VDYWNoZSgpO1xuICB9XG5cbiAgc2V0VXBSZXNvdXJjZSgpIHtcbiAgICBpZiAodGhpcy5pc0ltYWdlKHRoaXMuc3JjKSAmJiAoIXRoaXMuX3Jlc291cmNlIHx8ICEodGhpcy5fcmVzb3VyY2UgaW5zdGFuY2VvZiBJbWFnZVJlc291cmNlTG9hZGVyKSkpIHtcbiAgICAgIGlmICh0aGlzLl9yZXNvdXJjZUNoYW5nZVN1Yikge1xuICAgICAgICB0aGlzLl9yZXNvdXJjZUNoYW5nZVN1Yi51bnN1YnNjcmliZSgpO1xuICAgICAgfVxuICAgICAgaWYgKCF0aGlzLl9pbWFnZVJlc291cmNlKSB7XG4gICAgICAgIHRoaXMuX2ltYWdlUmVzb3VyY2UgPSBuZXcgSW1hZ2VSZXNvdXJjZUxvYWRlcigpO1xuICAgICAgfVxuICAgICAgdGhpcy5fcmVzb3VyY2UgPSB0aGlzLl9pbWFnZVJlc291cmNlO1xuICAgIH0gZWxzZSBpZiAodGhpcy5pc1BkZih0aGlzLnNyYykgJiYgKCF0aGlzLl9yZXNvdXJjZSB8fCAhKHRoaXMuX3Jlc291cmNlIGluc3RhbmNlb2YgUGRmUmVzb3VyY2VMb2FkZXIpKSkge1xuICAgICAgaWYgKHRoaXMuX3Jlc291cmNlQ2hhbmdlU3ViKSB7XG4gICAgICAgIHRoaXMuX3Jlc291cmNlQ2hhbmdlU3ViLnVuc3Vic2NyaWJlKCk7XG4gICAgICB9XG4gICAgICBpZiAoIXRoaXMuX3BkZlJlc291cmNlKSB7XG4gICAgICAgIHRoaXMuX3BkZlJlc291cmNlID0gbmV3IFBkZlJlc291cmNlTG9hZGVyKHRoaXMuX2ltYWdlQ2FjaGUpO1xuICAgICAgfVxuICAgICAgdGhpcy5fcmVzb3VyY2UgPSB0aGlzLl9wZGZSZXNvdXJjZTtcbiAgICB9XG4gICAgaWYgKHRoaXMuX3Jlc291cmNlKSB7XG4gICAgICB0aGlzLl9yZXNvdXJjZS5zcmMgPSB0aGlzLnNyYyBpbnN0YW5jZW9mIEZpbGUgPyBVUkwuY3JlYXRlT2JqZWN0VVJMKHRoaXMuc3JjKSA6IHRoaXMuc3JjO1xuICAgICAgdGhpcy5fcmVzb3VyY2VDaGFuZ2VTdWIgPSB0aGlzLl9yZXNvdXJjZS5vblJlc291cmNlQ2hhbmdlKCkuc3Vic2NyaWJlKCgpID0+IHtcbiAgICAgICAgdGhpcy51cGRhdGVDYW52YXMoKTtcbiAgICAgICAgaWYgKHRoaXMuc3JjIGluc3RhbmNlb2YgRmlsZSkge1xuICAgICAgICAgIFVSTC5yZXZva2VPYmplY3RVUkwodGhpcy5fcmVzb3VyY2Uuc3JjKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICB0aGlzLl9yZXNvdXJjZS5zZXRVcCgpO1xuICAgICAgdGhpcy5yZXNldEltYWdlKCk7XG4gICAgICBpZiAodGhpcy5fY29udGV4dCkgeyB0aGlzLnVwZGF0ZUNhbnZhcygpOyB9XG4gICAgfVxuICB9XG4gIC8vI2VuZHJlZ2lvblxuXG4gIC8vI3JlZ2lvbiBUb3VjaCBldmVudHNcbiAgb25UYXAoZXZ0KSB7XG4gICAgY29uc3QgcG9zaXRpb24gPSB7IHg6IGV2dC5wYWdlWCwgeTogZXZ0LnBhZ2VZIH07XG4gICAgY29uc3QgYWN0aXZlRWxlbWVudCA9IHRoaXMuZ2V0VUlFbGVtZW50KHRoaXMuc2NyZWVuVG9DYW52YXNDZW50cmUocG9zaXRpb24pKTtcbiAgICBpZiAoYWN0aXZlRWxlbWVudCAhPT0gbnVsbCkgeyBhY3RpdmVFbGVtZW50Lm9uQ2xpY2soZXZ0KTsgfVxuICB9XG5cbiAgb25Ub3VjaEVuZCgpIHtcbiAgICB0aGlzLl90b3VjaFN0YXJ0U3RhdGUudmlld3BvcnQgPSB1bmRlZmluZWQ7XG4gICAgdGhpcy5fdG91Y2hTdGFydFN0YXRlLnNjYWxlID0gdW5kZWZpbmVkO1xuICAgIHRoaXMuX3RvdWNoU3RhcnRTdGF0ZS5yb3RhdGUgPSB1bmRlZmluZWQ7XG4gIH1cblxuICBwcm9jZXNzVG91Y2hFdmVudChldnQpIHtcbiAgICAvLyBwcm9jZXNzIHBhblxuICAgIGlmICghdGhpcy5fdG91Y2hTdGFydFN0YXRlLnZpZXdwb3J0KSB7IHRoaXMuX3RvdWNoU3RhcnRTdGF0ZS52aWV3cG9ydCA9IE9iamVjdC5hc3NpZ24oe30sIHRoaXMuX3Jlc291cmNlLnZpZXdwb3J0KTsgfVxuXG4gICAgY29uc3Qgdmlld3BvcnQgPSB0aGlzLl9yZXNvdXJjZS52aWV3cG9ydDtcbiAgICB2aWV3cG9ydC54ID0gdGhpcy5fdG91Y2hTdGFydFN0YXRlLnZpZXdwb3J0LnggKyBldnQuZGVsdGFYO1xuICAgIHZpZXdwb3J0LnkgPSB0aGlzLl90b3VjaFN0YXJ0U3RhdGUudmlld3BvcnQueSArIGV2dC5kZWx0YVk7XG5cbiAgICAvLyBwcm9jZXNzIHBpbmNoIGluL291dFxuICAgIGlmICghdGhpcy5fdG91Y2hTdGFydFN0YXRlLnNjYWxlKSB7IHRoaXMuX3RvdWNoU3RhcnRTdGF0ZS5zY2FsZSA9IHRoaXMuX3Jlc291cmNlLnZpZXdwb3J0LnNjYWxlOyB9XG4gICAgY29uc3QgbmV3U2NhbGUgPSB0aGlzLl90b3VjaFN0YXJ0U3RhdGUuc2NhbGUgKiBldnQuc2NhbGU7XG4gICAgdmlld3BvcnQuc2NhbGUgPSBuZXdTY2FsZSA+IHRoaXMuX3Jlc291cmNlLm1heFNjYWxlID8gdGhpcy5fcmVzb3VyY2UubWF4U2NhbGUgOlxuICAgICAgbmV3U2NhbGUgPCB0aGlzLl9yZXNvdXJjZS5taW5TY2FsZSA/IHRoaXMuX3Jlc291cmNlLm1pblNjYWxlIDogbmV3U2NhbGU7XG5cbiAgICAvLyBwcm9jZXNzIHJvdGF0ZSBsZWZ0L3JpZ2h0XG4gICAgaWYgKCF0aGlzLl90b3VjaFN0YXJ0U3RhdGUucm90YXRlKSB7IHRoaXMuX3RvdWNoU3RhcnRTdGF0ZS5yb3RhdGUgPSB7IHJvdGF0aW9uOiB2aWV3cG9ydC5yb3RhdGlvbiwgc3RhcnRSb3RhdGU6IGV2dC5yb3RhdGlvbiB9OyB9XG4gICAgaWYgKGV2dC5yb3RhdGlvbiAhPT0gMCkge1xuICAgICAgY29uc3QgbmV3QW5nbGUgPSB0aGlzLl90b3VjaFN0YXJ0U3RhdGUucm90YXRlLnJvdGF0aW9uICsgZXZ0LnJvdGF0aW9uIC0gdGhpcy5fdG91Y2hTdGFydFN0YXRlLnJvdGF0ZS5zdGFydFJvdGF0ZTtcbiAgICAgIHZpZXdwb3J0LnJvdGF0aW9uID0gdGhpcy5jb25maWcucm90YXRlU3RlcHBlciA/IHRvU3F1YXJlQW5nbGUobmV3QW5nbGUpIDogbmV3QW5nbGU7XG4gICAgfVxuICAgIHRoaXMuX2RpcnR5ID0gdHJ1ZTtcbiAgfVxuICAvLyNlbmRyZWdpb25cblxuICAvLyNyZWdpb24gTW91c2UgRXZlbnRzXG4gIHByaXZhdGUgYWRkRXZlbnRMaXN0ZW5lcnMoKSB7XG4gICAgLy8gem9vbWluZ1xuICAgIHRoaXMuX2xpc3RlbkRlc3Ryb3lMaXN0LnB1c2godGhpcy5fcmVuZGVyZXIubGlzdGVuKHRoaXMuX2NhbnZhcywgJ0RPTU1vdXNlU2Nyb2xsJywgKGV2dCkgPT4gdGhpcy5vbk1vdXNlV2hlZWwoZXZ0KSkpO1xuICAgIHRoaXMuX2xpc3RlbkRlc3Ryb3lMaXN0LnB1c2godGhpcy5fcmVuZGVyZXIubGlzdGVuKHRoaXMuX2NhbnZhcywgJ21vdXNld2hlZWwnLCAoZXZ0KSA9PiB0aGlzLm9uTW91c2VXaGVlbChldnQpKSk7XG5cbiAgICAvLyBzaG93IHRvb2x0aXAgd2hlbiBtb3VzZW92ZXIgaXRcbiAgICB0aGlzLl9saXN0ZW5EZXN0cm95TGlzdC5wdXNoKHRoaXMuX3JlbmRlcmVyLmxpc3Rlbih0aGlzLl9jYW52YXMsICdtb3VzZW1vdmUnLCAoZXZ0KSA9PlxuICAgICAgdGhpcy5jaGVja1Rvb2x0aXBBY3RpdmF0aW9uKHRoaXMuc2NyZWVuVG9DYW52YXNDZW50cmUoeyB4OiBldnQuY2xpZW50WCwgeTogZXZ0LmNsaWVudFkgfSkpXG4gICAgKSk7XG4gIH1cblxuICBwcml2YXRlIG9uTW91c2VXaGVlbChldnQpIHtcbiAgICBpZiAoIWV2dCkgeyBldnQgPSBldmVudDsgfVxuICAgIGV2dC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGlmIChldnQuZGV0YWlsIDwgMCB8fCBldnQud2hlZWxEZWx0YSA+IDApIHsgLy8gdXAgLT4gbGFyZ2VyXG4gICAgICB0aGlzLnpvb21JbigpO1xuICAgIH0gZWxzZSB7IC8vIGRvd24gLT4gc21hbGxlclxuICAgICAgdGhpcy56b29tT3V0KCk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBjaGVja1Rvb2x0aXBBY3RpdmF0aW9uKHBvczogeyB4OiBudW1iZXIsIHk6IG51bWJlciB9KSB7XG4gICAgdGhpcy5nZXRVSUVsZW1lbnRzKCkuZm9yRWFjaCh4ID0+IHguaG92ZXIgPSBmYWxzZSk7XG4gICAgY29uc3QgYWN0aXZlRWxlbWVudCA9IHRoaXMuZ2V0VUlFbGVtZW50KHBvcyk7XG4gICAgY29uc3Qgb2xkVG9vbFRpcCA9IHRoaXMuX2N1cnJlbnRUb29sdGlwO1xuICAgIGlmIChhY3RpdmVFbGVtZW50ICE9PSBudWxsKSB7XG4gICAgICBpZiAodHlwZW9mIGFjdGl2ZUVsZW1lbnQuaG92ZXIgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIGFjdGl2ZUVsZW1lbnQuaG92ZXIgPSB0cnVlO1xuICAgICAgfVxuICAgICAgaWYgKHR5cGVvZiBhY3RpdmVFbGVtZW50LnRvb2x0aXAgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIHRoaXMuX2N1cnJlbnRUb29sdGlwID0gYWN0aXZlRWxlbWVudC50b29sdGlwO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAob2xkVG9vbFRpcCAhPT0gdGhpcy5fY3VycmVudFRvb2x0aXApIHsgdGhpcy5fZGlydHkgPSB0cnVlOyB9XG4gIH1cbiAgLy8jZW5kcmVnaW9uXG5cbiAgLy8jcmVnaW9uIEJ1dHRvbiBBY3Rpb25zXG5cbiAgcHJpdmF0ZSBuZXh0UGFnZSgpIHtcbiAgICBpZiAoIXRoaXMuX3Jlc291cmNlKSB7IHJldHVybjsgfVxuICAgIGlmICh0aGlzLl9yZXNvdXJjZS5jdXJyZW50SXRlbSA+PSB0aGlzLl9yZXNvdXJjZS50b3RhbEl0ZW0pIHsgcmV0dXJuOyB9XG4gICAgaWYgKHRoaXMuX3Jlc291cmNlLmN1cnJlbnRJdGVtIDwgMSkgeyB0aGlzLl9yZXNvdXJjZS5jdXJyZW50SXRlbSA9IDA7IH1cbiAgICB0aGlzLl9yZXNvdXJjZS5jdXJyZW50SXRlbSsrO1xuICAgIHRoaXMuX3Jlc291cmNlLmxvYWRSZXNvdXJjZSgpO1xuICAgIHRoaXMuX2RpcnR5ID0gdHJ1ZTtcbiAgfVxuXG4gIHByaXZhdGUgcHJldmlvdXNQYWdlKCkge1xuICAgIGlmICghdGhpcy5fcmVzb3VyY2UpIHsgcmV0dXJuOyB9XG4gICAgaWYgKHRoaXMuX3Jlc291cmNlLmN1cnJlbnRJdGVtIDw9IDEpIHsgcmV0dXJuOyB9XG4gICAgaWYgKHRoaXMuX3Jlc291cmNlLmN1cnJlbnRJdGVtID4gdGhpcy5fcmVzb3VyY2UudG90YWxJdGVtKSB7IHRoaXMuX3Jlc291cmNlLmN1cnJlbnRJdGVtID0gdGhpcy5fcmVzb3VyY2UudG90YWxJdGVtICsgMTsgfVxuICAgIHRoaXMuX3Jlc291cmNlLmN1cnJlbnRJdGVtLS07XG4gICAgdGhpcy5fcmVzb3VyY2UubG9hZFJlc291cmNlKCk7XG4gICAgdGhpcy5fZGlydHkgPSB0cnVlO1xuICB9XG5cbiAgcHJpdmF0ZSB6b29tSW4oKSB7XG4gICAgaWYgKCF0aGlzLl9yZXNvdXJjZSkgeyByZXR1cm47IH1cbiAgICBjb25zdCBuZXdTY2FsZSA9IHRoaXMuX3Jlc291cmNlLnZpZXdwb3J0LnNjYWxlICogKDEgKyB0aGlzLmNvbmZpZy5zY2FsZVN0ZXApO1xuICAgIHRoaXMuX3Jlc291cmNlLnZpZXdwb3J0LnNjYWxlID0gbmV3U2NhbGUgPiB0aGlzLl9yZXNvdXJjZS5tYXhTY2FsZSA/IHRoaXMuX3Jlc291cmNlLm1heFNjYWxlIDogbmV3U2NhbGU7XG4gICAgdGhpcy5fZGlydHkgPSB0cnVlO1xuICB9XG5cbiAgcHJpdmF0ZSB6b29tT3V0KCkge1xuICAgIGlmICghdGhpcy5fcmVzb3VyY2UpIHsgcmV0dXJuOyB9XG4gICAgY29uc3QgbmV3U2NhbGUgPSB0aGlzLl9yZXNvdXJjZS52aWV3cG9ydC5zY2FsZSAqICgxIC0gdGhpcy5jb25maWcuc2NhbGVTdGVwKTtcbiAgICB0aGlzLl9yZXNvdXJjZS52aWV3cG9ydC5zY2FsZSA9IG5ld1NjYWxlIDwgdGhpcy5fcmVzb3VyY2UubWluU2NhbGUgPyB0aGlzLl9yZXNvdXJjZS5taW5TY2FsZSA6IG5ld1NjYWxlO1xuICAgIHRoaXMuX2RpcnR5ID0gdHJ1ZTtcbiAgfVxuXG4gIHByaXZhdGUgcm90YXRlTGVmdCgpIHtcbiAgICBpZiAoIXRoaXMuX3Jlc291cmNlKSB7IHJldHVybjsgfVxuICAgIGNvbnN0IHZpZXdwb3J0ID0gdGhpcy5fcmVzb3VyY2Uudmlld3BvcnQ7XG4gICAgdmlld3BvcnQucm90YXRpb24gPSB2aWV3cG9ydC5yb3RhdGlvbiA9PT0gMCA/IDI3MCA6IHZpZXdwb3J0LnJvdGF0aW9uIC0gOTA7XG4gICAgdGhpcy5fZGlydHkgPSB0cnVlO1xuICB9XG5cbiAgcHJpdmF0ZSByb3RhdGVSaWdodCgpIHtcbiAgICBpZiAoIXRoaXMuX3Jlc291cmNlKSB7IHJldHVybjsgfVxuICAgIGNvbnN0IHZpZXdwb3J0ID0gdGhpcy5fcmVzb3VyY2Uudmlld3BvcnQ7XG4gICAgdmlld3BvcnQucm90YXRpb24gPSB2aWV3cG9ydC5yb3RhdGlvbiA9PT0gMjcwID8gMCA6IHZpZXdwb3J0LnJvdGF0aW9uICsgOTA7XG4gICAgdGhpcy5fZGlydHkgPSB0cnVlO1xuICB9XG5cbiAgcHJpdmF0ZSByZXNldEltYWdlKCkge1xuICAgIGlmICghdGhpcy5fcmVzb3VyY2UpIHsgcmV0dXJuOyB9XG4gICAgdGhpcy5fcmVzb3VyY2UucmVzZXRWaWV3cG9ydCh0aGlzLl9jYW52YXMpO1xuICAgIHRoaXMuX2RpcnR5ID0gdHJ1ZTtcbiAgfVxuICAvLyNlbmRyZWdpb25cblxuICAvLyNyZWdpb24gRHJhdyBDYW52YXNcbiAgcHJpdmF0ZSB1cGRhdGVDYW52YXMoKSB7XG4gICAgdGhpcy5yZXNldEltYWdlKCk7XG5cbiAgICAvLyBzdGFydCBuZXcgcmVuZGVyIGxvb3BcbiAgICB0aGlzLnJlbmRlcigpO1xuICB9XG5cbiAgcHJpdmF0ZSByZW5kZXIoKSB7XG4gICAgY29uc3Qgdm0gPSB0aGlzO1xuICAgIC8vIG9ubHkgcmUtcmVuZGVyIGlmIGRpcnR5XG4gICAgaWYgKHRoaXMuX2RpcnR5ICYmIHRoaXMuX3Jlc291cmNlKSB7XG4gICAgICB0aGlzLl9kaXJ0eSA9IGZhbHNlO1xuXG4gICAgICBjb25zdCBjdHggPSB0aGlzLl9jb250ZXh0O1xuICAgICAgY3R4LnNhdmUoKTtcblxuICAgICAgdGhpcy5fcmVzb3VyY2UuZHJhdyhjdHgsIHRoaXMuY29uZmlnLCB0aGlzLl9jYW52YXMsICgpID0+IHtcbiAgICAgICAgY3R4LnJlc3RvcmUoKTtcblxuICAgICAgICBpZiAodm0uX3Jlc291cmNlLmxvYWRlZCkge1xuICAgICAgICAgIC8vIGRyYXcgYnV0dG9uc1xuICAgICAgICAgIHRoaXMuZHJhd0J1dHRvbnMoY3R4KTtcblxuICAgICAgICAgIC8vIGRyYXcgcGFnaW5hdG9yXG4gICAgICAgICAgaWYgKHRoaXMuX3Jlc291cmNlLnNob3dJdGVtc1F1YW50aXR5KSB7XG4gICAgICAgICAgICB0aGlzLmRyYXdQYWdpbmF0b3IoY3R4KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoKCkgPT4gdGhpcy5yZW5kZXIoKSk7XG4gIH1cblxuICBwcml2YXRlIGRyYXdCdXR0b25zKGN0eCkge1xuICAgIGNvbnN0IHBhZGRpbmcgPSB0aGlzLmNvbmZpZy50b29sdGlwcy5wYWRkaW5nO1xuICAgIGNvbnN0IHJhZGl1cyA9IHRoaXMuY29uZmlnLnRvb2x0aXBzLnJhZGl1cztcbiAgICBjb25zdCBnYXAgPSAyICogcmFkaXVzICsgcGFkZGluZztcbiAgICBjb25zdCB4ID0gdGhpcy5fY2FudmFzLndpZHRoIC0gcmFkaXVzIC0gcGFkZGluZztcbiAgICBjb25zdCB5ID0gdGhpcy5fY2FudmFzLmhlaWdodCAtIHJhZGl1cyAtIHBhZGRpbmc7XG5cbiAgICAvLyBkcmF3IGJ1dHRvbnNcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2J1dHRvbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHRoaXMuX2J1dHRvbnNbaV0uZHJhdyhjdHgsIHgsIHkgLSBnYXAgKiBpLCByYWRpdXMpO1xuICAgIH1cblxuICAgIC8vIGRyYXcgdG9vbHRpcFxuICAgIGlmICh0aGlzLl9jdXJyZW50VG9vbHRpcCAhPT0gbnVsbCAmJiB0aGlzLl9jYW52YXMud2lkdGggPiBNSU5fVE9PTFRJUF9XSURUSF9TUEFDRSkge1xuICAgICAgY3R4LnNhdmUoKTtcbiAgICAgIGNvbnN0IGZvbnRTaXplID0gcmFkaXVzO1xuICAgICAgY3R4LmZvbnQgPSBmb250U2l6ZSArICdweCBzYW5zLXNlcmlmJztcblxuICAgICAgLy8gY2FsY3VsYXRlIHBvc2l0aW9uXG4gICAgICBjb25zdCB0ZXh0U2l6ZSA9IGN0eC5tZWFzdXJlVGV4dCh0aGlzLl9jdXJyZW50VG9vbHRpcCkud2lkdGhcbiAgICAgICAgLCByZWN0V2lkdGggPSB0ZXh0U2l6ZSArIHBhZGRpbmdcbiAgICAgICAgLCByZWN0SGVpZ2h0ID0gZm9udFNpemUgKiAwLjcwICsgcGFkZGluZ1xuICAgICAgICAsIHJlY3RYID0gdGhpcy5fY2FudmFzLndpZHRoXG4gICAgICAgICAgLSAoMiAqIHJhZGl1cyArIDIgKiBwYWRkaW5nKSAvLyBidXR0b25zXG4gICAgICAgICAgLSByZWN0V2lkdGhcbiAgICAgICAgLCByZWN0WSA9IHRoaXMuX2NhbnZhcy5oZWlnaHQgLSByZWN0SGVpZ2h0IC0gcGFkZGluZ1xuICAgICAgICAsIHRleHRYID0gcmVjdFggKyAwLjUgKiBwYWRkaW5nXG4gICAgICAgICwgdGV4dFkgPSB0aGlzLl9jYW52YXMuaGVpZ2h0IC0gMS41ICogcGFkZGluZztcblxuICAgICAgY3R4Lmdsb2JhbEFscGhhID0gdGhpcy5jb25maWcudG9vbHRpcHMuYmdBbHBoYTtcbiAgICAgIGN0eC5maWxsU3R5bGUgPSB0aGlzLmNvbmZpZy50b29sdGlwcy5iZ1N0eWxlO1xuICAgICAgdGhpcy5kcmF3Um91bmRSZWN0YW5nbGUoY3R4LCByZWN0WCwgcmVjdFksIHJlY3RXaWR0aCwgcmVjdEhlaWdodCwgOCwgdHJ1ZSwgZmFsc2UpO1xuXG4gICAgICBjdHguZ2xvYmFsQWxwaGEgPSB0aGlzLmNvbmZpZy50b29sdGlwcy50ZXh0QWxwaGE7XG4gICAgICBjdHguZmlsbFN0eWxlID0gdGhpcy5jb25maWcudG9vbHRpcHMudGV4dFN0eWxlO1xuICAgICAgY3R4LmZpbGxUZXh0KHRoaXMuX2N1cnJlbnRUb29sdGlwLCB0ZXh0WCwgdGV4dFkpO1xuXG4gICAgICBjdHgucmVzdG9yZSgpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgZHJhd1BhZ2luYXRvcihjdHgpIHtcbiAgICBjb25zdCBwYWRkaW5nID0gdGhpcy5jb25maWcudG9vbHRpcHMucGFkZGluZztcbiAgICBjb25zdCByYWRpdXMgPSB0aGlzLmNvbmZpZy50b29sdGlwcy5yYWRpdXM7XG4gICAgY29uc3QgbGFiZWxXaWR0aCA9IDUwO1xuICAgIGNvbnN0IHgxID0gKHRoaXMuX2NhbnZhcy53aWR0aCAtIGxhYmVsV2lkdGgpIC8gMiAtIHJhZGl1cyAtIHBhZGRpbmc7IC8vIFByZXZQYWdlQnV0dG9uXG4gICAgY29uc3QgeDIgPSB0aGlzLl9jYW52YXMud2lkdGggLyAyOyAvLyBMYWJlbFxuICAgIGNvbnN0IHgzID0gKHRoaXMuX2NhbnZhcy53aWR0aCArIGxhYmVsV2lkdGgpIC8gMiArIHJhZGl1cyArIHBhZGRpbmc7IC8vIE5leHRQYWdlQnV0dG9uXG4gICAgY29uc3QgeSA9IHRoaXMuX2NhbnZhcy5oZWlnaHQgLSByYWRpdXMgLSBwYWRkaW5nO1xuICAgIGNvbnN0IGxhYmVsID0gdGhpcy5fcmVzb3VyY2UuY3VycmVudEl0ZW0gKyAnLycgKyB0aGlzLl9yZXNvdXJjZS50b3RhbEl0ZW07XG4gICAgY29uc3QgZm9udFNpemUgPSAyNTtcblxuICAgIGN0eC5zYXZlKCk7XG4gICAgdGhpcy5fYmVmb3JlUGFnZUJ1dHRvbi5kcmF3KGN0eCwgeDEsIHksIHJhZGl1cyk7XG4gICAgdGhpcy5fbmV4dFBhZ2VCdXR0b24uZHJhdyhjdHgsIHgzLCB5LCByYWRpdXMpO1xuICAgIGN0eC5yZXN0b3JlKCk7XG5cbiAgICBjdHguc2F2ZSgpO1xuICAgIGN0eC5mb250ID0gZm9udFNpemUgKyAncHggVmVyZGFuYSc7XG4gICAgY3R4LnRleHRBbGlnbiA9ICdjZW50ZXInO1xuICAgIGN0eC5maWxsVGV4dChsYWJlbCwgeDIsIHRoaXMuX2NhbnZhcy5oZWlnaHQgLSBwYWRkaW5nIC0gZm9udFNpemUgLyAyLCBsYWJlbFdpZHRoKTtcbiAgICBjdHgucmVzdG9yZSgpO1xuICB9XG5cbiAgcHJpdmF0ZSBkcmF3Um91bmRSZWN0YW5nbGUoY3R4LCB4LCB5LCB3aWR0aCwgaGVpZ2h0LCByYWRpdXMsIGZpbGwsIHN0cm9rZSkge1xuICAgIHJhZGl1cyA9ICh0eXBlb2YgcmFkaXVzID09PSAnbnVtYmVyJykgPyByYWRpdXMgOiA1O1xuICAgIGZpbGwgPSAodHlwZW9mIGZpbGwgPT09ICdib29sZWFuJykgPyBmaWxsIDogdHJ1ZTsgLy8gZmlsbCA9IGRlZmF1bHRcbiAgICBzdHJva2UgPSAodHlwZW9mIHN0cm9rZSA9PT0gJ2Jvb2xlYW4nKSA/IHN0cm9rZSA6IGZhbHNlO1xuXG4gICAgLy8gZHJhdyByb3VuZCByZWN0YW5nbGVcbiAgICBjdHguYmVnaW5QYXRoKCk7XG4gICAgY3R4Lm1vdmVUbyh4ICsgcmFkaXVzLCB5KTtcbiAgICBjdHgubGluZVRvKHggKyB3aWR0aCAtIHJhZGl1cywgeSk7XG4gICAgY3R4LnF1YWRyYXRpY0N1cnZlVG8oeCArIHdpZHRoLCB5LCB4ICsgd2lkdGgsIHkgKyByYWRpdXMpO1xuICAgIGN0eC5saW5lVG8oeCArIHdpZHRoLCB5ICsgaGVpZ2h0IC0gcmFkaXVzKTtcbiAgICBjdHgucXVhZHJhdGljQ3VydmVUbyh4ICsgd2lkdGgsIHkgKyBoZWlnaHQsIHggKyB3aWR0aCAtIHJhZGl1cywgeSArIGhlaWdodCk7XG4gICAgY3R4LmxpbmVUbyh4ICsgcmFkaXVzLCB5ICsgaGVpZ2h0KTtcbiAgICBjdHgucXVhZHJhdGljQ3VydmVUbyh4LCB5ICsgaGVpZ2h0LCB4LCB5ICsgaGVpZ2h0IC0gcmFkaXVzKTtcbiAgICBjdHgubGluZVRvKHgsIHkgKyByYWRpdXMpO1xuICAgIGN0eC5xdWFkcmF0aWNDdXJ2ZVRvKHgsIHksIHggKyByYWRpdXMsIHkpO1xuICAgIGN0eC5jbG9zZVBhdGgoKTtcblxuICAgIGlmIChmaWxsKSB7IGN0eC5maWxsKCk7IH1cbiAgICBpZiAoc3Ryb2tlKSB7IGN0eC5zdHJva2UoKTsgfVxuICB9XG5cbiAgLy8jZW5kcmVnaW9uXG5cbiAgLy8jcmVnaW9uIFV0aWxzXG5cbiAgcHJpdmF0ZSBleHRlbmRzRGVmYXVsdENvbmZpZyhjZmc6IEltYWdlVmlld2VyQ29uZmlnKSB7XG4gICAgY29uc3QgZGVmYXVsdENmZyA9IElNQUdFVklFV0VSX0NPTkZJR19ERUZBVUxUO1xuICAgIGNvbnN0IGxvY2FsQ2ZnID0gT2JqZWN0LmFzc2lnbih7fSwgZGVmYXVsdENmZywgY2ZnKTtcbiAgICBpZiAoY2ZnLmJ1dHRvblN0eWxlKSB7IGxvY2FsQ2ZnLmJ1dHRvblN0eWxlID0gT2JqZWN0LmFzc2lnbihkZWZhdWx0Q2ZnLmJ1dHRvblN0eWxlLCBjZmcuYnV0dG9uU3R5bGUpOyB9XG4gICAgaWYgKGNmZy50b29sdGlwcykgeyBsb2NhbENmZy50b29sdGlwcyA9IE9iamVjdC5hc3NpZ24oZGVmYXVsdENmZy50b29sdGlwcywgY2ZnLnRvb2x0aXBzKTsgfVxuICAgIGlmIChjZmcubmV4dFBhZ2VCdXR0b24pIHsgbG9jYWxDZmcubmV4dFBhZ2VCdXR0b24gPSBPYmplY3QuYXNzaWduKGRlZmF1bHRDZmcubmV4dFBhZ2VCdXR0b24sIGNmZy5uZXh0UGFnZUJ1dHRvbik7IH1cbiAgICBpZiAoY2ZnLmJlZm9yZVBhZ2VCdXR0b24pIHsgbG9jYWxDZmcuYmVmb3JlUGFnZUJ1dHRvbiA9IE9iamVjdC5hc3NpZ24oZGVmYXVsdENmZy5iZWZvcmVQYWdlQnV0dG9uLCBjZmcuYmVmb3JlUGFnZUJ1dHRvbik7IH1cbiAgICBpZiAoY2ZnLnpvb21PdXRCdXR0b24pIHsgbG9jYWxDZmcuem9vbU91dEJ1dHRvbiA9IE9iamVjdC5hc3NpZ24oZGVmYXVsdENmZy56b29tT3V0QnV0dG9uLCBjZmcuem9vbU91dEJ1dHRvbik7IH1cbiAgICBpZiAoY2ZnLnpvb21PdXRCdXR0b24pIHsgbG9jYWxDZmcuem9vbU91dEJ1dHRvbiA9IE9iamVjdC5hc3NpZ24oZGVmYXVsdENmZy56b29tT3V0QnV0dG9uLCBjZmcuem9vbU91dEJ1dHRvbik7IH1cbiAgICBpZiAoY2ZnLnpvb21JbkJ1dHRvbikgeyBsb2NhbENmZy56b29tSW5CdXR0b24gPSBPYmplY3QuYXNzaWduKGRlZmF1bHRDZmcuem9vbUluQnV0dG9uLCBjZmcuem9vbUluQnV0dG9uKTsgfVxuICAgIGlmIChjZmcucm90YXRlTGVmdEJ1dHRvbikgeyBsb2NhbENmZy5yb3RhdGVMZWZ0QnV0dG9uID0gT2JqZWN0LmFzc2lnbihkZWZhdWx0Q2ZnLnJvdGF0ZUxlZnRCdXR0b24sIGNmZy5yb3RhdGVMZWZ0QnV0dG9uKTsgfVxuICAgIGlmIChjZmcucm90YXRlUmlnaHRCdXR0b24pIHsgbG9jYWxDZmcucm90YXRlUmlnaHRCdXR0b24gPSBPYmplY3QuYXNzaWduKGRlZmF1bHRDZmcucm90YXRlUmlnaHRCdXR0b24sIGNmZy5yb3RhdGVSaWdodEJ1dHRvbik7IH1cbiAgICBpZiAoY2ZnLnJlc2V0QnV0dG9uKSB7IGxvY2FsQ2ZnLnJlc2V0QnV0dG9uID0gT2JqZWN0LmFzc2lnbihkZWZhdWx0Q2ZnLnJlc2V0QnV0dG9uLCBjZmcucmVzZXRCdXR0b24pOyB9XG4gICAgcmV0dXJuIGxvY2FsQ2ZnO1xuICB9XG5cbiAgcHJpdmF0ZSBzY3JlZW5Ub0NhbnZhc0NlbnRyZShwb3M6IHsgeDogbnVtYmVyLCB5OiBudW1iZXIgfSkge1xuICAgIGNvbnN0IHJlY3QgPSB0aGlzLl9jYW52YXMuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgcmV0dXJuIHsgeDogcG9zLnggLSByZWN0LmxlZnQsIHk6IHBvcy55IC0gcmVjdC50b3AgfTtcbiAgfVxuXG4gIHByaXZhdGUgZ2V0VUlFbGVtZW50cygpOiBCdXR0b25bXSB7XG4gICAgY29uc3QgaG92ZXJFbGVtZW50cyA9IHRoaXMuX2J1dHRvbnMuc2xpY2UoKTtcbiAgICBob3ZlckVsZW1lbnRzLnB1c2godGhpcy5fbmV4dFBhZ2VCdXR0b24pO1xuICAgIGhvdmVyRWxlbWVudHMucHVzaCh0aGlzLl9iZWZvcmVQYWdlQnV0dG9uKTtcbiAgICByZXR1cm4gaG92ZXJFbGVtZW50cztcbiAgfVxuXG4gIHByaXZhdGUgZ2V0VUlFbGVtZW50KHBvczogeyB4OiBudW1iZXIsIHk6IG51bWJlciB9KSB7XG4gICAgY29uc3QgYWN0aXZlVUlFbGVtZW50ID0gdGhpcy5nZXRVSUVsZW1lbnRzKCkuZmlsdGVyKCh1aUVsZW1lbnQpID0+IHtcbiAgICAgIHJldHVybiB1aUVsZW1lbnQuaXNXaXRoaW5Cb3VuZHMocG9zLngsIHBvcy55KTtcbiAgICB9KTtcbiAgICByZXR1cm4gKGFjdGl2ZVVJRWxlbWVudC5sZW5ndGggPiAwKSA/IGFjdGl2ZVVJRWxlbWVudFswXSA6IG51bGw7XG4gIH1cblxuICBwcml2YXRlIGlzSW1hZ2UoZmlsZTogc3RyaW5nIHwgRmlsZSkge1xuICAgIGlmICh0aGlzLl9maWxldHlwZSAmJiB0aGlzLl9maWxldHlwZS50b0xvd2VyQ2FzZSgpID09PSAnaW1hZ2UnKSB7IHJldHVybiB0cnVlOyB9XG4gICAgcmV0dXJuIHRlc3RGaWxlKGZpbGUsICdcXFxcLihwbmd8anBnfGpwZWd8Z2lmKXxpbWFnZS9wbmcnKTtcbiAgfVxuXG4gIHByaXZhdGUgaXNQZGYoZmlsZTogc3RyaW5nIHwgRmlsZSkge1xuICAgIGlmICh0aGlzLl9maWxldHlwZSAmJiB0aGlzLl9maWxldHlwZS50b0xvd2VyQ2FzZSgpID09PSAncGRmJykgeyByZXR1cm4gdHJ1ZTsgfVxuICAgIHJldHVybiB0ZXN0RmlsZShmaWxlLCAnXFxcXC4ocGRmKXxhcHBsaWNhdGlvbi9wZGYnKTtcbiAgfVxuICAvLyNlbmRyZWdpb25cbn1cblxuZnVuY3Rpb24gdGVzdEZpbGUoZmlsZTogc3RyaW5nIHwgRmlsZSwgcmVnZXhUZXN0OiBzdHJpbmcpIHtcbiAgaWYgKCFmaWxlKSB7IHJldHVybiBmYWxzZTsgfVxuICBjb25zdCBuYW1lID0gZmlsZSBpbnN0YW5jZW9mIEZpbGUgPyBmaWxlLm5hbWUgOiBmaWxlO1xuICByZXR1cm4gbmFtZS50b0xvd2VyQ2FzZSgpLm1hdGNoKHJlZ2V4VGVzdCkgIT09IG51bGw7XG59XG4iXX0=