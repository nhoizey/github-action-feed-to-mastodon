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
    // const mastodonInstance = core.getInput("mastodonInstance", { required: true });
    // const mastodonToken = core.getInput("mastodonToken", { required: true });
    const globalDelayToots = core.getInput("globalDelayToots");
    const cacheTimestampFile = core.getInput("cacheTimestampFile");

    // Check if required parameters are set
    // if (feedUrl === undefined || feedUrl === "") {
    //   throw new Error("The 'feedUrl' parameter is required");
    // }
    // if (mastodonInstance === undefined || mastodonInstance === "") {
    //   throw new Error("The 'mastodonInstance' parameter is required");
    // }
    // if (mastodonToken === undefined || mastodonToken === "") {
    //   throw new Error("The 'mastodonToken' parameter is required");
    // }
    // if (githubToken === undefined || githubToken === "") {
    //   throw new Error("The 'githubToken' parameter is required");
    // }

    // Get values from existing caches
    let jsonTimestamp = { timestamp: 0 };
    if (fs.existsSync(cacheTimestampFile)) {
      jsonTimestamp = require(cacheTimestampFile);
    }

    if (Date.now() < jsonTimestamp.timestamp + globalDelayToots * 60 * 1000) {
      core.info(`Too soon…`);
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
