// Native Node modules
const path = require("node:path");
const { createReadStream, unlink } = require("fs");
const { tmpdir } = require("os");
const { randomUUID } = require("crypto");

// Third party dependencies
const { warning, getInput, getBooleanInput } = require("@actions/core");
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

  if (testMode) {
    warning("Running in test mode");
  }

  try {
    // Connect to Mastodon without checking the version
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
      visibility: "public",
      language: tootData.language,
    };

    // Check if there's at least one image attachment
    if (
      Object.prototype.hasOwnProperty.call(tootData, "attachments") &&
      tootData.attachments.length > 0
    ) {
      let imagesAttachments = tootData.attachments.filter((attachment) =>
        // Only keep images
        attachment.mime_type.match("image/")
      );
      if (imagesAttachments.length > 0) {
        let uploadedImages = await Promise.all(
          imagesAttachments.map(async (attachment) => {
            let imageFile = path.join(tmpdir(), `image-${randomUUID()}`);
            try {
              // Download the image file
              await download(attachment.url, imageFile);
            } catch (error) {
              throw new Error(
                `Error while trying to download ${attachment.url}: ${error.message}`
              );
            }

            let media;
            try {
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

        toot.mediaIds = uploadedImages;
      }
    }

    const tootResult = await MastodonClient.statuses.create(toot);

    return tootResult && tootResult.uri;
  } catch (error) {
    throw new Error(error);
  }
};

module.exports = createToot;
