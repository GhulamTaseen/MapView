import 'maplibre-gl/dist/maplibre-gl.css';
import maplibregl from 'maplibre-gl';
import { googleProtocol } from 'maplibre-google-maps';
import React, {
  useRef, useLayoutEffect, useEffect, useState,
  useMemo,
} from 'react';
import { useTheme } from '@mui/material';
import { SwitcherControl } from '../switcher/switcher';
import { useAttributePreference, usePreference } from '../../common/util/preferences';
import usePersistedState, { savePersistedState } from '../../common/util/usePersistedState';
import { mapImages } from './preloadImages';
import useMapStyles from './useMapStyles';
import { useEffectAsync } from '../../reactHelper';
import * as turf from '@turf/turf'; 

const element = document.createElement('div');
element.style.width = '100%';
element.style.height = '100%';
element.style.boxSizing = 'initial';
maplibregl.addProtocol('google', googleProtocol);

export const map = new maplibregl.Map({
  container: element,
  attributionControl: false,
});

let ready = false;
const readyListeners = new Set();

const addReadyListener = (listener) => {
  readyListeners.add(listener);
  listener(ready);
};

const removeReadyListener = (listener) => {
  readyListeners.delete(listener);
};

const updateReadyValue = (value) => {
  ready = value;
  readyListeners.forEach((listener) => listener(value));
};

const initMap = async () => {
  if (ready) return;
  if (!map.hasImage('background')) {
    Object.entries(mapImages).forEach(([key, value]) => {
      map.addImage(key, value, {
        pixelRatio: window.devicePixelRatio,
      });
    });
  }
};

