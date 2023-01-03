// Native Node modules
const fs = require("fs");

// Third party dependencies
const core = require("@actions/core");

// Local dependencies
const createToot = require("./create-toot.js");

const processFeed = async (feedUrl) => {
  // Get Action parameters
  const mastodonInstance = core.getInput("mastodonInstance", {
    required: true,
  });
  const allowMultipleToots = core.getBooleanInput("allowMultipleToots");
  const minutesBetweenTootsForSameItem = core.getInput(
    "minutesBetweenTootsForSameItem"
  );
  const cacheFile = core.getInput("cacheFile");
  const cacheTimestampFile = core.getInput("cacheTimestampFile");

  // Get values from existing caches
  const jsonCache = require(cacheFile);
  const jsonTimestamp = require(cacheTimestampFile);

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
      // Initialize lastTootTimestamp for items already with some toots
      if (lastTootTimestamp === undefined && existingToots.length > 0) {
        lastTootTimestamp = Date.now();
      }
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
      (allowMultipleToots &&
        Date.now() <
          jsonCache[item.url].lastTootTimestamp +
            minutesBetweenTootsForSameItem * 60 * 1000)
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
      jsonTimestamp.timestamp = Date.now();

      fs.writeFileSync(cacheFile, JSON.stringify(jsonCache, null, 2), {
        encoding: "utf8",
      });
      fs.writeFileSync(
        cacheTimestampFile,
        JSON.stringify(jsonTimestamp, null, 2),
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
