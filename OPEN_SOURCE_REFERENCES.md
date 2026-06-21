# Open Source References

This prototype intentionally starts from established open-source globe work instead of a hand-rolled canvas effect.

- `vasturiano/three-globe`: Three.js globe object, examples for real Earth texture, clouds, day/night, satellites, and tiled map engine.
  https://github.com/vasturiano/three-globe
- `vasturiano/globe.gl`: higher-level wrapper around `three-globe`, useful for future data layers and interactions.
  https://github.com/vasturiano/globe.gl
- Earth texture and topology images were downloaded from the public `three-globe` example assets to `assets/` for local rendering stability.
  https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg
  https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-topology.png
- Cloud layer follows the `three-globe/example/clouds` pattern and uses its cloud texture locally.
  https://github.com/vasturiano/three-globe/tree/master/example/clouds

## Population Baseline

- World Bank API, WLD `SP.POP.TOTL`, used as the first MVP population baseline. The UI presents this as an estimate, not exact live census data.
  https://api.worldbank.org/v2/country/WLD/indicator/SP.POP.TOTL?format=json
