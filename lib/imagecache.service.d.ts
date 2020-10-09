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
}
