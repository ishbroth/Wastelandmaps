// Map markers made of ordinary HTML, so they can glow, show labels and react to clicks with CSS. Google's own markers can't be styled
// like that. The class is built on demand because it extends a Google class that only exists once the Maps script has loaded.

export interface HtmlMarkerOptions {
  position: google.maps.LatLngLiteral;
  element: HTMLElement;
  zIndex?: number;
}

export interface HtmlMarkerHandle {
  setMap(map: google.maps.Map | null): void;
  setPosition(position: google.maps.LatLngLiteral): void;
}

let MarkerClass: (new (options: HtmlMarkerOptions) => HtmlMarkerHandle) | null = null;

export function createHtmlMarker(options: HtmlMarkerOptions): HtmlMarkerHandle {
  if (!MarkerClass) {
    class HtmlMarker extends google.maps.OverlayView implements HtmlMarkerHandle {
      private position: google.maps.LatLngLiteral;
      private readonly holder: HTMLDivElement;

      constructor(options: HtmlMarkerOptions) {
        super();
        this.position = options.position;
        this.holder = document.createElement('div');
        this.holder.className = 'rm-marker-holder';
        this.holder.style.position = 'absolute';
        this.holder.style.zIndex = String(options.zIndex ?? 1);
        this.holder.appendChild(options.element);
      }

      onAdd() {
        this.getPanes()?.overlayMouseTarget.appendChild(this.holder);
      }

      draw() {
        const point = this.getProjection()?.fromLatLngToDivPixel(new google.maps.LatLng(this.position));
        if (!point) return;
        this.holder.style.left = `${point.x}px`;
        this.holder.style.top = `${point.y}px`;
      }

      onRemove() {
        this.holder.remove();
      }

      setPosition(position: google.maps.LatLngLiteral) {
        this.position = position;
        this.draw();
      }
    }
    MarkerClass = HtmlMarker;
  }
  return new MarkerClass(options);
}
