import { ResourceLoader } from './imageviewer.model';
import { ImageCacheService } from './imagecache.service';
export declare class PdfResourceLoader extends ResourceLoader {
    private _imageCache;
    private _pdf;
    private _page;
    private _pendingReload;
    constructor(_imageCache: ImageCacheService);
    setUp(): void;
    loadResource(): void;
    private loadImage;
}
