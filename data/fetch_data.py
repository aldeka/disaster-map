#!/usr/bin/env python3
"""Fetch and cache Bay Area + Central Valley hazard GIS data as local JSON files.

Pulls CAL FIRE Very High Fire Hazard Severity Zones, FEMA National
Flood Hazard Layer (100-year / 500-year) polygons, CGS/USGS earthquake
fault traces, CGS liquefaction and landslide zones, and CA tsunami and
dam-failure inundation areas, clipped to the 17-county extent defined
below, and writes them to public/data/*.json so the Vite/Svelte app can
fetch() them at runtime as static files.

Re-run this script to refresh the cached data.
"""
import json
import urllib.parse
import urllib.request
import pathlib

from shapely import make_valid
from shapely.geometry import shape, mapping
from shapely.ops import unary_union

DATA_DIR = pathlib.Path(__file__).resolve().parent.parent / "public" / "data"

COUNTY_BASE = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/1/query"
# GEOID = state FIPS (06 = California) + county FIPS.
COUNTY_GEOIDS = {
    "06001": "Alameda", "06013": "Contra Costa", "06041": "Marin",
    "06055": "Napa", "06081": "San Mateo", "06085": "Santa Clara",
    "06095": "Solano", "06097": "Sonoma", "06075": "San Francisco",
    "06087": "Santa Cruz", "06053": "Monterey", "06069": "San Benito",
    "06067": "Sacramento", "06113": "Yolo", "06077": "San Joaquin",
    "06047": "Merced", "06099": "Stanislaus",
}

FIRE_BASE = "https://services.gis.ca.gov/arcgis/rest/services/Environment/Fire_Severity_Zones/MapServer"
FLOOD_BASE = "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query"
# "Quaternary Fault" (layer 3) already includes the Historic/Holocene/Late
# Quaternary/Quaternary age subcategories that layers 0-2 separately mirror.
# CGS's curated "major fault" (UCERF3) service requires an auth token we
# don't have, so instead we filter this public layer down to the named
# major Bay Area / Central Valley fault zones below.
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
# more vertices than a whole-region overview map can usefully show.
# Generalize (~50m) and round coordinates so the cached files stay a
# reasonable size to ship and render as plain SVG polygons.
MAX_ALLOWABLE_OFFSET = "0.0005"
GEOMETRY_PRECISION = "4"
PAGE_SIZE = 2000
# Padding added around the county-union envelope so features that
# straddle the boundary (e.g. a flood zone centered just outside a
# county line) aren't dropped by the bbox pre-filter.
BBOX_PADDING_DEG = 0.05


def fetch_json(url, params):
    query = urllib.parse.urlencode(params)
    with urllib.request.urlopen(f"{url}?{query}") as resp:
        return json.loads(resp.read())


def fetch_arcgis_layer(url, where, extra_params=None, paginate=False, bbox=None):
    features = []
    offset = 0
    while True:
        params = {
            "where": where,
            "returnGeometry": "true",
            "outSR": "4326",
            "f": "geojson",
            "resultRecordCount": str(PAGE_SIZE),
        }
        if bbox:
            params.update(
                {
                    "geometry": bbox,
                    "geometryType": "esriGeometryEnvelope",
                    "inSR": "4326",
                    "spatialRel": "esriSpatialRelIntersects",
                }
            )
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


def fetch_county_union():
    """Fetch the 17-county boundary; return (bbox_str, shapely union geometry)."""
    print("Fetching county boundaries...")
    where = "GEOID IN (" + ",".join(f"'{g}'" for g in COUNTY_GEOIDS) + ")"
    features = fetch_arcgis_layer(
        COUNTY_BASE,
        where,
        {
            "outFields": "NAME,GEOID",
            "maxAllowableOffset": MAX_ALLOWABLE_OFFSET,
            "geometryPrecision": GEOMETRY_PRECISION,
        },
    )
    found = {f["properties"]["GEOID"] for f in features}
    missing = set(COUNTY_GEOIDS) - found
    if missing:
        raise RuntimeError(f"Missing county GEOIDs from TIGERweb response: {missing}")

    union = unary_union([make_valid(shape(f["geometry"])) for f in features])
    minx, miny, maxx, maxy = union.bounds
    bbox = (
        f"{minx - BBOX_PADDING_DEG},{miny - BBOX_PADDING_DEG},"
        f"{maxx + BBOX_PADDING_DEG},{maxy + BBOX_PADDING_DEG}"
    )
    print(f"  {len(features)} counties, bbox={bbox}")
    return bbox, union


