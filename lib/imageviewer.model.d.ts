import { ButtonConfig, ButtonStyle, ImageViewerConfig } from './imageviewer.config';
import { Observable, Subject } from 'rxjs';
export declare class Button {
    private style;
    sortId: number;
    icon: string;
    tooltip: string;
    hover: boolean | (() => boolean);
    display: boolean;
    private drawPosition;
    private drawRadius;
    constructor(config: ButtonConfig, style: ButtonStyle);
    onClick(evt: any): boolean;
    onMouseDown(evt: any): boolean;
    draw(ctx: any, x: any, y: any, radius: any): void;
    private drawIconFont;
    isWithinBounds(x: any, y: any): boolean;
}
export declare class Viewport {
    width: number;
    height: number;
    scale: number;
    rotation: number;
    x: number;
    y: number;
    constructor(width: number, height: number, scale: number, rotation: number, x: number, y: number);
}
export interface Dimension {
    width: number;
    height: number;
}
export declare abstract class ResourceLoader {
    src: string;
    sourceDim: {
        width: number;
        height: number;
    };
    viewport: Viewport;
    minScale: number;
    maxScale: number;
    currentItem: number;
    totalItem: number;
    showItemsQuantity: boolean;
    loaded: boolean;
    loading: boolean;
    rendering: boolean;
    protected _image: any;
    protected resourceChange: Subject<string>;
    abstract setUp(): any;
    abstract loadResource(): any;
    resetViewport(canvasDim: Dimension): boolean;
    draw(ctx: any, config: ImageViewerConfig, canvasDim: Dimension, onFinish: any): void;
    onResourceChange(): Observable<string>;
}
export declare function toSquareAngle(angle: number): number;
