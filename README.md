# Domino's stores

Read [my blog post explaining what this is](https://asd.learnlearn.in/districts-without-dominos/)

To run,

```bash
git clone https://gitlab.com/asdofindia/dominos-districts.git
cd dominos-districts
curl -L https://raw.githubusercontent.com/geohacker/india/master/district/india_district.geojson -o districts.geojson
curl -L https://www.dominos.co.in/store-locations/sitemap_store.xml -o sitemap_store.xml
npm install
node process.js
```

See `answer.json` for the answers