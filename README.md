# Bay Area Hazard Map

[https://aldeka.github.io/bay-area-hazard-map](https://aldeka.github.io/bay-area-hazard-map)

This is the code for a static site that visualizes different types of natural disaster risks in the bay area and environs. There's Python scripts for downloading and frobbing publicly-available hazard data from various sources and a static Svelte app for displaying the cached data.

Full disclosure: I used Claude to generate much of this project. <a href="#llm-use">See the section at the end of the README</a> for an overly verbose essay on why and how I did that.

## Why

The idea behind this project had been on my side projects TODO list for...almost a decade?! (Back when I thought I might own a house one day, I made a preliminary version on paper with crayons since I couldn't find a map with more than one data type to help evaluate housing units for sale.)

## Sources

Hazard data:

- [CAL FIRE](https://osfm.fire.ca.gov/what-we-do/community-wildfire-preparedness-and-mitigation/fire-hazard-severity-zones)
- [FEMA](https://msc.fema.gov/portal/home)
- [California State Geoportal](https://gis-california.opendata.arcgis.com/)
- [US Census TIGERWeb](https://tigerweb.geo.census.gov/tigerwebmain/TIGERweb_main.html)

Map library is [Mapbox](https://www.mapbox.com/).

## Hypothetical further work

- The landslide data is very incomplete; it only covers the immediate surroundings of the bay. Supposedly there's federal data that would provide more coverage, but according to Claude it uses a totally different methodology/standard and would be a BIG download so I didn't bother with that.
- Manmade hazards (noise pollution, superfund sites, major industrial hazards like refineries) would be cool to add. I don't know if there's good sources of data for all of those, though. Light pollution is definitely not worth adding, it's basically ALL bad here.
- A box to look up and zoom in on a particular address and list the hazards present?
- ~I wanted to make the toggles also show the stripes/dots as-used on the map, but that was going to be a whole project of CSS <--> canvas styling translation so I didn't bother for now.~ JK I let Claude do this (with some moderate nudging and editing)
- Speaking of which, the textures on some of the layers are intended to make the map more accessible to colorblind users (without being ugly or distracting). I am not colorblind myself, so I don't know if I achieved that goal or not.
- Oh, you know, the usual: tests, better separation of concerns, deleting useless stuff... 😂

## LLM Use

Gently challenged by someone dear to me that my LLM refusenik status was entirely driven by secondhand hot takes rather than personal experience, I used this project as an excuse to try using an LLM code assistant for the first time.

I intended to publish how many tokens I used on this project, but bewilderingly Claude Pro doesn't give you any way to track usage over time! My last Claude Code session used 615,000 tokens, but that's an underestimate since I did work over multiple sessions. >.< If I ever do this again I guess I'll keep track manually?

I let Claude Code download and frob the data for me. Claude also wrote most of the map embed code since I didn't have much experience with using mapping libraries.

The hacky styling, though? That's pretty much all me. And so is this writing. :P

### How it went

Getting to ~80% completion went WAY faster than it would have without Claude. I didn't feel like I had to fight with the bot much. However, I didn't really _learn_ much in the way of new programming skills. I have some sample code for map-based infoviz now, but I didn't write most of it. The download and frobbing scripts I know nothing about (I never touched them myself). This was a nice chance to refresh my `<canvas>` know-how since I hadn't done that in a long time, but I had done that previously. As well as Svelte and CSS, of course.

In my experience almost all online map visualizations are ugly. (The data and libraries they are made of seem to be ugly-by-default, for numerous reasons.) IMHO this one is...somewhat less bad, through much manual trial and error and telling Claude to merge contiguous regions and to trim regions extending over water and consolidate fault system lines in a reasonable way. So in that respect this project was an interesting and educational design challenge!

I learned some things about how to work with Claude Code and now better understand some of the jargon. https://www.youtube.com/watch?v=M6mYodf0dJM was a helpful video for getting started and I also got a lot out of Anthropic's [docs](https://support.claude.com/en/articles/14553413-claude-code-cheatsheet). Reading the ~~weirdly browbeating prayers of supplication~~"skills" in https://github.com/anthropics/skills/ that overlap with my areas of expertise and care was completely fucking horrifying. 🫠

I discovered that the <a href="https://en.wikipedia.org/wiki/Cayce_Pollard">psychic-anaphylactic reaction</a>, the (sometimes-literal) nausea I often get from AI-generated writing and visuals, did not kick in for me with the code. (Well, except for the comments. And the chatbot itself at times.) That was somewhat comforting. Feeling in control of the look and feel of the project UI, specifically, was extremely important for me, so I did not let Claude write much CSS. (It was pretty bad at noticing and solving visual/UX problems anyway!)

I still don't know how much I would trust Claude Code for a project that actually mattered--especially one that's brownfield, where I'm on the hook for maintenance and bug fixes, where I can't just throw out the whole thing and start over.

And beyond that... **I see how LLMs make helplessness easy.** For example, rather than doing the work of reading the docs to remind myself how to bind a value with a subcomponent in Svelte, I almost just asked Claude to do it. Same thing happened while trying to figure out how do a minor thing with Vite. I _didn't_ ask Claude, but I noticed the impulse to. I hate that for things that are obviously in my domain. I found it extremely useful for things that I know little about and don't have anyone else to work on them with.

To use LLMs, it seems like you have to decide in advance the bounds of what you want to learn and be good at and what you don't. :/

Chatbots are addictive by nature. I now have some small personal experience with this. Others have done more research and written in greater detail on this dynamic but I imagine external professional pressure to go faster and LGTMallthethings.gif makes that even worse.

(And of course none of this even starts to consider the ethics of looting and DDOSing the intellectual commons and semi-literally boiling the planet in order to turn billionaires into trillionaires and glaze the egos of the worst humans you know 💅✨🙃)
