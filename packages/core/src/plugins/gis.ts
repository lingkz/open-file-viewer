/// <reference path="../shims-gis.d.ts" />
import type { PreviewPlugin, PreviewFile } from "../types";
import { readArrayBuffer } from "./utils";

const gisExtensions = new Set(["geojson", "topojson", "kml", "kmz", "gpx", "shp"]);

function loadLeafletCss(): Promise<void> {
  const id = "ofv-leaflet-css";
  if (document.getElementById(id)) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css";
    link.onload = () => resolve();
    link.onerror = () => reject(new Error("Failed to load Leaflet CSS from CDN."));
    document.head.appendChild(link);
  });
}

export function gisPlugin(): PreviewPlugin {
  return {
    name: "gis",
    match(file) {
      return gisExtensions.has(file.extension) || file.mimeType === "application/geo+json";
    },
    async render(ctx) {
      // 1. Load Leaflet CSS and dynamic imports
      await loadLeafletCss();

      const [L, topojson, toGeoJSON, shpjs, JSZip] = await Promise.all([
        import("leaflet"),
        import("topojson-client"),
        import("@mapbox/togeojson"),
        import("shpjs"),
        import("jszip")
      ]);

      const Leaflet = L.default || L;
      const topojsonClient = topojson.default || topojson;
      const togeojsonLib = toGeoJSON.default || toGeoJSON;
      const shpLib = shpjs.default || shpjs;
      const JSZipLib = JSZip.default || JSZip;

      // Fix default marker icon paths using inline SVG to avoid asset 404 errors
      const DefaultIcon = Leaflet.icon({
        iconUrl: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32">
            <path fill="#3b82f6" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
        `),
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowUrl: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32">
            <ellipse cx="12" cy="20" rx="6" ry="2" fill="#000000" opacity="0.2"/>
          </svg>
        `),
        shadowSize: [41, 41],
        shadowAnchor: [12, 41]
      });
      Leaflet.Marker.prototype.options.icon = DefaultIcon;

      // 2. Read file as ArrayBuffer and Parse to GeoJSON
      const buffer = await readArrayBuffer(ctx.file);
      const geojson = await parseToGeoJson(
        ctx.file,
        buffer,
        togeojsonLib,
        topojsonClient,
        shpLib,
        JSZipLib
      );

      // Handle raw unzipped shapefile warning UI
      if (geojson === null && ctx.file.extension === "shp") {
        const fallback = document.createElement("div");
        fallback.className = "ofv-fallback";

        const title = document.createElement("strong");
        title.innerHTML = "⚠️ 无法直接预览单个 .shp 文件";

        const desc = document.createElement("span");
        desc.textContent = "Shapefile 格式需要包含配套的 .dbf 和 .shx 数据文件。请将它们打包为 .zip 文件后上传预览，或在压缩包列表中直接查看。";

        fallback.append(title, desc);
        ctx.viewport.classList.add("ofv-center");
        ctx.viewport.append(fallback);

        return {
          destroy() {
            ctx.viewport.classList.remove("ofv-center");
            fallback.remove();
          }
        };
      }

      // 3. Render Leaflet Map
      const mapContainer = document.createElement("div");
      mapContainer.className = "ofv-map-stage";
      ctx.viewport.appendChild(mapContainer);

      const map = Leaflet.map(mapContainer).setView([0, 0], 2);

      Leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);

      // Render GeoJSON elements with premium blue color styles
      const geojsonLayer = Leaflet.geoJSON(geojson, {
        style: () => ({
          color: "#3b82f6",
          weight: 2,
          opacity: 0.8,
          fillColor: "#93c5fd",
          fillOpacity: 0.35
        }),
        pointToLayer: (feature: any, latlng: any) => {
          return Leaflet.circleMarker(latlng, {
            radius: 6,
            fillColor: "#3b82f6",
            color: "#ffffff",
            weight: 1.5,
            opacity: 1,
            fillOpacity: 0.8
          });
        },
        onEachFeature: (feature: any, layer: any) => {
          if (feature.properties) {
            const props = feature.properties;
            const keys = Object.keys(props);
            if (keys.length > 0) {
              const popupContent = document.createElement("div");
              popupContent.className = "ofv-map-popup";

              const popupTitle = document.createElement("h4");
              popupTitle.textContent = "属性信息";
              popupContent.appendChild(popupTitle);

              const table = document.createElement("table");
              table.className = "ofv-map-popup-table";

              for (const key of keys) {
                const val = props[key];
                if (val === null || val === undefined) continue;

                const row = document.createElement("tr");
                const cellKey = document.createElement("td");
                cellKey.className = "ofv-map-popup-key";
                cellKey.textContent = key;

                const cellVal = document.createElement("td");
                cellVal.className = "ofv-map-popup-val";
                cellVal.textContent = typeof val === "object" ? JSON.stringify(val) : String(val);

                row.append(cellKey, cellVal);
                table.appendChild(row);
              }

              popupContent.appendChild(table);
              layer.bindPopup(popupContent);
            }
          }
        }
      }).addTo(map);

      // Zoom map to dataset bounds
      try {
        const bounds = geojsonLayer.getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [20, 20] });
        }
      } catch (e) {
        console.warn("Could not fit bounds for GeoJSON data:", e);
      }

      return {
        resize() {
          map.invalidateSize();
        },
        destroy() {
          map.remove();
          mapContainer.remove();
        }
      };
    }
  };
}