def clip_to_land(features, land_union):
    """Keep only the on-land portion of each feature (drops open-water area)."""
    clipped = []
    for f in features:
        geom = make_valid(shape(f["geometry"]))
        inter = geom.intersection(land_union)
        if inter.is_empty:
            continue
        if inter.geom_type == "GeometryCollection":
            polys = [g for g in inter.geoms if g.geom_type in ("Polygon", "MultiPolygon")]
            if not polys:
                continue
            inter = unary_union(polys)
        if inter.geom_type not in ("Polygon", "MultiPolygon"):
            continue
        clipped.append({"type": "Feature", "properties": f["properties"], "geometry": mapping(inter)})
    return clipped


def write_json(filename, features):
    geojson = {"type": "FeatureCollection", "features": features}
    path = DATA_DIR / filename
    with path.open("w") as f:
        json.dump(geojson, f, separators=(",", ":"))
    size_kb = path.stat().st_size / 1024
    print(f"{filename}: {len(features)} features, {size_kb:.0f} KB")


def main():
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    bbox, land_union = fetch_county_union()

    generalize = {
        "maxAllowableOffset": MAX_ALLOWABLE_OFFSET,
        "geometryPrecision": GEOMETRY_PRECISION,
    }

    print("Fetching CAL FIRE Very High Fire Hazard Severity Zones...")
    # LRA (local responsibility areas) are only ever designated "Very High" under
    # state law -- there's no "High" class there, so the High layer below only
    # draws from SRA (state responsibility areas), which has Moderate/High/Very High.
    sra_veryhigh = fetch_arcgis_layer(
        f"{FIRE_BASE}/0/query",
        "HAZ_CLASS='Very High'",
        {"outFields": "HAZ_CLASS", **generalize},
        paginate=True,
        bbox=bbox,
    )
    lra_veryhigh = fetch_arcgis_layer(
        f"{FIRE_BASE}/1/query",
        "HAZ_CLASS='Very High'",
        {"outFields": "HAZ_CLASS", **generalize},
        paginate=True,
        bbox=bbox,
    )
    write_json("fire_hazard_veryhigh.json", sra_veryhigh + lra_veryhigh)

    print("Fetching CAL FIRE High Fire Hazard Severity Zones...")
    sra_high = fetch_arcgis_layer(
        f"{FIRE_BASE}/0/query",
        "HAZ_CLASS='High'",
        {"outFields": "HAZ_CLASS", **generalize},
        paginate=True,
        bbox=bbox,
    )
    write_json("fire_hazard_high.json", sra_high)

    print("Fetching FEMA 100-year flood zones (SFHA)...")
    flood100 = fetch_arcgis_layer(
        FLOOD_BASE,
        "SFHA_TF='T'",
        {"outFields": "FLD_ZONE,ZONE_SUBTY,SFHA_TF", **generalize},
        paginate=True,
        bbox=bbox,
    )
    write_json("flood_100yr.json", flood100)

    print("Fetching FEMA 500-year flood zones...")
    flood500 = fetch_arcgis_layer(
        FLOOD_BASE,
        "FLD_ZONE='X' AND ZONE_SUBTY LIKE '0.2 PCT%'",
        {"outFields": "FLD_ZONE,ZONE_SUBTY,SFHA_TF", **generalize},
        paginate=True,
        bbox=bbox,
    )
    write_json("flood_500yr.json", flood500)

    print("Fetching major earthquake fault traces...")
    fault_where = " OR ".join(f"NAME LIKE '%{n}%'" for n in MAJOR_FAULT_NAMES)
    faults = fetch_arcgis_layer(
        FAULT_BASE,
        fault_where,
        {"outFields": "NAME,AGE", **generalize},
        paginate=True,
        bbox=bbox,
    )
    write_json("faults.json", faults)

    print("Fetching liquefaction zones...")
    liquefaction = fetch_arcgis_layer(
        LIQUEFACTION_BASE,
        "1=1",
        {"outFields": "Id", **generalize},
        paginate=True,
        bbox=bbox,
    )
    write_json("liquefaction.json", liquefaction)

    print("Fetching landslide zones...")
    landslide = fetch_arcgis_layer(
        LANDSLIDE_BASE,
        "1=1",
        {"outFields": "QUAD_NAME", **generalize},
        paginate=True,
        bbox=bbox,
    )
    write_json("landslide.json", landslide)

    print("Fetching tsunami inundation zones...")
    tsunami = fetch_arcgis_layer(
        TSUNAMI_BASE,
        "1=1",
        {"outFields": "County,Label,Evacuate", **generalize},
        paginate=True,
        bbox=bbox,
    )
    tsunami_land = clip_to_land(tsunami, land_union)
    print(f"  clipped to land: {len(tsunami)} -> {len(tsunami_land)} features")
    write_json("tsunami.json", tsunami_land)

    print("Fetching dam failure inundation zones...")
    dam = fetch_arcgis_layer(
        DAM_BASE,
        "1=1",
        {"outFields": "Name,HazardClass,Scenario", **generalize},
        paginate=True,
        bbox=bbox,
    )
    write_json("dam_inundation.json", dam)


if __name__ == "__main__":
    main()
