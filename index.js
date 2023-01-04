// Native Node modules
const fs = require("fs");

// Third party dependencies
const core = require("@actions/core");

// Local dependencies
const processFeed = require("./lib/process-feed");

async function run() {
  try {
    // Get Action parameters
    const feedUrl = core.getInput("feedUrl", { required: true });
    const globalDelayToots = core.getInput("globalDelayToots");
    const cacheTimestampFile = core.getInput("cacheTimestampFile");

    // Get values from existing caches
    let jsonTimestamp = { timestamp: 0 };
    if (fs.existsSync(cacheTimestampFile)) {
      jsonTimestamp = require(cacheTimestampFile);
    }

    if (Date.now() < jsonTimestamp.timestamp + globalDelayToots * 60 * 1000) {
      core.warning(`Too soon…`);
      return;
    }

    const tootUrl = await processFeed(feedUrl);
    if (tootUrl) {
      core.info(`Success! ${tootUrl}`);
    } else {
      core.info("No item to toot");
    }
    core.setOutput("tootUrl", tootUrl);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