async function parseToGeoJson(
  file: PreviewFile,
  buffer: ArrayBuffer,
  togeojsonLib: any,
  topojsonClient: any,
  shpLib: any,
  JSZipLib: any
): Promise<any> {
  const ext = file.extension.toLowerCase();

  if (ext === "geojson") {
    const text = new TextDecoder().decode(buffer);
    return JSON.parse(text);
  }

  if (ext === "topojson") {
    const text = new TextDecoder().decode(buffer);
    const topology = JSON.parse(text);
    const geojsonFeatures: any[] = [];
    for (const key of Object.keys(topology.objects)) {
      const feature = topojsonClient.feature(topology, topology.objects[key]);
      if (feature.type === "FeatureCollection") {
        geojsonFeatures.push(...feature.features);
      } else {
        geojsonFeatures.push(feature);
      }
    }
    return {
      type: "FeatureCollection",
      features: geojsonFeatures
    };
  }

  if (ext === "kml") {
    const text = new TextDecoder().decode(buffer);
    const dom = new DOMParser().parseFromString(text, "text/xml");
    return togeojsonLib.kml(dom);
  }

  if (ext === "gpx") {
    const text = new TextDecoder().decode(buffer);
    const dom = new DOMParser().parseFromString(text, "text/xml");
    return togeojsonLib.gpx(dom);
  }

  if (ext === "kmz") {
    const zip = await JSZipLib.loadAsync(buffer);
    const kmlFile: any = Object.values(zip.files).find((f: any) => f.name.toLowerCase().endsWith(".kml"));
    if (!kmlFile) {
      throw new Error("No KML file found inside KMZ archive.");
    }
    const kmlText = await kmlFile.async("text");
    const dom = new DOMParser().parseFromString(kmlText, "text/xml");
    return togeojsonLib.kml(dom);
  }

  if (ext === "shp") {
    const u8 = new Uint8Array(buffer);
    const isZip = u8[0] === 0x50 && u8[1] === 0x4b && u8[2] === 0x03 && u8[3] === 0x04;
    if (!isZip) {
      return null; // Signals raw shapefile
    }
    const parsed = await shpLib(buffer);
    if (Array.isArray(parsed)) {
      const features: any[] = [];
      for (const item of parsed) {
        if (item.type === "FeatureCollection") {
          features.push(...item.features);
        } else if (item.type === "Feature") {
          features.push(item);
        }
      }
      return {
        type: "FeatureCollection",
        features
      };
    }
    return parsed;
  }

  // Mime type match fallback
  try {
    const text = new TextDecoder().decode(buffer);
    return JSON.parse(text);
  } catch {
    throw new Error(`Unsupported GIS format: ${ext}`);
  }
}
