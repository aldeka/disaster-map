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
# County boundaries are legal/jurisdictional and extend into bays and the
# ocean (e.g. San Francisco County's boundary covers Bay waters) -- they are
# NOT a land outline. Areal Hydrography gives the actual water polygons so we
# can subtract them from the county union to get a true land mask.
HYDRO_BASE = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Hydro/MapServer/1/query"
# GEOID = state FIPS (06 = California) + county FIPS.
COUNTY_GEOIDS = {
    "06001": "Alameda", "06013": "Contra Costa", "06041": "Marin",
    "06055": "Napa", "06081": "San Mateo", "06085": "Santa Clara",
    "06095": "Solano", "06097": "Sonoma", "06075": "San Francisco",
    "06087": "Santa Cruz", "06053": "Monterey", "06069": "San Benito",
    "06067": "Sacramento", "06113": "Yolo", "06077": "San Joaquin",
    "06047": "Merced", "06099": "Stanislaus",
}

# Official CAL FIRE Fire Hazard Severity Zone services (prefire.calfire org).
# SRA effective April 1, 2024; LRA rebuilt/rolled out Feb-Mar 2025 -- both far
# newer than the 2007 SRA / 2011 LRA data on services.gis.ca.gov, and the 2025
# LRA rebuild adds Moderate/High classes the old LRA-only-"Very High" data lacked.
FIRE_SRA_BASE = "https://services1.arcgis.com/jUJYIo9tSA7EHvfZ/arcgis/rest/services/FHSZSRA_23_3/FeatureServer/0/query"
FIRE_LRA_BASE = "https://services1.arcgis.com/jUJYIo9tSA7EHvfZ/arcgis/rest/services/FHSALRA25_v1_All/FeatureServer/0/query"
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

# Source layers trace fine natural/parcel-scale contours with far more
# vertices than a whole-region overview map needs. Generalize lightly
# (~3m, imperceptible even at street-level zoom) mostly to shed redundant
# vertices; keep coordinate rounding tight (~0.1m) so it doesn't add its
# own visible boundary drift on top of the generalization.
MAX_ALLOWABLE_OFFSET = "0.0001"
GEOMETRY_PRECISION = "6"
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


def fetch_land_mask(bbox, county_union):
    """Subtract bays/ocean/lakes from the county union to get an actual land mask."""
    print("Fetching water areas to build land mask...")
    water_features = fetch_arcgis_layer(
        HYDRO_BASE,
        "1=1",
        {
            "outFields": "NAME",
            "maxAllowableOffset": MAX_ALLOWABLE_OFFSET,
            "geometryPrecision": GEOMETRY_PRECISION,
        },
        paginate=True,
        bbox=bbox,
    )
    print(f"  {len(water_features)} water features")
    if not water_features:
        return county_union
    water_union = unary_union([make_valid(shape(f["geometry"])) for f in water_features])
    return county_union.difference(water_union)


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

    bbox, county_union = fetch_county_union()
    land_mask = fetch_land_mask(bbox, county_union)

    generalize = {
        "maxAllowableOffset": MAX_ALLOWABLE_OFFSET,
        "geometryPrecision": GEOMETRY_PRECISION,
    }

    print("Fetching CAL FIRE Very High Fire Hazard Severity Zones...")
    sra_veryhigh = fetch_arcgis_layer(
        FIRE_SRA_BASE,
        "FHSZ_Description='Very High'",
        {"outFields": "FHSZ_Description", **generalize},
        paginate=True,
        bbox=bbox,
    )
    lra_veryhigh = fetch_arcgis_layer(
        FIRE_LRA_BASE,
        "FHSZ_Description='Very High'",
        {"outFields": "FHSZ_Description", **generalize},
        paginate=True,
        bbox=bbox,
    )
    write_json("fire_hazard_veryhigh.json", sra_veryhigh + lra_veryhigh)

    print("Fetching CAL FIRE High Fire Hazard Severity Zones...")
    sra_high = fetch_arcgis_layer(
        FIRE_SRA_BASE,
        "FHSZ_Description='High'",
        {"outFields": "FHSZ_Description", **generalize},
        paginate=True,
        bbox=bbox,
    )
    lra_high = fetch_arcgis_layer(
        FIRE_LRA_BASE,
        "FHSZ_Description='High'",
        {"outFields": "FHSZ_Description", **generalize},
        paginate=True,
        bbox=bbox,
    )
    write_json("fire_hazard_high.json", sra_high + lra_high)

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
    tsunami_land = clip_to_land(tsunami, land_mask)
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
