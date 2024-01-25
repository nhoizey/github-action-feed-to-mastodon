// Native Node modules
const path = require("node:path");
const { createReadStream, unlink } = require("fs");
const { tmpdir } = require("os");
const { randomUUID } = require("crypto");

// Third party dependencies
const { warning, info, getInput, getBooleanInput } = require("@actions/core");
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
  const tootVisibility = getInput("tootVisiblity");
  const debugMode = getBooleanInput("debugMode");

  if (debugMode) {
    info(`[DEBUG] testMode: ${testMode}`);
    info(`[DEBUG] tootVisibility: ${tootVisibility}`);
    info(`[DEBUG] debugMode: ${debugMode}`);
  }

  if (testMode) {
    warning("Running in test mode");
  }

  try {
    // Connect to Mastodon without checking the version
    if (debugMode) {
      info(`[DEBUG] Trying to connect to ${mastodonInstance}`);
    }
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
      visibility: tootVisibility,
      language: tootData.language,
    };

    if (debugMode) {
      info(`[DEBUG] Toot object:
${JSON.stringify(toot, null, 2)}
`);
    }

    // Check if there's at least one image attachment
    if (
      Object.prototype.hasOwnProperty.call(tootData, "attachments") &&
      tootData.attachments.length > 0
    ) {
      if (debugMode) {
        info(`[DEBUG] tootData.attachments:
${JSON.stringify(tootData.attachments, null, 2)}
`);
      }

      let imagesAttachments = tootData.attachments.filter((attachment) =>
        // Only keep images
        attachment.mime_type.match("image/")
      );
      if (imagesAttachments.length > 0) {
        if (debugMode) {
          info(`[DEBUG] imagesAttachments:
${JSON.stringify(imagesAttachments, null, 2)}
`);
        }

        let uploadedImages = await Promise.all(
          imagesAttachments.map(async (attachment) => {
            let imageFile = path.join(tmpdir(), `image-${randomUUID()}`);
            try {
              if (debugMode) {
                info(`[DEBUG] Downloading ${attachment.url} to ${imageFile}`);
              }

              // Download the image file
              await download(attachment.url, imageFile);
            } catch (error) {
              throw new Error(
                `Error while trying to download ${attachment.url}: ${error.message}`
              );
            }

            let media;
            try {
              if (debugMode) {
                info(`[DEBUG] Uploading ${imageFile} to Mastodon`);
              }

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
              throw new Error(
                `Error while trying to upload attachment ${attachment.url} to Mastodon: ${error.message}`
              );
            }
          })
        );

        if (debugMode) {
          info(
            `[DEBUG] uploadedImages: ${JSON.stringify(uploadedImages, null, 2)}`
          );
        }

        toot.mediaIds = uploadedImages;
      }
    }

    let tootResult;
    try {
      if (debugMode) {
        info(`[DEBUG] Creating toot on Mastodon`);
      }
      tootResult = await MastodonClient.statuses.create(toot);
    } catch (error) {
      throw new Error(
        `Error while trying to create toot on Mastodon: ${error.message}`
      );
    }

    return tootResult && tootResult.uri;
  } catch (error) {
    throw new Error(error);
  }
};

module.exports = createToot;
