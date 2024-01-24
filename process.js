const xml2js = require('xml2js');
const fs = require('fs');
var crypto = require('crypto')
const turf = require('@turf/turf')

const getHash = (key) => {
    const shasum = crypto.createHash('sha1')
    shasum.update(key)
    return shasum.digest('hex')
}

const getPath = (key) => {
    const hash = getHash(key);
    return `downloads/${hash}`;
}

const putCache = (key, data) => {
    const path = getPath(key)
    fs.writeFileSync(`${path}.key`, key)
    return fs.writeFileSync(path, data);
}

const getCache = (key) => {
    try {
        const path = getPath(key);
        return fs.readFileSync(path, 'utf-8');
    } catch {
        return undefined
    }
}


function matchPointsToPolygons(pointsGeoJSON, polygonsGeoJSON) {
    // Check for valid input
    if (!pointsGeoJSON || !polygonsGeoJSON || !pointsGeoJSON.features || !polygonsGeoJSON.features) {
        throw new Error("Invalid GeoJSON input");
    }

    // Convert features to turf FeatureCollections
    const pointsCollection = turf.featureCollection(pointsGeoJSON.features);
    const polygonsCollection = turf.featureCollection(polygonsGeoJSON.features);

    // Initialize an empty map for point counts
    const pointCountsMap = {};
    let unmatched = 0;

    // Match each point to a polygon by iterating through points
    for (const point of pointsCollection.features) {
        let matchingPolygon;

        // Find the first polygon containing the point using turf.within
        matchingPolygon = polygonsCollection.features.find((polygon) => turf.booleanPointInPolygon(point, polygon));

        // Add point count to corresponding polygon in the map
        if (matchingPolygon) {
            if (!pointCountsMap[matchingPolygon.properties['ID_2']]) {
                pointCountsMap[matchingPolygon.properties['ID_2']] = 0;
            }
            pointCountsMap[matchingPolygon.properties['ID_2']]++;
        } else {
            unmatched += 1;
        }
    }

    console.error(`Total unmatched stores: ${unmatched}`);
    // Return the map with point counts per polygon
    return pointCountsMap;
}

const findAnswer = (pointsGeoJSON, polygonsGeoJSON) => {
    const map = matchPointsToPolygons(pointsGeoJSON, polygonsGeoJSON);
    const districts = [];
    const polygonsCollection = turf.featureCollection(polygonsGeoJSON.features);
    polygonsCollection.features.forEach(p => {
        const id = p?.properties?.['ID_2'];
        if (!id) return;
        districts.push({
            sno: 0,
            name: p?.properties?.['NAME_2'],
            state: p?.properties?.['NAME_1'],
            count: map[id] ?? 0,
        })
    })
    districts.sort((a, b) => a.count - b.count);
    for (let i = 0; i < districts.length; i++) {
        districts[i]["sno"] = i + 1;
    }
    return districts;
}

const data = [];

const process = (url, t) => {
    try {
        const latLng = t.split("var position = new google.maps.LatLng(")[1].split(')')[0];
        return data.push({
            latLng,
            url
        })
    } catch {
        console.error(`Error in ${url}`)
    }
}

const convertToGeojson = (points) => {
    const skeleton = {
        "type": "FeatureCollection",
        "features": [
        ]
    }
    points.forEach(({ latLng, url }) => {

        const split = latLng.split(', ');
        const long = parseFloat(split[1]);
        const lat = parseFloat(split[0]);
        skeleton.features.push({
            "type": "Feature",
            "geometry": { "type": "Point", "coordinates": [long, lat] },
            "properties": { url },
        })
    });
    return skeleton;
}

const storeReader = (err, result) => {
    const urls = result['urlset']['url'].map(u => u['loc'][0])
    queue(urls,
        async (url) => {
            console.log(`Getting ${url}`);
            const cached = getCache(url);
            if (cached) return process(url, cached);
            return fetch(url).then((res) => {
                return res.text().then((t) => {
                    putCache(url, t);
                    return process(url, t);
                })
            })
        }, () => {
            const geojson = convertToGeojson(data);
            // fs.writeFileSync('data.geojson', JSON.stringify(geojson, null, 2));
            const districts = JSON.parse(fs.readFileSync('districts.geojson', 'utf-8'));
            const answer = findAnswer(geojson, districts);
            fs.writeFileSync('answer.json', JSON.stringify(answer, null, 2));
        });
}

const queue = (urls, processor, done) => {
    const concurrency = 2;
    let currentJobsCount = 0;
    let jobs = urls;
    const start = () => {
        if (currentJobsCount >= concurrency) return;
        const job = jobs.shift();
        if (job === undefined) return;
        currentJobsCount++;
        processor(job).then((res) => {
            currentJobsCount--;
            if (jobs.length > 0) return start();
            if (currentJobsCount === 0) done();
        });
        start();
    }
    start();
}

const storeXML = fs.readFileSync('sitemap_store.xml', 'utf-8');
xml2js.parseString(storeXML, storeReader)

