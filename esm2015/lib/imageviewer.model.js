import { Subject } from 'rxjs';
export class Button {
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
export class Viewport {
    constructor(width, height, scale, rotation, x, y) {
        this.width = width;
        this.height = height;
        this.scale = scale;
        this.rotation = rotation;
        this.x = x;
        this.y = y;
    }
}
export class ResourceLoader {
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
export function toSquareAngle(angle) {
    return 90 * ((Math.trunc(angle / 90) + (Math.trunc(angle % 90) > 45 ? 1 : 0)) % 4);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW1hZ2V2aWV3ZXIubW9kZWwuanMiLCJzb3VyY2VSb290IjoiL2hvbWUvdHJhdmlzL2J1aWxkL2VtYXp2NzIvbmd4LWltYWdldmlld2VyL3Byb2plY3RzL25neC1pbWFnZXZpZXdlci9zcmMvIiwic291cmNlcyI6WyJsaWIvaW1hZ2V2aWV3ZXIubW9kZWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQ0EsT0FBTyxFQUFjLE9BQU8sRUFBRSxNQUFNLE1BQU0sQ0FBQztBQUUzQyxNQUFNLE9BQU8sTUFBTTtJQWdCakIsWUFBWTtJQUVaLDBCQUEwQjtJQUMxQixZQUNFLE1BQW9CLEVBQ1osS0FBa0I7UUFBbEIsVUFBSyxHQUFMLEtBQUssQ0FBYTtRQXBCNUIsb0JBQW9CO1FBQ3BCLFdBQU0sR0FBRyxDQUFDLENBQUM7UUFLWCxjQUFjO1FBQ2QsVUFBSyxHQUE4QixLQUFLLENBQUM7UUFFekMsbUJBQW1CO1FBQ25CLFlBQU8sR0FBRyxJQUFJLENBQUM7UUFFZixvQkFBb0I7UUFDWixpQkFBWSxHQUFHLElBQUksQ0FBQztRQUNwQixlQUFVLEdBQUcsQ0FBQyxDQUFDO1FBUXJCLElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQztRQUM1QixJQUFJLENBQUMsT0FBTyxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUM7UUFDM0IsSUFBSSxDQUFDLElBQUksR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDO1FBQ3hCLElBQUksQ0FBQyxPQUFPLEdBQUcsTUFBTSxDQUFDLE9BQU8sQ0FBQztJQUNoQyxDQUFDO0lBQ0QsWUFBWTtJQUVaLGdCQUFnQjtJQUNoQixlQUFlO0lBQ2YsT0FBTyxDQUFDLEdBQUcsSUFBSSxLQUFLLENBQUMsc0JBQXNCLENBQUMsQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLENBQUMsQ0FBQztJQUU1RCxvQkFBb0I7SUFDcEIsV0FBVyxDQUFDLEdBQUcsSUFBSSxPQUFPLEtBQUssQ0FBQyxDQUFDLENBQUM7SUFDbEMsWUFBWTtJQUVa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LE9BQU8sRUFBRSxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxFQUFFLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxHQUFHLEVBQUUsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQ3JGLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBCdXR0b25Db25maWcsIEJ1dHRvblN0eWxlLCBJbWFnZVZpZXdlckNvbmZpZyB9IGZyb20gJy4vaW1hZ2V2aWV3ZXIuY29uZmlnJztcbmltcG9ydCB7IE9ic2VydmFibGUsIFN1YmplY3QgfSBmcm9tICdyeGpzJztcblxuZXhwb3J0IGNsYXNzIEJ1dHRvbiB7XG4gIC8vI3JlZ2lvbiBQcm9wZXJ0aWVzXG4gIHNvcnRJZCA9IDA7XG5cbiAgaWNvbjogc3RyaW5nO1xuICB0b29sdGlwOiBzdHJpbmc7XG5cbiAgLy8gaG92ZXIgc3RhdGVcbiAgaG92ZXI6IGJvb2xlYW4gfCAoKCkgPT4gYm9vbGVhbikgPSBmYWxzZTtcblxuICAvLyBzaG93L2hpZGUgYnV0dG9uXG4gIGRpc3BsYXkgPSB0cnVlO1xuXG4gIC8vIGRyYXduIG9uIHBvc2l0aW9uXG4gIHByaXZhdGUgZHJhd1Bvc2l0aW9uID0gbnVsbDtcbiAgcHJpdmF0ZSBkcmF3UmFkaXVzID0gMDtcbiAgLy8jZW5kcmVnaW9uXG5cbiAgLy8jcmVnaW9uIExpZmVjeWNsZSBldmVudHNcbiAgY29uc3RydWN0b3IoXG4gICAgY29uZmlnOiBCdXR0b25Db25maWcsXG4gICAgcHJpdmF0ZSBzdHlsZTogQnV0dG9uU3R5bGVcbiAgKSB7XG4gICAgdGhpcy5zb3J0SWQgPSBjb25maWcuc29ydElkO1xuICAgIHRoaXMuZGlzcGxheSA9IGNvbmZpZy5zaG93O1xuICAgIHRoaXMuaWNvbiA9IGNvbmZpZy5pY29uO1xuICAgIHRoaXMudG9vbHRpcCA9IGNvbmZpZy50b29sdGlwO1xuICB9XG4gIC8vI2VuZHJlZ2lvblxuXG4gIC8vI3JlZ2lvbiBFdmVudHNcbiAgLy8gY2xpY2sgYWN0aW9uXG4gIG9uQ2xpY2soZXZ0KSB7IGFsZXJ0KCdubyBjbGljayBhY3Rpb24gc2V0IScpOyByZXR1cm4gdHJ1ZTsgfVxuXG4gIC8vIG1vdXNlIGRvd24gYWN0aW9uXG4gIG9uTW91c2VEb3duKGV2dCkgeyByZXR1cm4gZmFsc2U7IH1cbiAgLy8jZW5kcmVnaW9uXG5cbiAgLy8jcmVnaW9uIERyYXcgQnV0dG9uXG4gIGRyYXcoY3R4LCB4LCB5LCByYWRpdXMpIHtcbiAgICB0aGlzLmRyYXdQb3NpdGlvbiA9IHsgeDogeCwgeTogeSB9O1xuICAgIHRoaXMuZHJhd1JhZGl1cyA9IHJhZGl1cztcblxuICAgIC8vIHByZXNlcnZlIGNvbnRleHRcbiAgICBjdHguc2F2ZSgpO1xuXG4gICAgLy8gZHJhd2luZyBzZXR0aW5nc1xuICAgIGNvbnN0IGlzSG92ZXIgPSAodHlwZW9mIHRoaXMuaG92ZXIgPT09ICdmdW5jdGlvbicpID8gdGhpcy5ob3ZlcigpIDogdGhpcy5ob3ZlcjtcbiAgICBjdHguZ2xvYmFsQWxwaGEgPSAoaXNIb3ZlcikgPyB0aGlzLnN0eWxlLmhvdmVyQWxwaGEgOiB0aGlzLnN0eWxlLmFscGhhO1xuICAgIGN0eC5maWxsU3R5bGUgPSB0aGlzLnN0eWxlLmJnU3R5bGU7XG4gICAgY3R4LmxpbmVXaWR0aCA9IDA7XG5cbiAgICAvLyBkcmF3IGNpcmNsZVxuICAgIGN0eC5iZWdpblBhdGgoKTtcbiAgICBjdHguYXJjKHgsIHksIHJhZGl1cywgMCwgMiAqIE1hdGguUEkpO1xuICAgIGN0eC5jbG9zZVBhdGgoKTtcbiAgICBjdHguZmlsbCgpO1xuICAgIGlmICh0aGlzLnN0eWxlLmJvcmRlcldpZHRoID4gMCkge1xuICAgICAgY3R4LmxpbmVXaWR0aCA9IHRoaXMuc3R5bGUuYm9yZGVyV2lkdGg7XG4gICAgICBjdHguc3Ryb2tlU3R5bGUgPSB0aGlzLnN0eWxlLmJvcmRlclN0eWxlO1xuICAgICAgY3R4LnN0cm9rZSgpO1xuICAgIH1cblxuICAgIC8vIGRyYXcgaWNvblxuICAgIGlmICh0aGlzLmljb24gIT09IG51bGwpIHtcbiAgICAgIGN0eC5zYXZlKCk7XG4gICAgICAvLyBjdHguZ2xvYmFsQ29tcG9zaXRlT3BlcmF0aW9uID0gJ2Rlc3RpbmF0aW9uLW91dCc7XG4gICAgICB0aGlzLmRyYXdJY29uRm9udChjdHgsIHgsIHksIHJhZGl1cyk7XG4gICAgICBjdHgucmVzdG9yZSgpO1xuICAgIH1cblxuICAgIC8vIHJlc3RvcmUgY29udGV4dFxuICAgIGN0eC5yZXN0b3JlKCk7XG4gIH1cblxuICBwcml2YXRlIGRyYXdJY29uRm9udChjdHgsIGNlbnRyZVgsIGNlbnRyZVksIHNpemUpIHtcbiAgICAvLyBmb250IHNldHRpbmdzXG4gICAgY3R4LmZvbnQgPSBzaXplICsgJ3B4ICcgKyB0aGlzLnN0eWxlLmljb25Gb250RmFtaWx5O1xuICAgIGN0eC5maWxsU3R5bGUgPSB0aGlzLnN0eWxlLmljb25TdHlsZTtcblxuICAgIC8vIGNhbGN1bGF0ZSBwb3NpdGlvblxuICAgIGNvbnN0IHRleHRTaXplID0gY3R4Lm1lYXN1cmVUZXh0KHRoaXMuaWNvbik7XG4gICAgY29uc3QgeCA9IGNlbnRyZVggLSB0ZXh0U2l6ZS53aWR0aCAvIDI7XG4gICAgY29uc3QgeSA9IGNlbnRyZVkgKyBzaXplIC8gMjtcblxuICAgIC8vIGRyYXcgaXRcbiAgICBjdHguZmlsbFRleHQodGhpcy5pY29uLCB4LCB5KTtcbiAgfVxuICAvLyNlbmRyZWdpb25cblxuICAvLyNyZWdpb24gVXRpbHNcbiAgaXNXaXRoaW5Cb3VuZHMoeCwgeSkge1xuICAgIGlmICh0aGlzLmRyYXdQb3NpdGlvbiA9PT0gbnVsbCkgeyByZXR1cm4gZmFsc2U7IH1cbiAgICBjb25zdCBkeCA9IE1hdGguYWJzKHRoaXMuZHJhd1Bvc2l0aW9uLnggLSB4KSwgZHkgPSBNYXRoLmFicyh0aGlzLmRyYXdQb3NpdGlvbi55IC0geSk7XG4gICAgcmV0dXJuIGR4ICogZHggKyBkeSAqIGR5IDw9IHRoaXMuZHJhd1JhZGl1cyAqIHRoaXMuZHJhd1JhZGl1cztcbiAgfVxuICAvLyNlbmRyZWdpb25cbn1cblxuZXhwb3J0IGNsYXNzIFZpZXdwb3J0IHtcbiAgY29uc3RydWN0b3IoXG4gICAgcHVibGljIHdpZHRoOiBudW1iZXIsXG4gICAgcHVibGljIGhlaWdodDogbnVtYmVyLFxuICAgIHB1YmxpYyBzY2FsZTogbnVtYmVyLFxuICAgIHB1YmxpYyByb3RhdGlvbjogbnVtYmVyLFxuICAgIHB1YmxpYyB4OiBudW1iZXIsXG4gICAgcHVibGljIHk6IG51bWJlclxuICApIHt9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgRGltZW5zaW9uIHsgd2lkdGg6IG51bWJlcjsgaGVpZ2h0OiBudW1iZXI7IH1cblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIFJlc291cmNlTG9hZGVyIHtcbiAgcHVibGljIHNyYzogc3RyaW5nO1xuICBwdWJsaWMgc291cmNlRGltOiB7IHdpZHRoOiBudW1iZXIsIGhlaWdodDogbnVtYmVyIH07XG4gIHB1YmxpYyB2aWV3cG9ydDogVmlld3BvcnQgPSB7IHdpZHRoOiAwLCBoZWlnaHQ6IDAsIHNjYWxlOiAxLCByb3RhdGlvbjogMCwgeDogMCwgeTogMCB9O1xuICBwdWJsaWMgbWluU2NhbGUgPSAwO1xuICBwdWJsaWMgbWF4U2NhbGUgPSA0O1xuICBwdWJsaWMgY3VycmVudEl0ZW0gPSAxO1xuICBwdWJsaWMgdG90YWxJdGVtID0gMTtcbiAgcHVibGljIHNob3dJdGVtc1F1YW50aXR5ID0gZmFsc2U7XG4gIHB1YmxpYyBsb2FkZWQgPSBmYWxzZTtcbiAgcHVibGljIGxvYWRpbmcgPSBmYWxzZTtcbiAgcHVibGljIHJlbmRlcmluZyA9IGZhbHNlO1xuXG4gIHByb3RlY3RlZCBfaW1hZ2U7XG4gIHByb3RlY3RlZCByZXNvdXJjZUNoYW5nZSA9IG5ldyBTdWJqZWN0PHN0cmluZz4oKTtcblxuICBhYnN0cmFjdCBzZXRVcCgpO1xuICBhYnN0cmFjdCBsb2FkUmVzb3VyY2UoKTtcblxuICBwdWJsaWMgcmVzZXRWaWV3cG9ydChjYW52YXNEaW06IERpbWVuc2lvbik6IGJvb2xlYW4ge1xuICAgIGlmICghdGhpcy5sb2FkZWQgfHwgIWNhbnZhc0RpbSkgeyByZXR1cm47IH1cblxuICAgIGNvbnN0IHJvdGF0aW9uID0gdGhpcy52aWV3cG9ydCA/IHRoaXMudmlld3BvcnQucm90YXRpb24gOiAwO1xuICAgIGNvbnN0IGludmVydGVkID0gdG9TcXVhcmVBbmdsZShyb3RhdGlvbikgLyA5MCAlIDIgIT09IDA7XG4gICAgY29uc3QgY2FudmFzID0ge1xuICAgICAgd2lkdGg6ICFpbnZlcnRlZCA/IGNhbnZhc0RpbS53aWR0aCA6IGNhbnZhc0RpbS5oZWlnaHQsXG4gICAgICBoZWlnaHQ6ICFpbnZlcnRlZCA/IGNhbnZhc0RpbS5oZWlnaHQgOiBjYW52YXNEaW0ud2lkdGhcbiAgICB9O1xuXG4gICAgaWYgKCgoY2FudmFzLmhlaWdodCAvIHRoaXMuX2ltYWdlLmhlaWdodCkgKiB0aGlzLl9pbWFnZS53aWR0aCkgPD0gY2FudmFzLndpZHRoKSB7XG4gICAgICB0aGlzLnZpZXdwb3J0LnNjYWxlID0gY2FudmFzLmhlaWdodCAvIHRoaXMuX2ltYWdlLmhlaWdodDtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy52aWV3cG9ydC5zY2FsZSA9IGNhbnZhcy53aWR0aCAvIHRoaXMuX2ltYWdlLndpZHRoO1xuICAgIH1cbiAgICB0aGlzLm1pblNjYWxlID0gdGhpcy52aWV3cG9ydC5zY2FsZSAvIDQ7XG4gICAgdGhpcy5tYXhTY2FsZSA9IHRoaXMudmlld3BvcnQuc2NhbGUgKiA0O1xuXG4gICAgLy8gc3RhcnQgcG9pbnQgdG8gZHJhdyBpbWFnZVxuICAgIHRoaXMudmlld3BvcnQud2lkdGggPSB0aGlzLl9pbWFnZS53aWR0aCAqIHRoaXMudmlld3BvcnQuc2NhbGU7XG4gICAgdGhpcy52aWV3cG9ydC5oZWlnaHQgPSB0aGlzLl9pbWFnZS5oZWlnaHQgKiB0aGlzLnZpZXdwb3J0LnNjYWxlO1xuICAgIHRoaXMudmlld3BvcnQueCA9IChjYW52YXNEaW0ud2lkdGggLSB0aGlzLnZpZXdwb3J0LndpZHRoKSAvIDI7XG4gICAgdGhpcy52aWV3cG9ydC55ID0gKGNhbnZhc0RpbS5oZWlnaHQgLSB0aGlzLnZpZXdwb3J0LmhlaWdodCkgLyAyO1xuICB9XG5cbiAgcHVibGljIGRyYXcoY3R4LCBjb25maWc6IEltYWdlVmlld2VyQ29uZmlnLCBjYW52YXNEaW06IERpbWVuc2lvbiwgb25GaW5pc2gpIHtcbiAgICAvLyBjbGVhciBjYW52YXNcbiAgICBjdHguY2xlYXJSZWN0KDAsIDAsIGNhbnZhc0RpbS53aWR0aCwgY2FudmFzRGltLmhlaWdodCk7XG5cbiAgICAvLyBEcmF3IGJhY2tncm91bmQgY29sb3I7XG4gICAgY3R4LmZpbGxTdHlsZSA9IGNvbmZpZy5iZ1N0eWxlO1xuICAgIGN0eC5maWxsUmVjdCgwLCAwLCBjYW52YXNEaW0ud2lkdGgsIGNhbnZhc0RpbS5oZWlnaHQpO1xuXG4gICAgLy8gZHJhdyBpbWFnZSAodHJhbnNmb3JtZWQsIHJvdGF0ZSBhbmQgc2NhbGVkKVxuICAgIGlmICghdGhpcy5sb2FkaW5nICYmIHRoaXMubG9hZGVkKSB7XG4gICAgICBjdHgudHJhbnNsYXRlKHRoaXMudmlld3BvcnQueCArIHRoaXMudmlld3BvcnQud2lkdGggLyAyLCB0aGlzLnZpZXdwb3J0LnkgKyB0aGlzLnZpZXdwb3J0LmhlaWdodCAvIDIpO1xuICAgICAgY3R4LnJvdGF0ZSh0aGlzLnZpZXdwb3J0LnJvdGF0aW9uICogTWF0aC5QSSAvIDE4MCk7XG4gICAgICBjdHguc2NhbGUodGhpcy52aWV3cG9ydC5zY2FsZSwgdGhpcy52aWV3cG9ydC5zY2FsZSk7XG4gICAgICBjdHguZHJhd0ltYWdlKHRoaXMuX2ltYWdlLCAtdGhpcy5faW1hZ2Uud2lkdGggLyAyLCAtdGhpcy5faW1hZ2UuaGVpZ2h0IC8gMik7XG4gICAgfSBlbHNlIHtcbiAgICAgIGN0eC5maWxsU3R5bGUgPSAnIzMzMyc7XG4gICAgICBjdHguZm9udCA9ICcyNXB4IFZlcmRhbmEnO1xuICAgICAgY3R4LnRleHRBbGlnbiA9ICdjZW50ZXInO1xuICAgICAgY3R4LmZpbGxUZXh0KGNvbmZpZy5sb2FkaW5nTWVzc2FnZSB8fCAnTG9hZGluZy4uLicsIGNhbnZhc0RpbS53aWR0aCAvIDIsIGNhbnZhc0RpbS5oZWlnaHQgLyAyKTtcbiAgICB9XG5cbiAgICBvbkZpbmlzaChjdHgsIGNvbmZpZywgY2FudmFzRGltKTtcbiAgfVxuXG4gIHB1YmxpYyBvblJlc291cmNlQ2hhbmdlKCkgeyByZXR1cm4gdGhpcy5yZXNvdXJjZUNoYW5nZS5hc09ic2VydmFibGUoKTsgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gdG9TcXVhcmVBbmdsZShhbmdsZTogbnVtYmVyKSB7XG4gIHJldHVybiA5MCAqICgoTWF0aC50cnVuYyhhbmdsZSAvIDkwKSArIChNYXRoLnRydW5jKGFuZ2xlICUgOTApID4gNDUgPyAxIDogMCkpICUgNCk7XG59XG4iXX0=