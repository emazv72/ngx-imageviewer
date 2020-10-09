import * as i0 from "@angular/core";
export interface CacheDef {
    url: string;
    page: number;
    image: any;
}
export declare class ImageCacheService {
    private _cache;
    constructor();
    get cache(): CacheDef[];
    getCache(url: string, page: number): CacheDef;
    getImage(url: string, page: number): any;
    saveImage(url: string, page: number, image: any): void;
    disposeCache(): void;
    static ɵfac: i0.ɵɵFactoryDef<ImageCacheService, never>;
    static ɵprov: i0.ɵɵInjectableDef<ImageCacheService>;
}
