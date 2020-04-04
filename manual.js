const fs = require("fs");
const path = require("path");
const parse = require("csv-parse/lib/sync");


// const WORKSPACE = process.env.GITHUB_WORKSPACE;
const WORKSPACE = "COVID-19-BASE"
const DATA_REPO = "data"; // from main.yml checkout action path
const MAIN_REPO = "main"; // from main.yml checkout action path
const FILENAME_CONFIRMED = "time_series_covid19_confirmed_global.csv";
const FILENAME_DEATHS = "time_series_covid19_deaths_global.csv";
const FILENAME_RECOVERED = "time_series_covid19_recovered_global.csv";

const dataPath = path.join(
  WORKSPACE,
  //DATA_REPO,
  "csse_covid_19_data",
  "csse_covid_19_time_series"
);
const countryOutputPath = path.join( "docs", "country-timeseries.json");
const provinceOutputPath = path.join("docs", "can-provinces.json");

function extract(filename) {
  const csv = fs.readFileSync(path.resolve(dataPath, filename));
  const [headers, ...rows] = parse(csv);
  const [province, country, lat, long, ...dates] = headers;
  const countryCounts = {};
  const provinceCounts = {};
  const thisCountry = 'Canada'
  rows.forEach(([province, country, lat, long, ...counts]) => {
    // if country hasn't been added to countryCounts, add empty obj
    //console.log(country, countryCounts[country])
    countryCounts[country] = countryCounts[country] || {mainData: {} };
    // if profince is truthy, add now
    if (province) {
      countryCounts[country].Provinces = countryCounts[country]["Provinces"] || {}
      //console.log(country)
      countryCounts[country]["Provinces"][province] = {}
      countryCounts[country]["Provinces"][province].lat = lat
      countryCounts[country]["Provinces"][province].long = long
    }
    else {
      countryCounts[country].lat = lat
      countryCounts[country].long = long
    }      
    dates.forEach((date, i) => {
      countryCounts[country].mainData[date] = countryCounts[country].mainData[date] || 0;
      countryCounts[country].mainData[date] += +counts[i];
      if (province) {
        countryCounts[country]["Provinces"][province][date] = counts[i];
      }
    });
  });
  return [countryCounts, dates];
}

function buildSeries (dates, confirmed, deaths, recovered) {
  //console.log(confirmed['3/16/20'])
  //console.log(dates)
  return dates.map(date => {
    const [month, day] = date.split("/");
    
    return {
      date: `2020-${month}-${day}`,
      confirmed: confirmed && confirmed.hasOwnProperty(date) ? confirmed[date] : null,
      deaths: deaths && deaths.hasOwnProperty(date) ? deaths[date] : null,
      recovered: recovered && recovered.hasOwnProperty(date) ? recovered[date] : null
    };
  });
}

const [confirmed, dates] = extract(FILENAME_CONFIRMED);
const [deaths] = extract(FILENAME_DEATHS);
const [recovered] = extract(FILENAME_RECOVERED);
const countries = Object.keys(confirmed);

const mainResults = {};
const provSeries = {};
countries.forEach(country => {
  const lat = confirmed[country].lat,
      long = confirmed[country].long,
      c = confirmed[country].mainData,
      d = deaths[country].mainData,
      r = recovered[country].mainData;
  mainResults[country] = {
    lat, 
    long,
    data: buildSeries(dates, c, d, r)
  };
  if (confirmed[country].Provinces) {
    provSeries[country] = {}
    const provinces = Object.keys(confirmed[country].Provinces)
    
    if (provinces.length) {
      if (!mainResults[country].provinces) {
        mainResults[country].provinces = {}
      }
      
      for (p of provinces) {
        const dp = deaths[country].Provinces ? deaths[country].Provinces[p] : null
        const cp = confirmed[country].Provinces ? confirmed[country].Provinces[p] : null
        const rp = recovered[country].Provinces ? recovered[country].Provinces[p] : null
        provSeries[country][p] = {
          lat: p.lat,
          long: p.long,
          data: buildSeries(dates, cp, dp, rp)
        }
        mainResults[country].provinces[p] = provSeries[country][p]
      }
      console.log(country)
      console.log(mainResults[country])
    }
  }
});

fs.writeFileSync(countryOutputPath, JSON.stringify(mainResults, null, 2));

const byProvince = Object.keys(provSeries);
byProvince.forEach (ctry => {
  const thisPath = path.join("docs", `provinces-${ctry}.json`);
  fs.writeFileSync(thisPath, JSON.stringify(provSeries[ctry], null, 2))
})
