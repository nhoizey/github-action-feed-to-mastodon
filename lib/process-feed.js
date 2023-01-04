// Native Node modules
const fs = require("fs");

// Third party dependencies
const core = require("@actions/core");
const fetch = require("node-fetch");

// Local dependencies
const createToot = require("./create-toot.js");

const processFeed = async (feedUrl) => {
  // Get Action parameters
  const mastodonInstance = core.getInput("mastodonInstance", {
    required: true,
  });
  const nbTootsPerItem = core.getInput("nbTootsPerItem");
  const delayTootsSameItem = core.getInput("delayTootsSameItem");
  const cacheFile = core.getInput("cacheFile");
  const cacheTimestampFile = core.getInput("cacheTimestampFile");

  // Get values from existing cache
  let jsonCache = {};
  if (fs.existsSync(cacheFile)) {
    jsonCache = require(cacheFile);
  }

  core.info(`Fetching ${feedUrl} …`);
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
    core.info(`Attempting to create toot "${itemToPosse.title}"`);
    const tootUrl = await createToot(itemToPosse);
    // TODO: better test?
    if (tootUrl && tootUrl.startsWith(mastodonInstance)) {
      jsonCache[itemToPosse.url].toots.push(tootUrl);
      jsonCache[itemToPosse.url].lastTootTimestamp = Date.now();

      fs.writeFileSync(cacheFile, JSON.stringify(jsonCache, null, 2), {
        encoding: "utf8",
      });
      fs.writeFileSync(
        cacheTimestampFile,
        JSON.stringify({ timestamp: Date.now() }, null, 2),
        {
          encoding: "utf8",
        }
      );
    }
  } catch (error) {
    throw new Error(error);
  }
};

module.exports = processFeed;
