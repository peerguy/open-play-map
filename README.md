# Open Play Map

A directory of pickleball courts across the US where people can find open play.

## Goal

Help players quickly answer: “Where can I play open play pickleball near me, what level is it, when does it happen, and is it free?”

## Starter Prototype

This project starts as a simple static web app using:

- **Leaflet.js** for the interactive map
- **OpenStreetMap** tiles as a free Google Maps alternative
- A local JSON directory of courts/parks
- Search + filters for name, location, skill level, cost, and open-play notes

## Directory Fields

Each location should track:

- Park/court name
- Address/city/state
- Latitude/longitude
- Public/free vs paid/private
- Open play days/hours
- Estimated skill level
- Number of courts
- Indoor/outdoor
- Photos
- Notes/source/last verified date

## Run Locally

This app is static again. Run it from a simple local server:

```bash
cd ~/Projects/open-play-map
python3 -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

## Nearby Research

The OpenClaw-powered nearby research feature has been moved to its own project:

```text
../Open Play Research
```

That separate app uses Node/OpenClaw and keeps the AI research flow out of this map build.

## Next Steps

1. Add real court data to `data/courts.json`.
2. Add photos under `assets/photos/` and reference them from the JSON.
3. Decide whether this should stay static or become a full web app with submissions, moderation, accounts, and admin tools.
