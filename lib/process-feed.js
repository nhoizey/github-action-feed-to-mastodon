// Native Node modules
const fs = require("fs");
const path = require("node:path");

// Third party dependencies
const { getInput, notice } = require("@actions/core");
const { context } = require("@actions/github");
const fetch = require("node-fetch");

// Local dependencies
const createToot = require("./create-toot.js");

const processFeed = async (feedUrl) => {
  // Get Action parameters
  const mastodonInstance = getInput("mastodonInstance", {
    required: true,
  });
  const nbTootsPerItem = getInput("nbTootsPerItem");
  const delayTootsSameItem = getInput("delayTootsSameItem");
  const cacheDirectory = getInput("cacheDirectory");
  const cacheFile = getInput("cacheFile");
  const cacheTimestampFile = getInput("cacheTimestampFile");

  // Get values from existing cache
  let jsonCache = {};
  if (fs.existsSync(path.join(cacheDirectory, cacheFile))) {
    jsonCache = require(path.join(cacheDirectory, cacheFile));
  }

  notice(`Fetching ${feedUrl} …`);
  const feedContent = await fetch(feedUrl).then((response) => response.json());

  let items = feedContent.items;
  const itemsNotTootedRecently = {};

  // Iterate over feed items
  items.forEach((item) => {
    // Fill cache with new items
    // TODO: remove items from cache that are not anymore in the feed
    if (Object.prototype.hasOwnProperty.call(jsonCache, item.url)) {
      const existingToots = [...jsonCache[item.url].toots];
      let lastTootTimestamp = jsonCache[item.url].lastTootTimestamp;
      // Update item content
      jsonCache[item.url] = item;
      // Restore existing toots
      jsonCache[item.url].toots = existingToots;
      jsonCache[item.url].lastTootTimestamp = lastTootTimestamp;
    } else {
      // This is a new item
      jsonCache[item.url] = item;
      jsonCache[item.url].toots = [];
    }
    // Fill candidates for toot
    if (
      jsonCache[item.url].lastTootTimestamp === undefined ||
      (nbTootsPerItem > jsonCache[item.url].toots.length &&
        Date.now() <
          jsonCache[item.url].lastTootTimestamp +
            delayTootsSameItem * 60 * 1000)
    ) {
      itemsNotTootedRecently[item.url] = { ...jsonCache[item.url] };
    }
  });

  if (Object.keys(itemsNotTootedRecently).length === 0) {
    return false;
  }

  // Get lowest number of toots for any item
  let minTimes = -1;
  const itemsPerTimes = {};
  for (const itemUrl in itemsNotTootedRecently) {
    const itemTimes = itemsNotTootedRecently[itemUrl].toots.length;
    minTimes = minTimes === -1 ? itemTimes : Math.min(minTimes, itemTimes);
    if (!Object.prototype.hasOwnProperty.call(itemsPerTimes, itemTimes)) {
      itemsPerTimes[itemTimes] = [];
    }
    itemsPerTimes[itemTimes].push(itemsNotTootedRecently[itemUrl]);
  }

  // Keep only recent items that have been POSSEd the less
  const candidates = itemsPerTimes[minTimes];

  const itemToPosse = candidates[Math.floor(Math.random() * candidates.length)];

  try {
    notice(`Attempting to create toot for item "${itemToPosse.title}"`);
    const tootUrl = await createToot(itemToPosse);
    // TODO: better test?
    if (tootUrl && tootUrl.startsWith(mastodonInstance)) {
      jsonCache[itemToPosse.url].toots.push(tootUrl);
      jsonCache[itemToPosse.url].lastTootTimestamp = Date.now();

      notice(JSON.stringify(context.payload.repository, null, 2));
      notice(`Currently running in ${process.cwd()}`);
      notice(`Currently in ${__dirname}`);

      const cacheDirectoryFullPath = path.join(process.cwd(), cacheDirectory);
      if (!fs.existsSync(cacheDirectoryFullPath)) {
        notice(`Creating ${cacheDirectory}`);
        fs.mkdirSync(cacheDirectoryFullPath, { recursive: true });
      }
      fs.writeFileSync(
        path.join(cacheDirectoryFullPath, cacheFile),
        JSON.stringify(jsonCache, null, 2),
        {
          encoding: "utf8",
        }
      );
      fs.writeFileSync(
        path.join(cacheDirectoryFullPath, cacheTimestampFile),
        JSON.stringify({ timestamp: Date.now() }, null, 2),
        {
          encoding: "utf8",
        }
      );
      return tootUrl;
    }
  } catch (error) {
    throw new Error(error);
  }
};

module.exports = processFeed;
