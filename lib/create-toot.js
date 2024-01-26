// Native Node modules
const path = require("node:path");
const { createReadStream, unlink } = require("fs");
const { tmpdir } = require("os");
const { randomUUID } = require("crypto");

// Third party dependencies
const {
  warning,
  debug,
  getInput,
  getBooleanInput,
} = require("@actions/core");
const { login } = require("masto");

// Local dependencies
const download = require("./download.js");

const createToot = async (tootData) => {
  // Get Action parameters
  const mastodonInstance = getInput("mastodonInstance", {
    required: true,
  });
  const mastodonToken = getInput("mastodonToken", { required: true });
  const testMode = getBooleanInput("testMode");
  const tootVisibility = getInput("tootVisibility");
  const instanceType = getInput("instanceType");

  debug(`testMode: ${testMode}`);
  debug(`tootVisibility: ${tootVisibility}`);

  if (testMode) {
    warning("Running in test mode: @ will be replaced by $ in toot content.");
  }

  try {
    // Connect to Mastodon without checking the version
    debug(`Connecting to ${mastodonInstance}`);
    const MastodonClient = await login({
      url: mastodonInstance,
      accessToken: mastodonToken,
      disableVersionCheck: true,
    });

    // Create toot object, with safeguard for tests
    let toot = {
      status: testMode
        ? tootData.content_text.replaceAll("@", "$")
        : tootData.content_text,
      language: tootData.language,
    };
    if (instanceType !== "pixelfed") {
      // Pixelfed API doesn't support the visibility parameter
      toot.visibility = tootVisibility;
    }

    debug(`Toot object:
${JSON.stringify(toot, null, 2)}
`);

    // Check if there's at least one image attachment
    if (
      Object.prototype.hasOwnProperty.call(tootData, "attachments") &&
      tootData.attachments.length > 0
    ) {
      debug(`tootData.attachments:
${JSON.stringify(tootData.attachments, null, 2)}
`);

      let imagesAttachments = tootData.attachments.filter((attachment) =>
        // Only keep images
        attachment.mime_type.match("image/")
      );
      if (imagesAttachments.length > 0) {
        debug(`imagesAttachments:
${JSON.stringify(imagesAttachments, null, 2)}
`);

        let uploadedImages = await Promise.all(
          imagesAttachments.map(async (attachment) => {
            let imageFile = path.join(tmpdir(), `image-${randomUUID()}`);
            try {
              debug(`Downloading ${attachment.url} to ${imageFile}`);

              // Download the image file
              await download(attachment.url, imageFile);
            } catch (error) {
              debug(`Error:
${JSON.stringify(error, null, 2)}
`);
              throw new Error(
                `Error while trying to download ${attachment.url}: ${error.message}`
              );
            }

            let media;
            try {
              debug(`Uploading ${imageFile} to Mastodon`);

              media = await MastodonClient.mediaAttachments.create({
                file: createReadStream(imageFile),
                description: attachment._alt_text || attachment.title || "",
              });
              // Remove the temporary local copy
              await unlink(imageFile, () => {
                // console.log(`${imageFile} deleted.`);
              });
              return media.id;
            } catch (error) {
              debug(`Error:
        ${JSON.stringify(error, null, 2)}
        `);
              throw new Error(
                `Error while trying to upload attachment ${attachment.url} to Mastodon: ${error.message}`
              );
            }
          })
        );

        debug(`uploadedImages: ${JSON.stringify(uploadedImages, null, 2)}`);

        toot.mediaIds = uploadedImages;
      }
    }

    debug(`Creating toot on Mastodon:
${JSON.stringify(toot, null, 2)}
`);
    const tootResult = await MastodonClient.statuses.create(toot);

    return tootResult && tootResult.uri;
  } catch (error) {
    debug(`Error:
${JSON.stringify(error, null, 2)}
`);
    throw new Error(error);
  }
};

module.exports = createToot;
