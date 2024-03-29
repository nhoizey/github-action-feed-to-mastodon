// Native Node modules
const { existsSync, writeFileSync } = require("fs");
const path = require("node:path");

// Third party dependencies
const {
  getInput,
  getBooleanInput,
  info,
  debug,
  isDebug,
  startGroup,
  endGroup,
} = require("@actions/core");
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
  const itemChoiceStrategy = getInput("itemChoiceStrategy");
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

  debug(`mastodonInstance: ${mastodonInstance}`);
  debug(`nbTootsPerItem: ${nbTootsPerItem}`);
  debug(`delayTootsSameItem: ${delayTootsSameItem}`);
  debug(`itemChoiceStrategy: ${itemChoiceStrategy}`);
  debug(`cacheDirectory: ${cacheDirectory}`);
  debug(`cacheFile: ${cacheFile}`);
  debug(`cacheTimestampFile: ${cacheTimestampFile}`);
  debug(`ignoreFirstRun: ${ignoreFirstRun}`);
  debug(`logFeedItemContent: ${logFeedItemContent}`);
  debug(`cacheDirectoryFullPath: ${cacheDirectoryFullPath}`);
  debug(`cacheFileFullPath: ${cacheFileFullPath}`);
  debug(`cacheTimestampFileFullPath: ${cacheTimestampFileFullPath}`);

  let tootUrl;
  let tootCreated = false;
  let cacheToSave = false;

  // Get values from existing cache
  let jsonCache = {};
  let firstRunWithIgnoredItems = false;
  if (existsSync(cacheFileFullPath)) {
    jsonCache = require(cacheFileFullPath);
    if (isDebug()) {
      startGroup("jsonCache");
      debug(JSON.stringify(jsonCache, null, 2));
      endGroup();
    }
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

  const availableToots = {};

  // Iterate over feed items
  items.forEach((item) => {
    // Fill cache with new items
    if (Object.prototype.hasOwnProperty.call(jsonCache, item.url)) {
      // This is an existing item

      // Get existing toots for this item
      const existingToots = [...jsonCache[item.url].toots];

      // Get last toot timestamp for this item
      let lastTootTimestamp = jsonCache[item.url].lastTootTimestamp;

      // Update cached item content with content from the feed
      jsonCache[item.url] = item;

      // Restore existing toots
      jsonCache[item.url].toots = existingToots;

      // Restore last toot timestamp
      jsonCache[item.url].lastTootTimestamp = lastTootTimestamp;
    } else {
      // This is a new item

      // Fill cache with new item
      jsonCache[item.url] = item;

      // Initialize toots for this item
      jsonCache[item.url].toots = [];

      if (firstRunWithIgnoredItems) {
        // This is the first run (no cache found) and we want to ignore this item
        jsonCache[item.url].toots.push(
          "Assuming this item as already been shared before automation (see `ignoreFirstRun` input)"
        );

        // Ignore this item for the first run by setting the last toot timestamp to now
        jsonCache[item.url].lastTootTimestamp = Date.now();
      }
    }

    // Fill candidates for toot
    if (!firstRunWithIgnoredItems) {
      // This is not a first run with ignored items

      const neverBeenTooted =
        jsonCache[item.url].toots.length === 0 ||
        jsonCache[item.url].lastTootTimestamp === undefined;

      const notTootedEnough = nbTootsPerItem > jsonCache[item.url].toots.length;

      const notTootedTooRecently =
        Date.now() >
        jsonCache[item.url].lastTootTimestamp + delayTootsSameItem * 60 * 1000;

      if (neverBeenTooted || (notTootedEnough && notTootedTooRecently)) {
        availableToots[item.url] = { ...jsonCache[item.url] };
      }
    }
  });

  const itemsNotTootedRecentlyCount = Object.keys(availableToots).length;
  if (itemsNotTootedRecentlyCount === 0) {
    info(
      firstRunWithIgnoredItems
        ? "Items from the feed are ignored for this first run (see `ignoreFirstRun` input)"
        : "There is no feed item to post"
    );
  } else {
    // Get lowest number of toots for any item
    let minTimes = -1;
    const itemsPerTimes = {};
    for (const itemUrl in availableToots) {
      const itemTimes = availableToots[itemUrl].toots.length;
      minTimes = minTimes === -1 ? itemTimes : Math.min(minTimes, itemTimes);
      if (!Object.prototype.hasOwnProperty.call(itemsPerTimes, itemTimes)) {
        itemsPerTimes[itemTimes] = [];
      }
      itemsPerTimes[itemTimes].push(availableToots[itemUrl]);
    }

    // Keep only recent items that have been POSSEd the less, and sort them by last toot timestamp, the most recent first
    const candidates = itemsPerTimes[minTimes].sort(
      (a, b) => Date.parse(b.date_published) - Date.parse(a.date_published)
    );

    const candidatesCount = candidates.length;

    if (isDebug()) {
      startGroup(`${candidatesCount} candidates`);
      debug(JSON.stringify(candidates, null, 2));
      endGroup();
    }

    let itemToPosse;
    switch (itemChoiceStrategy) {
      case "oldest":
        itemToPosse = candidates[candidatesCount - 1];
        break;
      case "newest":
      case "latest":
        itemToPosse = candidates[0];
        break;
      case "random":
        itemToPosse = candidates[Math.floor(Math.random() * candidatesCount)];
        break;
      default:
        throw new Error(
          `Wrong value for "itemChoiceStrategy": ${itemChoiceStrategy}`
        );
    }

    try {
      info(`Creating toot for item "${itemToPosse.title}"`);
      if (logFeedItemContent || isDebug()) {
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
