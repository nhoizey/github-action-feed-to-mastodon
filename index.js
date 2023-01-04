// Native Node modules
const fs = require("fs");

// Third party dependencies
const {
  getInput,
  notice,
  warning,
  setOutput,
  setFailed,
} = require("@actions/core");

// Local dependencies
const processFeed = require("./lib/process-feed");

async function run() {
  try {
    // Get Action parameters
    const feedUrl = getInput("feedUrl", { required: true });
    const globalDelayToots = getInput("globalDelayToots");
    const cacheTimestampFile = getInput("cacheTimestampFile");

    // Get values from existing caches
    let jsonTimestamp = { timestamp: 0 };
    if (fs.existsSync(cacheTimestampFile)) {
      jsonTimestamp = require(cacheTimestampFile);
      notice(`Previous attempt: ${jsonTimestamp.timestamp}`);
    } else {
      warning("No cache found.");
    }

    if (Date.now() < jsonTimestamp.timestamp + globalDelayToots * 60 * 1000) {
      warning(`Too soon…`);
      return;
    }

    const tootUrl = await processFeed(feedUrl);
    if (tootUrl) {
      notice(`Success! ${tootUrl}`);
    } else {
      notice("No item to toot");
    }
    setOutput("tootUrl", tootUrl);
  } catch (error) {
    setFailed(error.message);
  }
}

run();
