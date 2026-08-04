#!/usr/bin/env python3
"""Fetch and cache Bay Area hazard GIS data as local JS files.

Pulls CAL FIRE Very High Fire Hazard Severity Zones, FEMA National
Flood Hazard Layer (100-year / 500-year) polygons, CGS/USGS earthquake
fault traces, CGS liquefaction and landslide zones, and CA tsunami and
dam-failure inundation areas, all clipped to the Bay Area, and writes
them to data/*.js as `const ..._DATA = {...}` so the map page can load
them with a plain <script src> tag (works offline, no fetch()/CORS
involved).

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
# "Quaternary Fault" (layer 3) already includes the Historic/Holocene/Late
# Quaternary/Quaternary age subcategories that layers 0-2 separately mirror.
# CGS's curated "major fault" (UCERF3) service requires an auth token we
# don't have, so instead we filter this public layer down to the named
# major Bay Area fault zones below.
FAULT_BASE = "https://services.gis.ca.gov/arcgis/rest/services/GeoscientificInformation/Fault_Lines/MapServer/3/query"
MAJOR_FAULT_NAMES = [
    "San Andreas", "Hayward", "Rodgers Creek", "Calaveras", "Concord",
    "Green Valley", "Greenville", "San Gregorio", "Maacama", "West Napa",
    "Mount Diablo",
]

LIQUEFACTION_BASE = "https://services.gis.ca.gov/arcgis/rest/services/GeoscientificInformation/Liquefaction/MapServer/0/query"
LANDSLIDE_BASE = "https://services2.arcgis.com/zr3KAIbsRSUyARHG/ArcGIS/rest/services/CGS_Landslide_Zones/FeatureServer/0/query"
TSUNAMI_BASE = "https://services.gis.ca.gov/arcgis/rest/services/Oceans/Tsunami/MapServer/0/query"
DAM_BASE = "https://services6.arcgis.com/T8eS7sop5hLmgRRH/arcgis/rest/services/Dam_Inundation_Areas/FeatureServer/0/query"

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

    print("Fetching major earthquake fault traces...")
    fault_where = " OR ".join(f"NAME LIKE '%{n}%'" for n in MAJOR_FAULT_NAMES)
    faults = fetch_arcgis_layer(
        FAULT_BASE, fault_where, {"outFields": "NAME,AGE", **generalize}, paginate=True
    )
    write_js("faults.js", "FAULT_DATA", faults)

    print("Fetching liquefaction zones...")
    liquefaction = fetch_arcgis_layer(
        LIQUEFACTION_BASE, "1=1", {"outFields": "Id", **generalize}, paginate=True
    )
    write_js("liquefaction.js", "LIQUEFACTION_DATA", liquefaction)

    print("Fetching landslide zones...")
    landslide = fetch_arcgis_layer(
        LANDSLIDE_BASE, "1=1", {"outFields": "QUAD_NAME", **generalize}, paginate=True
    )
    write_js("landslide.js", "LANDSLIDE_DATA", landslide)

    print("Fetching tsunami inundation zones...")
    tsunami = fetch_arcgis_layer(
        TSUNAMI_BASE, "1=1", {"outFields": "County,Label,Evacuate", **generalize}, paginate=True
    )
    write_js("tsunami.js", "TSUNAMI_DATA", tsunami)

    print("Fetching dam failure inundation zones...")
    dam = fetch_arcgis_layer(
        DAM_BASE, "1=1", {"outFields": "Name,HazardClass,Scenario", **generalize}, paginate=True
    )
    write_js("dam_inundation.js", "DAM_INUNDATION_DATA", dam)


if __name__ == "__main__":
    main()
