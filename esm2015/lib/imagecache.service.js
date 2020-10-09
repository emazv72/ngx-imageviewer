import { Injectable } from '@angular/core';
import * as i0 from "@angular/core";
export class ImageCacheService {
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
ImageCacheService.ɵprov = i0.ɵɵdefineInjectable({ token: ImageCacheService, factory: ImageCacheService.ɵfac, providedIn: 'root' });
/*@__PURE__*/ (function () { i0.ɵsetClassMetadata(ImageCacheService, [{
        type: Injectable,
        args: [{ providedIn: 'root' }]
    }], function () { return []; }, null); })();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW1hZ2VjYWNoZS5zZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6Ii9ob21lL3RyYXZpcy9idWlsZC9lbWF6djcyL25neC1pbWFnZXZpZXdlci9wcm9qZWN0cy9uZ3gtaW1hZ2V2aWV3ZXIvc3JjLyIsInNvdXJjZXMiOlsibGliL2ltYWdlY2FjaGUuc2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sZUFBZSxDQUFDOztBQVMzQyxNQUFNLE9BQU8saUJBQWlCO0lBSTVCO1FBRlEsV0FBTSxHQUFlLEVBQUUsQ0FBQztJQUVqQixDQUFDO0lBRWhCLElBQUksS0FBSztRQUNQLE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQztJQUNyQixDQUFDO0lBRUQsUUFBUSxDQUFDLEdBQVcsRUFBRSxJQUFZO1FBQ2hDLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxLQUFLLEdBQUcsSUFBSSxDQUFDLENBQUMsSUFBSSxLQUFLLElBQUksQ0FBQyxDQUFDO0lBQ2hFLENBQUM7SUFFRCxRQUFRLENBQUMsR0FBVyxFQUFFLElBQVk7UUFDaEMsTUFBTSxDQUFDLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDbkMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztJQUM1QixDQUFDO0lBRUQsU0FBUyxDQUFDLEdBQVcsRUFBRSxJQUFZLEVBQUUsS0FBVTtRQUM3QyxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsQ0FBQztRQUN2QyxJQUFJLEtBQUssRUFBRTtZQUNULEtBQUssQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDO1NBQ3JCO2FBQU07WUFDTCxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxFQUFFLEdBQUcsRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQztTQUN2QztJQUNILENBQUM7SUFFRCxZQUFZO1FBQ1YsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUMxRCxJQUFJLENBQUMsTUFBTSxHQUFHLEVBQUUsQ0FBQztJQUNuQixDQUFDOztrRkEvQlUsaUJBQWlCO3lEQUFqQixpQkFBaUIsV0FBakIsaUJBQWlCLG1CQURKLE1BQU07a0RBQ25CLGlCQUFpQjtjQUQ3QixVQUFVO2VBQUMsRUFBRSxVQUFVLEVBQUUsTUFBTSxFQUFFIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgSW5qZWN0YWJsZSB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xuXG5leHBvcnQgaW50ZXJmYWNlIENhY2hlRGVmIHtcbiAgdXJsOiBzdHJpbmc7XG4gIHBhZ2U6IG51bWJlcjtcbiAgaW1hZ2U6IGFueTtcbn1cblxuQEluamVjdGFibGUoeyBwcm92aWRlZEluOiAncm9vdCcgfSlcbmV4cG9ydCBjbGFzcyBJbWFnZUNhY2hlU2VydmljZSB7XG5cbiAgcHJpdmF0ZSBfY2FjaGU6IENhY2hlRGVmW10gPSBbXTtcblxuICBjb25zdHJ1Y3RvcigpIHt9XG5cbiAgZ2V0IGNhY2hlKCk6IENhY2hlRGVmW10ge1xuICAgIHJldHVybiB0aGlzLl9jYWNoZTtcbiAgfVxuXG4gIGdldENhY2hlKHVybDogc3RyaW5nLCBwYWdlOiBudW1iZXIpIHtcbiAgICByZXR1cm4gdGhpcy5jYWNoZS5maW5kKGkgPT4gaS51cmwgPT09IHVybCAmJiBpLnBhZ2UgPT09IHBhZ2UpO1xuICB9XG5cbiAgZ2V0SW1hZ2UodXJsOiBzdHJpbmcsIHBhZ2U6IG51bWJlcikge1xuICAgIGNvbnN0IGMgPSB0aGlzLmdldENhY2hlKHVybCwgcGFnZSk7XG4gICAgcmV0dXJuIGMgPyBjLmltYWdlIDogbnVsbDtcbiAgfVxuXG4gIHNhdmVJbWFnZSh1cmw6IHN0cmluZywgcGFnZTogbnVtYmVyLCBpbWFnZTogYW55KSB7XG4gICAgY29uc3QgY2FjaGUgPSB0aGlzLmdldENhY2hlKHVybCwgcGFnZSk7XG4gICAgaWYgKGNhY2hlKSB7XG4gICAgICBjYWNoZS5pbWFnZSA9IGltYWdlO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmNhY2hlLnB1c2goeyB1cmwsIHBhZ2UsIGltYWdlIH0pO1xuICAgIH1cbiAgfVxuXG4gIGRpc3Bvc2VDYWNoZSgpIHtcbiAgICB0aGlzLmNhY2hlLmZvckVhY2goaSA9PiBVUkwucmV2b2tlT2JqZWN0VVJMKGkuaW1hZ2Uuc3JjKSk7XG4gICAgdGhpcy5fY2FjaGUgPSBbXTtcbiAgfVxufVxuIl19