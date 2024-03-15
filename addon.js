const fetch = require("node-fetch");
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const flatCache = require('flat-cache');
const NodeCache = require( "node-cache" );

const MEMORY_CACHE_FILM_SLUGS_ID = 'FILM_SLUGS';
const memoryCache = new NodeCache();
const cache = flatCache.load('ZOE-LETTERBOXD');
console.info('Cache amount: ', Object.keys(cache.all()).length);

const BASE_URI = "https://letterboxd.com";

function toTitleCase(str) {
  return str.replace(/\w\S*/g, function (txt) {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
}

function resolveRelativeUrl(url) {
  if (url.startsWith("/")) {
    return `${BASE_URI}${url}`;
  }

  return url;
}

function getNextPageCount(document) {
  const nextPageLinkElement = document.querySelector(
    ".paginate-nextprev .next"
  );
  if (!nextPageLinkElement) {
    return;
  }

  const { href } = nextPageLinkElement;
  
  if (!href) {
    return;
  }
  
  const parts = href.split('/');
  return parts[parts.length - 2];
}

function getFilter(type) {
  if (type === 'popular') {
    return 'by/popular/';
  }
  
  if (type === 'new') {
    return 'by/release/'
  }
  
  return '';
}

async function getWatchlistPageFilmSlugs(type, pageCount = 1, allFilmSlugs = []) {
  console.info('Getting film slugs. Page count: ', pageCount, ' Amount of slugs: ', allFilmSlugs.length);
  const response = await fetch(
    `https://letterboxd.com/dave/list/official-top-250-narrative-feature-films/page/${pageCount}`
  );
  const body = await response.text();
  const { document } = new JSDOM(body).window;

  const linkedPostersElements = document.querySelectorAll(
    ".linked-film-poster"
  );

  const filmSlugs = [...linkedPostersElements].map((element) => {
    const { filmSlug } = element.dataset;
    return filmSlug;
  });
  
  const newAllFilmSlugs = [...new Set(allFilmSlugs.concat(filmSlugs))];
  
  const nextPageCount = await getNextPageCount(document);
  if (nextPageCount) {
    return await getWatchlistPageFilmSlugs(type, nextPageCount, newAllFilmSlugs);
  }

  return newAllFilmSlugs;
}

async function getFilmPoster(filmSlug) {
  const response = await fetch(
    `https://letterboxd.com/ajax/poster/film/${filmSlug}/hero/230x345/`
  );
  const body = await response.text();
  const { document } = new JSDOM(body).window;
  const imageElement = document.querySelector(".image");
  return imageElement.src;
}

async function getFilmDetails(filmSlug) {
  const response = await fetch(`https://letterboxd.com/film/${filmSlug}`);
  const body = await response.text();
  const { document } = new JSDOM(body).window;

  
  let id = null;
  const imdbLinkElement = document.querySelector('a[href^="http://www.imdb.com"]');
  if (imdbLinkElement) {
    id = imdbLinkElement.href.split("/")[4];
  }  
    
  const name = document.querySelector("#featured-film-header h1").textContent;
  const genres = [...document.querySelectorAll("#tab-genres .text-slug")]
    .filter((element) => {
      return element.href.includes("/genre/");
    })
    .map((element) => {
      return toTitleCase(element.textContent);
    });

  return {
    id,
    name,
    genres,
  };
}

async function getResult(filmSlug) {
  console.info('Getting result for: ', filmSlug);
  
  const cachedResult = cache.getKey(filmSlug);
  
  if (cachedResult) {
    console.log('Got cached for: ', filmSlug);
    return cachedResult;
  }

  console.log('Getting fresh result for: ', filmSlug);
  
  const poster = await getFilmPoster(filmSlug);
  const details = await getFilmDetails(filmSlug);

  const result = {
    type: 'movie',
    ...details,
    poster,
  }
  
  console.log('Caching: ', filmSlug);
  cache.setKey(filmSlug, result);
  cache.save(true);
  
  return result;
}

async function getFilmSlugs(type) {
  const key = `${MEMORY_CACHE_FILM_SLUGS_ID}_${type.toUpperCase()}`;
  const cachedFilmSlugs = memoryCache.get(key);
  
  if (cachedFilmSlugs) {
    console.info('Cached slugs...')
    return cachedFilmSlugs;
  }
  
  console.info('Getting new film slugs...');  
  const filmSlugs = await getWatchlistPageFilmSlugs(type);
  
  console.info('Caching new film slugs...');
  memoryCache.set(key, filmSlugs);
  
  return filmSlugs;  
}

async function main(type) {
  console.info('Cache amount: ', Object.keys(cache.all()).length);
  
  const filmSlugs = await getFilmSlugs(type);
  const results = await Promise.all(filmSlugs.map(getResult));
  
  return results;
}

module.exports = main;