const MapView = ({ children }) => {
  const theme = useTheme();
  const containerEl = useRef(null);
  const [mapReady, setMapReady] = useState(false);

  const mapStyles = useMapStyles();
  const activeMapStyles = useAttributePreference('activeMapStyles', 'locationIqStreets,locationIqDark,openFreeMap');
  const [defaultMapStyle] = usePersistedState('selectedMapStyle', usePreference('map', 'locationIqStreets'));
  const mapboxAccessToken = useAttributePreference('mapboxAccessToken');
  const maxZoom = useAttributePreference('web.maxZoom');

  const switcher = useMemo(() => new SwitcherControl(
    () => updateReadyValue(false),
    (styleId) => savePersistedState('selectedMapStyle', styleId),
    () => {
      map.once('styledata', () => {
        const waiting = () => {
          if (!map.loaded()) {
            setTimeout(waiting, 33);
          } else {
            initMap();
            updateReadyValue(true);
          }
        };
        waiting();
      });
    },
  ), []);

  useEffectAsync(async () => {
    if (theme.direction === 'rtl') {
      maplibregl.setRTLTextPlugin('/mapbox-gl-rtl-text.js');
    }
  }, [theme.direction]);

  class CustomToggleControl {
    constructor() {
      this.isDark = false;
    }
    onAdd(map) {
      this.map = map;
      this.container = document.createElement('div');
      this.container.className = 'maplibregl-ctrl maplibregl-ctrl-group';
      this.button = document.createElement('button');
      this.button.innerHTML = '🌞';
      this.button.title = 'Toggle basemap';
      this.button.onclick = () => {
        if (this.isDark) {
          map.setStyle('https://tiles.openfreemap.org/styles/liberty'); 
          this.button.innerHTML = '🌞';
          this.isDark = false;
        } else {
          map.setStyle('https://tiles.openfreemap.org/styles/dark'); 
          this.button.innerHTML = '🌙';
          this.isDark = true;
        }
      };
      this.container.appendChild(this.button);
      return this.container;
    }
    onRemove() {
      this.container.parentNode.removeChild(this.container);
      this.map = undefined;
    }
  }
  class CustomMeasureControl {
    constructor() {
      this.active = false;
      this.drawing = false;
      this.points = [];
      this.totalLabel = null;
      this.overlay = null;
      this.lengthLabels = [];
      this.tempLengthLabel = null;
      this.areaLabel = null;
      this.onClick = this.onClick.bind(this);
      this.onMove = this.onMove.bind(this);
      this.onDblClick = this.onDblClick.bind(this);
      this.onViewChange = this.onViewChange.bind(this);
      this.onStyleData = this.onStyleData.bind(this);
    }

    onAdd(map) {
      this.map = map;
      this.container = document.createElement('div');
      this.container.className = 'maplibregl-ctrl maplibregl-ctrl-group';
      this.button = document.createElement('button');
      this.button.innerHTML = '📐';
      this.button.title = 'Measure (distance/area)';
      this.button.onclick = () => this.toggle();
      this.container.appendChild(this.button);
      return this.container;
    }
    onRemove() {
      this.disable();
      this.container.remove();
      this.map = undefined;
    }
    toggle() {
      this.active = !this.active;
      this.button.classList.toggle('measure-active', this.active);
      if (this.active) this.enable(); else this.disable();
    }
    enable() {
      if (!this.overlay) {
        this.overlay = document.createElement('div');
        Object.assign(this.overlay.style, {
          position: 'absolute',
          left: 0, top: 0, width: '100%', height: '100%',
          pointerEvents: 'none',
          zIndex: 1,
        });
        this.map.getContainer().appendChild(this.overlay);
      }
      this.points = [];
      this.drawing = false;
      this.map.on('click', this.onClick);
      this.map.on('mousemove', this.onMove);
      this.map.on('dblclick', this.onDblClick);
      this.map.on('move', this.onViewChange);
      this.map.on('zoom', this.onViewChange);
      this.map.on('styledata', this.onStyleData); 
      this.ensureLayers();   
      this.map.getCanvas().style.cursor = 'crosshair';
      this.map.doubleClickZoom.disable();
    }
    disable() {
      this.map.off('click', this.onClick);
      this.map.off('mousemove', this.onMove);
      this.map.off('dblclick', this.onDblClick);
      this.map.off('move', this.onViewChange);
      this.map.off('zoom', this.onViewChange);
      this.map.off('styledata', this.onStyleData);

      if (this.totalLabel) {
  this.totalLabel.remove();
  this.totalLabel = null;
}
      this.removeLayers();
      this.clearLengthLabels();
      if (this.tempLengthLabel) { this.tempLengthLabel.remove(); this.tempLengthLabel = null; }
      if (this.areaLabel) { this.areaLabel.remove(); this.areaLabel = null; }
      if (this.overlay) { this.overlay.remove(); this.overlay = null; }

      this.points = [];
      this.drawing = false;
      this.map.getCanvas().style.cursor = '';
      this.map.doubleClickZoom.enable();
    }
    onStyleData() {
      if (!this.active) return;
      this.ensureLayers();
      this.updateGeoJSON(); 
      this.updateLabelPositions();
    }
    ensureLayers() {
      if (!this.map.getSource('measure-src')) {
        this.map.addSource('measure-src', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] }
        });
      }
      if (!this.map.getLayer('measure-line')) {
        this.map.addLayer({
          id: 'measure-line',
          type: 'line',
          source: 'measure-src',
          filter: ['==', '$type', 'LineString'],
          paint: { 'line-color': '#007cbf', 'line-width': 3 }
        });
      }
      if (!this.map.getLayer('measure-polygon')) {
        this.map.addLayer({
          id: 'measure-polygon',
          type: 'fill',
          source: 'measure-src',
          filter: ['==', '$type', 'Polygon'],
          paint: { 'fill-color': '#007cbf', 'fill-opacity': 0.2 }
        });
      }
    }
    removeLayers() {
      ['measure-line', 'measure-polygon'].forEach(id => {
        if (this.map.getLayer(id)) this.map.removeLayer(id);
      });
      if (this.map.getSource('measure-src')) this.map.removeSource('measure-src');
    }
    makeLabel(text) {
      const el = document.createElement('div');
      el.textContent = text;
      Object.assign(el.style, {
        position: 'absolute',
        padding: '2px 6px',
        borderRadius: '8px',
        background: 'rgba(255,255,255,0.9)',
        border: '1px solid rgba(0,0,0,0.2)',
        fontSize: '12px',
        fontWeight: '600',
        whiteSpace: 'nowrap',
        transformOrigin: 'center',
        pointerEvents: 'none',
      });
      this.overlay.appendChild(el);
      return el;
    }
    clearLengthLabels() {
      this.lengthLabels.forEach(l => l.el.remove());
      this.lengthLabels = [];
    }
    fmtMeters(m) {
      if (m < 1000) return `${m.toFixed(2)} m`;
      return `${(m / 1000).toFixed(2)} km`;
    }
    onClick(e) {
      if (!this.drawing) {
        this.points = [[e.lngLat.lng, e.lngLat.lat]];
        this.clearLengthLabels();
        if (this.areaLabel) { this.areaLabel.remove(); this.areaLabel = null; }
        this.drawing = true;
      } else {
        const last = this.points[this.points.length - 1];
        const next = [e.lngLat.lng, e.lngLat.lat];
        this.points.push(next);
        const line = turf.lineString(this.points);
        const totalKm = turf.length(line, { units: 'kilometers' });
        const totalM = totalKm * 1000;

        if (!this.totalLabel) this.totalLabel = this.makeLabel('');
        this.totalLabel.textContent = `Total: ${this.fmtMeters(totalM)}`;
        const lenKm = turf.length(turf.lineString([last, next]), { units: 'kilometers' });
        const lenM = lenKm * 1000;
        const el = this.makeLabel(this.fmtMeters(lenM));
        this.lengthLabels.push({ el, c1: last, c2: next });
      }
      this.updateGeoJSON();
      this.updateLabelPositions(e.lngLat);
    }
    onMove(e) {
      if (!this.drawing || this.points.length === 0) return;
      if (this.points.length === 1) {
        const c1 = this.points[0];
        const c2 = [e.lngLat.lng, e.lngLat.lat];

        if (!this.tempLengthLabel) this.tempLengthLabel = this.makeLabel('');
        const lenKm = turf.length(turf.lineString([c1, c2]), { units: 'kilometers' });
        const lenM = lenKm * 1000;
        this.tempLengthLabel.textContent = this.fmtMeters(lenM);
      } else if (this.tempLengthLabel) {
        this.tempLengthLabel.remove();
        this.tempLengthLabel = null;
      }

      this.updateGeoJSON([...this.points, [e.lngLat.lng, e.lngLat.lat]], true);
      this.updateLabelPositions(e.lngLat);
    }
    onDblClick(e) {
      if (!this.drawing || this.points.length < 3) return;
      e.preventDefault();
      const last = this.points[this.points.length - 1];
      const back = this.points[0];
      const lenKm = turf.length(turf.lineString([last, back]), { units: 'kilometers' });
      const lenM = lenKm * 1000;
      const el = this.makeLabel(this.fmtMeters(lenM));
      this.lengthLabels.push({ el, c1: last, c2: back });

      this.points.push(back);
      this.drawing = false;
      const poly = turf.polygon([this.points]);
      const areaM2 = turf.area(poly);
      const ha = areaM2 / 10000;
      const centroid = turf.centroid(poly).geometry.coordinates;

      if (this.areaLabel) this.areaLabel.remove();
      this.areaLabel = this.makeLabel(`${areaM2.toFixed(2)} m² (${ha.toFixed(4)} ha)`);
      this.areaLabel._center = centroid;
      if (this.tempLengthLabel) { this.tempLengthLabel.remove(); this.tempLengthLabel = null; }
      this.updateGeoJSON();
      this.updateLabelPositions();
    }
    onViewChange() {
      if (!this.active) return;
      this.updateLabelPositions();
    }
    updateGeoJSON(tempCoords, isTemp = false) {
      const coords = tempCoords || this.points;
      const feats = [];
      if (coords.length > 1) {
        feats.push({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: coords },
          properties: {}
        });
      }
      if (coords.length > 2 && !isTemp) {
        feats.push({
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [coords] },
          properties: {}
        });
      }
      const src = this.map.getSource('measure-src');
      if (src) src.setData({ type: 'FeatureCollection', features: feats });
    }

    updateLabelPositions(mouseLngLat) {
    if (this.totalLabel && this.points.length > 1) {
      const line = turf.lineString(this.points);
      const mid = turf.along(line, turf.length(line, { units: 'kilometers' }) / 2, { units: 'kilometers' }).geometry.coordinates;
      const p = this.map.project(mid);

      this.totalLabel.style.left = `${p.x}px`;
      this.totalLabel.style.top = `${p.y}px`;
      this.totalLabel.style.transform = `translate(-50%, -50%)`;

    if (this.totalLabel) {
      this.totalLabel.style.left = `50%`;  
      this.totalLabel.style.top = `10px`;  
      this.totalLabel.style.transform = `translateX(-50%)`;
    }}
      this.lengthLabels.forEach(({ el, c1, c2 }) => {
        const mid = [(c1[0] + c2[0]) / 2, (c1[1] + c2[1]) / 2];
        const p1 = this.map.project(c1);
        const p2 = this.map.project(c2);
        const pm = this.map.project(mid);
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
       let angleDeg = Math.atan2(dy, dx) * 180 / Math.PI;
       if (angleDeg > 90 || angleDeg < -90) {
  angleDeg += 180;
}
        el.style.left = `${pm.x}px`;
        el.style.top = `${pm.y}px`;
        el.style.transform = `translate(-50%, -50%) rotate(${angleDeg}deg)`;
      });
      if (this.tempLengthLabel && this.points.length === 1 && mouseLngLat) {
        const c1 = this.points[0];
        const c2 = [mouseLngLat.lng, mouseLngLat.lat];
        const mid = [(c1[0] + c2[0]) / 2, (c1[1] + c2[1]) / 2];
        const p1 = this.map.project(c1);
        const p2 = this.map.project(c2);
        const pm = this.map.project(mid);
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
              let angleDeg = Math.atan2(dy, dx) * 180 / Math.PI;
       if (angleDeg > 90 || angleDeg < -90) {
  angleDeg += 180;
}
        this.tempLengthLabel.style.left = `${pm.x}px`;
        this.tempLengthLabel.style.top = `${pm.y}px`;
        this.tempLengthLabel.style.transform = `translate(-50%, -50%) rotate(${angleDeg}deg)`;
      }

      if (this.areaLabel && this.areaLabel._center) {
        const p = this.map.project(this.areaLabel._center);
        this.areaLabel.style.left = `${p.x}px`;
        this.areaLabel.style.top = `${p.y}px`;
        this.areaLabel.style.transform = `translate(-50%, -50%)`;
      }
    }
  }

  useEffect(() => {
    const attribution = new maplibregl.AttributionControl({ compact: true });
    const navigation = new maplibregl.NavigationControl();
    const toggleControl = new CustomToggleControl();
    const measureControl = new CustomMeasureControl(); 

    map.addControl(attribution, theme.direction === 'rtl' ? 'bottom-left' : 'bottom-right');
    map.addControl(navigation, theme.direction === 'rtl' ? 'top-left' : 'top-right');
    map.addControl(switcher, theme.direction === 'rtl' ? 'top-left' : 'top-right');
    map.addControl(toggleControl, theme.direction === 'rtl' ? 'top-left' : 'top-right');
    map.addControl(measureControl, theme.direction === 'rtl' ? 'top-left' : 'top-right'); 

    return () => {
      map.removeControl(switcher);
      map.removeControl(navigation);
      map.removeControl(attribution);
      map.removeControl(toggleControl);
      map.removeControl(measureControl); 
    };
  }, [theme.direction, switcher]);

  useEffect(() => {
    if (maxZoom) {
      map.setMaxZoom(maxZoom);
    }
  }, [maxZoom]);

  useEffect(() => {
    maplibregl.accessToken = mapboxAccessToken;
  }, [mapboxAccessToken]);

  useEffect(() => {
    const filteredStyles = mapStyles.filter((s) => s.available && activeMapStyles.includes(s.id));
    const styles = filteredStyles.length ? filteredStyles : mapStyles.filter((s) => s.id === 'osm');
    switcher.updateStyles(styles, defaultMapStyle);
  }, [mapStyles, defaultMapStyle, activeMapStyles, switcher]);

  useEffect(() => {
    const listener = (ready) => setMapReady(ready);
    addReadyListener(listener);
    return () => {
      removeReadyListener(listener);
    };
  }, []);

  useLayoutEffect(() => {
    const currentEl = containerEl.current;
    currentEl.appendChild(element);
    map.resize();
    return () => {
      currentEl.removeChild(element);
    };
  }, [containerEl]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }} ref={containerEl}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child) && child.type.handlesMapReady) {
          return React.cloneElement(child, { mapReady });
        }
        return mapReady ? child : null;
      })}
    </div>
  );
};
export default MapView;