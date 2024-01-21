// Native Node modules
const { existsSync, writeFileSync } = require("fs");
const path = require("node:path");

// Third party dependencies
const { getInput, getBooleanInput, info } = require("@actions/core");
const { mkdirP } = require("@actions/io");
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
  const ignoreFirstRun = getBooleanInput("ignoreFirstRun");
  const logFeedItemContent = getBooleanInput("logFeedItemContent");

  // Compute full paths
  const cacheDirectoryFullPath = path.join(process.cwd(), cacheDirectory);
  const cacheFileFullPath = path.join(cacheDirectoryFullPath, cacheFile);
  const cacheTimestampFileFullPath = path.join(
    cacheDirectoryFullPath,
    cacheTimestampFile
  );

  let tootUrl;
  let tootCreated = false;
  let cacheToSave = false;

  // Get values from existing cache
  let jsonCache = {};
  let firstRunWithIgnoredItems = false;
  if (existsSync(cacheFileFullPath)) {
    jsonCache = require(cacheFileFullPath);
  } else {
    if (ignoreFirstRun) {
      info("Initializing the cache files without creating any toot");
      firstRunWithIgnoredItems = true;
      cacheToSave = true;
    }
  }

  info(`Fetching ${feedUrl} …`);
  const feedContent = await fetch(feedUrl).then((response) => response.json());

  let items = feedContent.items;
  let itemsCount = items.length;
  info(`The feed contains ${itemsCount} item${itemsCount > 1 ? "s" : ""}`);
  const itemsNotTootedRecently = {};

  // Iterate over feed items
  items.forEach((item) => {
    // Fill cache with new items
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
      if (firstRunWithIgnoredItems) {
        jsonCache[item.url].toots.push(
          "Ignored during first run (see `ignoreFirstRun` input)"
        );
        jsonCache[item.url].lastTootTimestamp = Date.now();
      }
    }
    // Fill candidates for toot
    if (
      jsonCache[item.url].lastTootTimestamp === undefined ||
      (nbTootsPerItem > jsonCache[item.url].toots.length &&
        Date.now() >
          jsonCache[item.url].lastTootTimestamp +
            delayTootsSameItem * 60 * 1000)
    ) {
      itemsNotTootedRecently[item.url] = { ...jsonCache[item.url] };
    }
  });

  const itemsNotTootedRecentlyCount = Object.keys(
    itemsNotTootedRecently
  ).length;
  if (itemsNotTootedRecentlyCount === 0) {
    info(`There is no feed item to post`);
  } else {
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

    const itemToPosse =
      candidates[Math.floor(Math.random() * candidates.length)];

    try {
      info(`Creating toot for item "${itemToPosse.title}"`);
      if (logFeedItemContent) {
        info("Item content:");
        info(JSON.stringify(itemToPosse, null, 2));
      }
      tootUrl = await createToot(itemToPosse);
      // TODO: better test?
      if (tootUrl && tootUrl.startsWith(mastodonInstance)) {
        jsonCache[itemToPosse.url].toots.push(tootUrl);
        jsonCache[itemToPosse.url].lastTootTimestamp = Date.now();
        tootCreated = true;
        cacheToSave = true;
      }
    } catch (error) {
      throw new Error(error);
    }
  }

  if (cacheToSave) {
    if (!existsSync(cacheDirectoryFullPath)) {
      info(`Creating cache directory "${cacheDirectoryFullPath}"`);
      await mkdirP(cacheDirectoryFullPath, { recursive: true });
    }
    info("Saving cache files");
    writeFileSync(cacheFileFullPath, JSON.stringify(jsonCache, null, 2), {
      encoding: "utf8",
    });
    writeFileSync(
      cacheTimestampFileFullPath,
      JSON.stringify({ timestamp: Date.now() }, null, 2),
      {
        encoding: "utf8",
      }
    );
  }
  return tootCreated ? tootUrl : false;
};

module.exports = processFeed;
