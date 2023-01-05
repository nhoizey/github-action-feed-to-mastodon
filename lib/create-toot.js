// Native Node modules
const path = require("node:path");
const { createReadStream, unlink } = require("fs");
const { tmpdir } = require("os");
const { randomUUID } = require("crypto");

// Third party dependencies
const { notice, getInput } = require("@actions/core");
const { login } = require("masto");

// Local dependencies
const download = require("./download.js");

const createToot = async (tootData) => {
  // Get Action parameters
  const mastodonInstance = getInput("mastodonInstance", {
    required: true,
  });
  const mastodonToken = getInput("mastodonToken", { required: true });

  // Helper Function to return unknown errors
  const handleError = (error) => {
    const code = Array.isArray(error) ? error[0].code : error.code;
    const msg = Array.isArray(error) ? error[0].message : error.message;
    process.exitCode = 1;
    // TODO: no need to return?
    return status(code, String(msg));
  };

  // Helper Function to return function status
  const status = (code, msg) => {
    notice(`[${code}] ${msg}`);
    // TODO: no need to return
    return {
      statusCode: code,
      body: msg,
    };
  };

  try {
    // Connect to Mastodon
    const MastodonClient = await login({
      url: mastodonInstance,
      accessToken: mastodonToken,
    });

    let toot = {
      status: tootData.content_text,
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
            } catch (e) {
              handleError(e.message);
            }

            let media;
            try {
              media = await MastodonClient.mediaAttachments.create({
                file: createReadStream(imageFile),
                description: attachment.title,
              });
              // Remove the temporary local copy
              await unlink(imageFile, () => {
                // console.log(`${imageFile} deleted.`);
              });
              return media.id;
            } catch (error) {
              handleError(error);
            }
          })
        );

        toot.mediaIds = uploadedImages;
      }
    }

    const tootResult = await MastodonClient.statuses.create(toot);

    return tootResult && tootResult.uri;
  } catch (error) {
    return handleError(error);
  }
};

module.exports = createToot;
