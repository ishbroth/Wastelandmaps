// A stand-in for Google Maps, injected before the app loads, so the app's own logic can be tested in a real browser without a key.
// It draws no map tiles: just the background color, so the look is visible, plus everything the app puts on top.
(() => {
  class LatLng {
    constructor(a, b) { if (typeof a === 'object') { this._lat = a.lat; this._lng = a.lng; } else { this._lat = a; this._lng = b; } }
    lat() { return this._lat; }
    lng() { return this._lng; }
    toJSON() { return { lat: this._lat, lng: this._lng }; }
  }
  const overlays = new Set();
  class MapMock {
    constructor(el, opts) {
      this.el = el; this.opts = opts; this.zoom = opts.zoom; this.center = opts.center; this.listeners = {};
      el.style.background = opts.backgroundColor; el.style.position = 'absolute';
      this.pane = document.createElement('div'); this.pane.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;overflow:hidden';
      el.appendChild(this.pane);
      window.__map = this; window.__styles = opts.styles; window.__events = [];
    }
    addListener(ev, fn) { (this.listeners[ev] ||= []).push(fn); return { remove() {} }; }
    fire(ev) { (this.listeners[ev] || []).forEach((f) => f()); }
    setOptions(o) { Object.assign(this.opts, o); if (o.backgroundColor) this.el.style.background = o.backgroundColor; if (o.styles) window.__styles = o.styles; window.__events.push('setOptions'); }
    redraw() { overlays.forEach((o) => o.map === this && o.draw()); }
    fitBounds(b) { this.center = { lat: (b.north + b.south) / 2, lng: (b.east + b.west) / 2 }; this.zoom = 12; this.fire('zoom_changed'); this.redraw(); window.__events.push('fitBounds'); }
    setCenter(p) { this.center = p; this.redraw(); }
    panTo(p) { this.center = p; this.redraw(); window.__events.push('panTo'); }
    setZoom(z) { this.zoom = z; this.fire('zoom_changed'); this.redraw(); }
    getZoom() { return this.zoom; }
  }
  class OverlayView {
    setMap(m) {
      if (m) { this.map = m; overlays.add(this); this.onAdd(); this.draw(); } else if (this.map) { this.onRemove(); overlays.delete(this); this.map = null; }
    }
    getPanes() { return { overlayMouseTarget: this.map.pane }; }
    getProjection() {
      const m = this.map; const scale = 2 ** (m.zoom - 12) * 9000;
      return { fromLatLngToDivPixel: (ll) => ({ x: (ll.lng() - m.center.lng) * scale + m.el.clientWidth / 2, y: (m.center.lat - ll.lat()) * scale + m.el.clientHeight / 2 }) };
    }
  }
  class Polyline { constructor(o) { this.o = o; this.removed = false; (window.__polylines ||= []).push(this); } setMap(map) { if (!map) this.removed = true; } }
  class Circle { constructor(o) { this.o = o; (window.__circles ||= []).push(o); } setMap() {} }
  const place = (id, name, type, dlat, dlng) => ({ id, displayName: name, primaryType: type, types: [type], location: new LatLng(42.36 + dlat, -71.06 + dlng) });
  const BY_TYPE = {
    hospital: [place('h1', 'Massachusetts General Hospital', 'hospital', 0.004, -0.02), place('h2', 'Boston Medical Center', 'hospital', -0.02, 0.005)],
    police: [place('p1', 'Boston Police HQ', 'police', 0.01, 0.02)],
    school: [place('s1', 'Boston Latin School', 'school', -0.01, -0.03)],
    library: [place('l1', 'Boston Public Library', 'library', 0.0, 0.0)],
    supermarket: [place('m1', 'Star Market', 'supermarket', 0.015, -0.01), place('m2', 'Whole Foods', 'supermarket', -0.005, 0.03)],
    gas_station: [place('g1', 'Shell', 'gas_station', 0.02, 0.01)],
    park: [place('k1', 'Boston Common', 'park', 0.002, 0.004)],
    church: [place('c1', 'Old North Church', 'church', 0.012, 0.012)],
    restaurant: [place('r1', 'Union Oyster House', 'restaurant', 0.006, 0.006), place('r2', 'Legal Sea Foods', 'restaurant', -0.012, -0.012)],
  };
  const libs = {
    maps: {},
    places: {
      SearchNearbyRankPreference: { POPULARITY: 'POPULARITY' },
      Place: { searchNearby: async (req) => { window.__nearbyCalls = (window.__nearbyCalls || 0) + 1; return { places: req.includedPrimaryTypes.flatMap((t) => BY_TYPE[t] || []) }; } },
    },
    geocoding: {
      Geocoder: class {
        async geocode(req) {
          if (req.address && /nowhere/i.test(req.address)) return { results: [] };
          return { results: [{ formatted_address: 'Boston, MA, USA', types: ['locality'], address_components: [{ long_name: 'Boston', types: ['locality'] }], geometry: { location: new LatLng(42.36, -71.06), viewport: { toJSON: () => ({ north: 42.40, south: 42.32, east: -71.0, west: -71.13 }) } } }] };
        }
      },
    },
  };
  window.google = { maps: { Map: MapMock, LatLng, OverlayView, Circle, Polyline, importLibrary: async (n) => libs[n] } };
  // a fake photo archive: only Boston Common has a free photo
  const realFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input.url;
    if (/commons\.wikimedia\.org/.test(url)) {
      const [lat, lng] = new URL(url).searchParams.get('ggscoord').split('|').map(Number);
      window.__commonsCalls = (window.__commonsCalls || 0) + 1;
      if (Math.abs(lat - 42.362) < 0.0005 && Math.abs(lng + 71.056) < 0.0005) {
        const c = document.createElement('canvas'); c.width = 1000; c.height = 600;
        const g = c.getContext('2d'); const grad = g.createLinearGradient(0, 0, 1000, 600); grad.addColorStop(0, '#88a'); grad.addColorStop(0.5, '#ccd'); grad.addColorStop(1, '#443'); g.fillStyle = grad; g.fillRect(0, 0, 1000, 600);
        for (let i = 0; i < 40; i++) { g.fillStyle = 'rgb(' + (i * 6) + ',' + (255 - i * 5) + ',' + (i * 3) + ')'; g.fillRect(i * 25, 100 + (i % 7) * 40, 20, 200); }
        const body = { query: { pages: { 1: { title: 'File:Boston Common.jpg', imageinfo: [{ thumburl: c.toDataURL('image/png'), descriptionurl: 'https://commons.wikimedia.org/wiki/File:Boston_Common.jpg', mime: 'image/png', thumbwidth: 1000, extmetadata: { LicenseShortName: { value: 'CC BY-SA 4.0' }, Artist: { value: '<a href="x">Jane Photo</a>' } } }] } } } };
        return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      return Promise.resolve(new Response(JSON.stringify({ batchcomplete: '' }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    }
    return realFetch(input, init);
  };
  // when the app asks for the Google script, hand it the mock instead of loading anything
  const append = HTMLHeadElement.prototype.appendChild;
  HTMLHeadElement.prototype.appendChild = function (node) {
    if (node.tagName === 'SCRIPT' && /maps\.googleapis\.com/.test(node.src)) { console.log('mock: script intercepted'); setTimeout(() => { console.log('mock: ready fn is ' + typeof window.__wastelandmapsReady); window.__wastelandmapsReady && window.__wastelandmapsReady(); }, 50); return node; }
    return append.call(this, node);
  };
})();
