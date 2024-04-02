# GitHub Action: Any feed to Mastodon

[![GitHub stars](https://img.shields.io/github/stars/nhoizey/github-action-feed-to-mastodon.svg?style=for-the-badge&logo=github)](https://github.com/nhoizey/github-action-feed-to-mastodon/stargazers)
[![Follow @nhoizey@mamot.fr](https://img.shields.io/mastodon/follow/000262395?domain=https%3A%2F%2Fmamot.fr&style=for-the-badge&logo=mastodon&logoColor=white&color=6364FF)](https://mamot.fr/@nhoizey)

A GitHub Action that creates messages (toots) on your Mastodon account from a RSS/Atom/JSON feed's items.

This should be a simple way to POSSE — [Publish (on your) Own Site, Syndicate Elsewhere](https://indieweb.org/POSSE) — content from your blog to your Mastodon account.

> [!NOTE]
> It currently supports [JSON Feed](https://www.jsonfeed.org/), with [support for RSS and Atom planned](https://github.com/nhoizey/github-action-feed-to-mastodon/issues/16).

## Example usage

I recommend to try first with an action requiring a manual action with [the `workflow_dispatch` event](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#workflow_dispatch), and set `testMode: true`, to test the settings.

Here's a minimal version, with only required inputs:

```yaml
name: Create toots from feed items
on:
  workflow_dispatch:

jobs:
  Feed2Mastodon:
    runs-on: ubuntu-latest

    steps:
      # Checkout the repository to restore previous cache
      - name: Checkout
        uses: actions/checkout@v3

      # Look for new toots to create from items in the JSON feed
      - name: Feed to Mastodon
        uses: nhoizey/github-action-feed-to-mastodon@v2
        with:
          feedUrl: "https://example.com/feed.json"
          mastodonInstance: "https://mastodon.social"
          mastodonToken: ${{ secrets.MASTODON_TOKEN }}
          testMode: true

      # Make sure files are up to date if other commits have been pushed in the mean time
      - name: Pull any changes from Git
        run: git pull

      # Push changes in the cache files to the repository
      # See https://github.com/stefanzweifel/git-auto-commit-action#readme
      - name: Commit and push
        uses: stefanzweifel/git-auto-commit-action@v4
```

You can then enhance your action with [the `schedule` event](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#schedule), for example to automate creation of a toot every Monday at 8am (Crontab Guru: <https://crontab.guru/#0_8_*_*_1>).

Replace:

```yaml
on:
  workflow_dispatch:
```

With:

```yaml
on:
  schedule:
    - cron: "0 8 * * 1"
```

When everything works perfectly, you can remove the `testMode` input, or set it to `false`.

## Settings ("Inputs" in GitHub Action language)

There are 3 required **inputs**, used in the examples above, but also some optional inputs — with default values — to fine tune when and how toots are created:

| input                | required? |                             default | description                                                                                                                                                                                                                                                                      |
| -------------------- | :-------: | ----------------------------------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `feedUrl`            |  **Yes**  |                                     | URL of the feed to fetch                                                                                                                                                                                                                                                         |
| `mastodonInstance`   |  **Yes**  |                                     | The root URL of the Mastodon instance where the toot should be created                                                                                                                                                                                                           |
| `mastodonToken`      |  **Yes**  |                                     | Your access token for the Mastodon API, get it from `/settings/applications/new` on your instance, and use an [encrypted secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets) to hide it                                                               |
| `nbTootsPerItem`     |    No     |                                   1 | Number of toots that can be created from the same item                                                                                                                                                                                                                           |
| `itemChoiceStrategy`     |    No     |                                   `"random"` | Strategy to choose the item to toot when multiple are available in the list of **least tooted items**. The following values can be used: `"random"`, `"newest"` (the most recent item), `"oldest"` (the oldest item)                                                                                                                                                                                                                           |
| `globalDelayToots`   |    No     |                        1440 (1 day) | Delay (in minutes) between any toot from this feed                                                                                                                                                                                                                               |
| `delayTootsSameItem` |    No     |                    129600 (90 days) | Delay (in minutes) between any toot for the same item from this feed (used only if `nbTootsPerItem > 1`)                                                                                                                                                                         |
| `cacheDirectory`     |    No     |                           `"cache"` | Path to the directory where cache files are stored                                                                                                                                                                                                                               |
| `cacheFile`          |    No     |           `"feed-to-mastodon.json"` | Name of the JSON file caching data from the feed and toots                                                                                                                                                                                                                       |
| `cacheTimestampFile` |    No     | `"feed-to-mastodon-timestamp.json"` | Name of the JSON file caching the timestamp of the last toot                                                                                                                                                                                                                     |
| `ignoreFirstRun`     |    No     |                                true | Items collected when the feed is fetched the first time won't be used as toots. This aims to prevent flooding Mastodon, as these items may have already been shared another way, manual or automated. If `nbTootsPerItem` is set to more than 1, only the first toot is ignored. |
| `testMode`           |    No     |                               false | Activates a mode for tests, where mentions are removed (`@` replaced by `$`)                                                                                                                                                                                                     |
| `tootVisibility`     |    No     |                          `"public"` | Toot visibility. The following values can be used: `"public"` (visible for all), `"unlisted"` (opted-out of discovery features), `"private"` (followers only), `"direct"` (visible only for mentioned users)                                                                            |
| `logFeedItemContent` |    No     |                               false | Log the content of the feed item that will be used to create the toot                                                                                                                                                                                                            |
| `instanceType`       |    No     |                        `"mastodon"` | Type of instance, to adapt API calls (values: `"mastodon"` or `"pixelfed"`)                                                                                                                                                                                                      |

## Outputs

The action sets an [**output** that you can use in following steps of your own action](https://docs.github.com/en/actions/creating-actions/metadata-syntax-for-github-actions#outputs-for-docker-container-and-javascript-actions):

| output    | description                      |
| --------- | -------------------------------- |
| `tootUrl` | URL of the toot that was created |

## Cache usage

There are 2 JSON files in the cache:

- `cacheFile` keeps a copy of all items from the feed, and for each item
  - the timestamp of the last toot created for this item
  - the list of URLs for these toots
- `cacheTimestampFile` keeps track of the timestamp of the last toot create by the action

> **Warning**
> Make sure to have steps "Checkout", "Pull" and "Commit and push" in your action, this is how the cache files are synchronized each time the action runs.

The cache prevents creating the same toot multiple times if you set `nbTootsPerItem` to 1 (which is the default).

If you set `nbTootsPerItem` to a value larger than 1, the action will chose an item among the ones that have the least toots. The choice is based on the `itemChoiceStrategy` input.

> [!TIP]
> Once [issue #7](https://github.com/nhoizey/github-action-jsonfeed-to-mastodon/issues/7) fixed, you'll be able to set `nbTootsPerItem` to `-1` to remove any limit.

In particular, any new item in the feed won't have existing toots, so it will be tooted first when the action runs, if all previous items already have at least one toot.

> [!CAUTION]
> If you use this action in multiple actions in the same repository, make sure you set different cache files.

> [!TIP]
> Once [issue #9](https://github.com/nhoizey/github-action-jsonfeed-to-mastodon/issues/9) fixed, the cache file default name will be based on the feed's URL.

## Required and optional feed content

### JSON Feed

The properties this action uses from a JSON Feed item are:

- `url` is used as the item id in the cache file
- `content_text` is used as the content of the toot
- `date_published` ([RFC 3339 format](https://www.rfc-editor.org/rfc/rfc3339))
- `language` is used to set the language of the toot
- if `attachments` is a non empty array, each image attachment (`mime_type` starts with `image/`) is added to the toot, with its description defined by `_alt_text` if it exists, or `title`.

Here's an example JSON feed with one single item, with only the properties that are either required by the [JSON Feed 1.1 specification](https://www.jsonfeed.org/version/1.1/), or useful for this action:

```json
{
  "version": "https://jsonfeed.org/version/1.1",
  "title": "Photos - Nicolas Hoizey",
  "items": [
    {
      "id": "https://nicolas-hoizey.photo/galleries/travels/europe/the-netherlands/arnhem/the-blacksmith/",
      "url": "https://nicolas-hoizey.photo/galleries/travels/europe/the-netherlands/arnhem/the-blacksmith/",
      "language": "en",
      "date_published": "2014-07-12T13:07:00Z",
      "content_text": "“The Blacksmith”\n\nShot in the amazing Openluchtmuseum (Open Air Museum) near Arnhem, in The Netherlands.\n\n📅 12th July 2014\n\n📸 Sony RX100 Mark III\n🎞️ ISO 3200, ƒ/2.8, 1/80s\n\n#Travels #Europe #TheNetherlands #Arnhem #Photo #Photography #PhotoOfTheDay #DailyPhoto\n\n🔎 https://nicolas-hoizey.photo/galleries/travels/europe/the-netherlands/arnhem/the-blacksmith/",
      "attachments": [
        {
          "url": "https://nicolas-hoizey.photo/photos/the-blacksmith/small.jpg",
          "mime_type": "image/jpeg",
          "title": "The blacksmith",
          "_alt_text": "A blacksmith in his workshop, working with his anvil"
        }
      ]
    }
  ]
}
```

## Usage with Pixelfed

Pixelfed v1 API is based on the [mastodon v1 API](https://docs.joinmastodon.org/methods/apps/), with a few differences listed in [the documentation](https://docs.pixelfed.org/technical-documentation/api/#differences-with-mastodon-api)

An (undocumentated) difference is that the `visibility` option is not supported, and trying to create a toot with a `visibility` option generates an error.

If you want to use this action with a Pixelfed instance, you have to set the optional `instanceType` input to `"pixelfed"`.

## Usage from a Wordpress site

Using the [JSON Feed plugin](https://wordpress.org/plugins/jsonfeed/) you can easily add a JSON feed to your WordPress install.
By default the feed will only contain the URL from the thumbnail in the `image` object.
To add the corresponding elements needed for this action to work (`attachments` object containing `url`, `mime_type`, `title` and `_alt_text`), you can use the following function, using the filter provided by the plugin:

```php
function wp_custom_json_feed_fields( $feed_item, $post ){

    $thumb_id = get_post_thumbnail_id( $post );
    $size = 'full';
    $attachments = array();

    // Create attachment object
    $attachment = array(
        'url' => wp_get_attachment_image_src($thumb_id, $size)[0],
        'mime_type' => wp_get_image_mime( wp_get_original_image_path( $thumb_id ) ),
        'title' => get_the_title( $thumb_id ),
        '_alt_text' => get_post_meta($thumb_id, '_wp_attachment_image_alt', TRUE)
    );

    // Add attachment object to the attachments array
    $attachments[] = $attachment;

    // Assign attachments array to the feed item
    $feed_item['attachments'] = $attachments;

    return $feed_item;
}
add_filter( 'json_feed_item', 'wp_custom_json_feed_fields', 10, 2);
```


When this function is added to your `functions.php` of your theme or child theme or to a plugin, here is an example of the output provided with WordPress (helped by the JSON feed plugin and your function):

```json
"items": [
  {
    "id": "https://example.com/?p=1351",
    "url": "https://example.com/coptic/apocryphal-nubian-manuscript/",
    "title": "Lorem ipsum dolor sit amet, consetetur sadipscing elitr",
    "content_html": "<p>Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet.</p>",
    "content_text": "Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet.",
    "date_published": "2024-03-29T23:25:10+01:00",
    "date_modified": "2024-03-29T23:40:30+01:00",
    "authors": [
      {
        "name": "julianoe",
        "url": "https://example.com/author/julianoe/",
        "avatar": "https://secure.gravatar.com/avatar/a66e90b52b5a5cf28992ba12d3bcf427?s=512&d=mm&r=g"
      }
    ],
    "author": {
      "name": "julianoe",
      "url": "https://example.com/author/julianoe/",
      "avatar": "https://secure.gravatar.com/avatar/..."
    },
    "image": "https://example.com/wp-content/uploads/2024/03/cover-image.jpg",
    "tags": [
      "example tag",
      "another"
    ],
    "summary": "Duis autem vel eum iriure dolor in hendrerit in vulputate velit esse molestie consequat.",
    "attachments": [
      {
        "url": "https://example.com/wp-content/uploads/2024/03/cover-image.jpg",
        "mime_type": "image/jpeg",
        "title": "the title of the image (by default the name of the file in wordpress)",
        "_alt_text": "Your alt text if entered one"
      }
    ]
  },
  { ... }
]
```



## Debugging

If you want to see what's happening in the action, you can enable additional
debug logs: [Enabling step debug logging](https://docs.github.com/en/actions/monitoring-and-troubleshooting-workflows/enabling-debug-logging#enabling-step-debug-logging)

## License

The scripts and documentation in this project are released under the [MIT License](LICENSE).
