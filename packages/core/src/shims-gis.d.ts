declare module "shpjs" {
  function shp(
    data: ArrayBuffer | string | { shp: ArrayBuffer; dbf: ArrayBuffer; shx?: ArrayBuffer; prj?: ArrayBuffer }
  ): Promise<any>;
  export default shp;
}

declare module "@mapbox/togeojson" {
  export function kml(doc: Document, options?: any): any;
  export function gpx(doc: Document, options?: any): any;
}
