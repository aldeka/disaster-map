# Bay Area Hazard Map

This is the code for a static site that visualizes different types of natural disaster risks in the bay area and environs. There's Python scripts for downloading and frobbing publicly-available hazard data from various sources and a static Svelte app for displaying the cached data.

Full disclosure: I used Claude to generate much of this project.

## Why

The idea behind this project had been on my side projects TODO list for...almost a decade?! (Back when I thought I might own a house one day, I made a preliminary version on paper with crayons since I couldn't find a map with more than one data type.)

## Sources

Hazard data:

- [CAL FIRE](https://osfm.fire.ca.gov/what-we-do/community-wildfire-preparedness-and-mitigation/fire-hazard-severity-zones)
- [FEMA](https://msc.fema.gov/portal/home)
- [California State Geoportal](https://gis-california.opendata.arcgis.com/)
- [US Census TIGERWeb](https://tigerweb.geo.census.gov/tigerwebmain/TIGERweb_main.html)

Map library is [Mapbox](https://www.mapbox.com/).

## LLM Use

This project was an excuse to try using an LLM code assistant for the first time. I let Claude download and frob the data for me. Claude also wrote most of the map embed code since I didn't have much experience with using mapping libraries.

The hacky styling, though? That's pretty much all me. And so is this writing. 😂

### How it went

This project got done WAAAAAAAY faster than it would have without Claude. (See also: ten freaking years of not getting to it earlier.) However, I didn't really _learn_ much in the sense of new programming skills. I have some sample code for map-based infoviz now, but I didn't write it. The data downloads and frobbing I still know nothing about (I never touched it myself). This was a nice chance to refresh my `<canvas>` know-how since I hadn't done that in a long time, but I had done that previously. As well as Svelte and CSS, of course.

In my experience almost all online map visualizations are ugly. (Because the data and libraries they are made of seem to be ugly-by-default.) IMHO this one is...less bad, through much trial and error and telling Claude to merge contiguous regions and stop deleting the Hayward Fault. So that part was an interesting and educational design challenge!

I learned some things about how to work with Claude Code and now better understand some of the jargon. https://www.youtube.com/watch?v=M6mYodf0dJM was a helpful video for getting started and I also got a lot out of Anthropic's [docs](https://support.claude.com/en/articles/14553413-claude-code-cheatsheet). I was never in any danger of hitting any token limits (on the monthly Pro plan, which you need to get access to Claude Code at all) nor did context windows ever become an issue.

Reading the ~~prayers of supplication~~skills in https://github.com/anthropics/skills/ that overlap with my areas of expertise and care was completely fucking horrifying. 🫠

## Further work

- The landslide data is very incomplete; it only covers the immediate surroundings of the bay. Supposedly there's federal data that would provide more coverage, but it uses a totally different methodology/standard and would be a BIG download so I didn't bother with that.
- Manmade hazards (noise pollution, superfund sites, major industrial hazards like refineries) would be cool to add. I don't know if there's good sources of data for all of those, though. Light pollution is definitely not worth adding, it's basically ALL bad here XD
- I wanted to make the toggles also show the stripes/dots as-used on the map, but that was going to be a whole project of CSS <--> canvas styling translation so I didn't bother for now.
- Speaking of which, the textures on some of the layers are intended to make the map more accessible to colorblind users (without being ugly or distracting). I am not colorblind myself, so I don't know if I achieved that goal or not.
- Oh, you know, the usual: tests, better separation of concerns, deleting useless stuff... This is very much not a production ready project.
