import { InjectionToken } from '@angular/core';
export declare class ImageViewerConfig {
    width?: number;
    height?: number;
    bgStyle?: string;
    scaleStep?: number;
    rotateStepper?: boolean;
    buttonStyle?: ButtonStyle;
    loadingMessage?: string;
    tooltips?: {
        enabled?: boolean;
        bgStyle?: string;
        bgAlpha?: number;
        textStyle?: string;
        textAlpha?: number;
        padding?: number;
        radius?: number;
    };
    nextPageButton?: ButtonConfig;
    beforePageButton?: ButtonConfig;
    zoomOutButton?: ButtonConfig;
    zoomInButton?: ButtonConfig;
    rotateLeftButton?: ButtonConfig;
    rotateRightButton?: ButtonConfig;
    resetButton?: ButtonConfig;
}
export interface ButtonStyle {
    iconFontFamily?: string;
    alpha?: number;
    hoverAlpha?: number;
    bgStyle?: string;
    iconStyle?: string;
    borderStyle?: string;
    borderWidth?: number;
}
export interface ButtonConfig {
    icon?: string;
    tooltip?: string;
    sortId?: number;
    show?: boolean;
}
export declare function createButtonConfig(icon?: string, tooltip?: string, sortId?: number, show?: boolean): {
    icon: string;
    tooltip: string;
    sortId: number;
    show: boolean;
};
export declare const IMAGEVIEWER_CONFIG: InjectionToken<ImageViewerConfig>;
export declare let IMAGEVIEWER_CONFIG_DEFAULT: ImageViewerConfig;
