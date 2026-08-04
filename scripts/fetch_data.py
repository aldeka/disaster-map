#!/usr/bin/env python3
"""Fetch and cache Bay Area hazard GIS data as local JS files.

Pulls CAL FIRE Very High Fire Hazard Severity Zones and FEMA National
Flood Hazard Layer (100-year / 500-year) polygons clipped to the Bay
Area, and writes them to data/*.js as `const ..._DATA = {...}` so the
map page can load them with a plain <script src> tag (works offline,
no fetch()/CORS involved).

Re-run this script to refresh the cached data.
"""
import json
import urllib.parse
import urllib.request
import pathlib

BAY_BBOX = "-123.6,36.8,-121.2,38.9"
DATA_DIR = pathlib.Path(__file__).resolve().parent.parent / "data"

FIRE_BASE = "https://services.gis.ca.gov/arcgis/rest/services/Environment/Fire_Severity_Zones/MapServer"
FLOOD_BASE = "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query"

# Both source layers trace fine natural/parcel-scale contours with far
# more vertices than a whole-Bay-Area overview map can usefully show.
# Generalize (~50m) and round coordinates so the cached files stay a
# reasonable size to ship and render as plain SVG polygons.
MAX_ALLOWABLE_OFFSET = "0.0005"
GEOMETRY_PRECISION = "4"
PAGE_SIZE = 2000


def fetch_json(url, params):
    query = urllib.parse.urlencode(params)
    with urllib.request.urlopen(f"{url}?{query}") as resp:
        return json.loads(resp.read())


def fetch_arcgis_layer(url, where, extra_params=None, paginate=False):
    features = []
    offset = 0
    while True:
        params = {
            "where": where,
            "geometry": BAY_BBOX,
            "geometryType": "esriGeometryEnvelope",
            "inSR": "4326",
            "spatialRel": "esriSpatialRelIntersects",
            "returnGeometry": "true",
            "outSR": "4326",
            "f": "geojson",
            "resultRecordCount": str(PAGE_SIZE),
        }
        if extra_params:
            params.update(extra_params)
        if paginate:
            params["resultOffset"] = str(offset)

        data = fetch_json(url, params)
        page_features = data.get("features", [])
        features.extend(page_features)

        if not paginate or len(page_features) < PAGE_SIZE:
            break
        offset += PAGE_SIZE

    return features


def write_js(filename, const_name, features):
    geojson = {"type": "FeatureCollection", "features": features}
    path = DATA_DIR / filename
    with path.open("w") as f:
        f.write(f"const {const_name} = ")
        json.dump(geojson, f, separators=(",", ":"))
        f.write(";\n")
    size_kb = path.stat().st_size / 1024
    print(f"{filename}: {len(features)} features, {size_kb:.0f} KB")


def main():
    DATA_DIR.mkdir(exist_ok=True)

    generalize = {
        "maxAllowableOffset": MAX_ALLOWABLE_OFFSET,
        "geometryPrecision": GEOMETRY_PRECISION,
    }

    print("Fetching CAL FIRE Very High Fire Hazard Severity Zones...")
    sra = fetch_arcgis_layer(
        f"{FIRE_BASE}/0/query",
        "HAZ_CLASS='Very High'",
        {"outFields": "HAZ_CLASS", **generalize},
        paginate=True,
    )
    lra = fetch_arcgis_layer(
        f"{FIRE_BASE}/1/query", "1=1", {"outFields": "VH_REC", **generalize}, paginate=True
    )
    write_js("fire_hazard.js", "FIRE_HAZARD_DATA", sra + lra)

    print("Fetching FEMA 100-year flood zones (SFHA)...")
    flood100 = fetch_arcgis_layer(
        FLOOD_BASE,
        "SFHA_TF='T'",
        {"outFields": "FLD_ZONE,ZONE_SUBTY,SFHA_TF", **generalize},
        paginate=True,
    )
    write_js("flood_100yr.js", "FLOOD_100YR_DATA", flood100)

    print("Fetching FEMA 500-year flood zones...")
    flood500 = fetch_arcgis_layer(
        FLOOD_BASE,
        "FLD_ZONE='X' AND ZONE_SUBTY LIKE '0.2 PCT%'",
        {"outFields": "FLD_ZONE,ZONE_SUBTY,SFHA_TF", **generalize},
        paginate=True,
    )
    write_js("flood_500yr.js", "FLOOD_500YR_DATA", flood500)


if __name__ == "__main__":
    main()
