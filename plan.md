# Bay Area Disaster Risks

## Overview

This project is a map-based info visualization of areas at risk of various types of natural disasters in the San Francisco Bay Area and environs. Existing maps show just one type of risk at a time (e.g. very high wildfire risk maps) but this one will show all of them.

The map (and its data sources) should encompass the area of the following California counties: Alameda, Contra Costa, Marin, Napa, San Mateo, Santa Clara, Solano, Sonoma, San Francisco, Santa Cruz, Monterey, San Benito, Sacramento, Yolo, San Joaquin, Merced, and Stanislaus.

## Technical stack

The project is a static client-side SvelteJS app. It also includes Python scripts for retrieving each data source, but that data should be saved locally for use in the map.

## Map

The background map should be simplified at a distance and visually nice to look at, while still having some reference place labels. Users should be able to pan and zoom in/out and at high zoom levels be able to identify streets/buildings. Basic OpenStreetMaps is too ugly for our purposes.

By default the map should show about a 30-mile radius centered on San Mateo Bridge.

## Layers

By default, zone layers have 33% opacity fill with a border in the same color but 66% opacity.

Color variables are specified in style.css.

### Very high wildfire risk zone

- Color: CSS variable `--fire-veryhigh`

### High wildfire risk zone

- Color: CSS variable `--fire-high`
- Background style: 3px wide stripes at a -65deg angle

### 100 year flood risk zone

- Color: CSS variable `--flood-100`

### 500 year flood risk zone

- Color: CSS variable `--flood-500`
- Background style: 6px wide stripes with 2px wide gaps, at a 15deg angle

### Major earthquake faults

- Color: CSS variable `--fault`

Note: These display as lines, not zones, and have opacity 70%.

### Liquefaction zone

- Color: CSS variable `--liquefaction`
- Background style: small transparent polka dots

### Landslide zone

- Color: CSS variable `--landslide`
- No border

### Tsunami hazard area

- Color: CSS variable `--tsunami`

Note: many data sources include open water in the hazard zone. This map should only show the parts of the zone that are on land.

### Dam failure inundation area

- Color: CSS variable `--dam-failure`

<!-- ### Future layer ideas (not implementing now)
- Noise pollution?
- Refineries/toxic chemical facilities proximity?
- Superfund sites
- Ghost sightings?? -->

## Legend

The legend should have its styles specified in the stylesheet, not inline.

The map will have a legend with checkboxes so users can toggle which risk zones they wish to see. By default, all should be on except for High wildfire risk and 500 year flood risk.

<!-- ## Future features (not implementing now)
- Place name lookup UI (enter address/city name/etc, zoom to it and give list of risk zones it's in)
- Movable legend (drag to move)
- Links to data sources
- Links to disaster preparedness resources -->
