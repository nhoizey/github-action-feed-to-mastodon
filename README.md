# GitHub Action: Any feed to Mastoson

A GitHub Action that creates messages (toots) on your Mastodon account from a RSS/Atom/JSON feed's items.

This should be a simple way to POSSE — [Publish (on your) Own Site, Syndicate Elsewhere](https://indieweb.org/POSSE) — content from your blog to your Mastodon account.

> **Note**
> It currently supports [JSON Feed](https://www.jsonfeed.org/), with [support for RSS and Atom planned](https://github.com/nhoizey/github-action-feed-to-mastodon/issues/16).

## Example usage

I recommend to try first with an action requiring a manual action with [the `workflow_dispatch` event](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#workflow_dispatch), and set `testMode: true`, to test the settings.

Here's a minimal version, with only required inputs:

```yaml
name: Create toots from feed items
on:
  workflow_dispatch:

jobs:
  JSONFeed2Mastodon:
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

| input                | required? |                           default | description                                                                                                                                                                                                                                                                      |
| -------------------- | :-------: | --------------------------------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `feedUrl`            |  **Yes**  |                                   | URL of the feed to fetch                                                                                                                                                                                                                                                         |
| `mastodonInstance`   |  **Yes**  |                                   | The root URL of the Mastodon instance where the toot should be created                                                                                                                                                                                                           |
| `mastodonToken`      |  **Yes**  |                                   | Your access token for the Mastodon API, get it from `/settings/applications/new` on your instance, and use an [encrypted secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets) to hide it                                                               |
| `nbTootsPerItem`     |    No     |                                 1 | Number of toots that can be created from the same item                                                                                                                                                                                                                           |
| `globalDelayToots`   |    No     |                      1440 (1 day) | Delay (in minutes) between any toot from this feed                                                                                                                                                                                                                               |
| `delayTootsSameItem` |    No     |                  129600 (90 days) | Delay (in minutes) between any toot for the same item from this feed (used only if `nbTootsPerItem > 1`)                                                                                                                                                                         |
| `cacheDirectory`     |    No     |                           `cache` | Path to the directory where cache files are stored                                                                                                                                                                                                                               |
| `cacheFile`          |    No     |           `feed-to-mastodon.json` | Name of the JSON file caching data from the feed and toots                                                                                                                                                                                                                       |
| `cacheTimestampFile` |    No     | `feed-to-mastodon-timestamp.json` | Name of the JSON file caching the timestamp of the last toot                                                                                                                                                                                                                     |
| `ignoreFirstRun`     |    No     |                              true | Items collected when the feed is fetched the first time won't be used as toots. This aims to prevent flooding Mastodon, as these items may have already been shared another way, manual or automated. If `nbTootsPerItem` is set to more than 1, only the first toot is ignored. |
| `testMode`           |    No     |                             false | Activates a mode for tests, where mentions are removed (`@` replaced by `$`)                                                                                                                                                                                                     |

> **Note**
> The toot visibility is currently always set to "public". (You can [help enhance this](https://github.com/nhoizey/github-action-jsonfeed-to-mastodon/issues/8).)

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

If you set `nbTootsPerItem` to a value larger than 1, the action will randomly chose an item among the ones that have the least toots.

> **Note**
> Once [issue #7](https://github.com/nhoizey/github-action-jsonfeed-to-mastodon/issues/7) fixed, you'll be able to set `nbTootsPerItem` to `-1` to remove any limit.

> **Note**
> Once [issue #14](https://github.com/nhoizey/github-action-jsonfeed-to-mastodon/issues/14) fixed, you'll be able to define other choice strategies.

In particular, any new item in the feed won't have existing toots, so it will be tooted first when the action runs, if all previous items already have at least one toot.

> **Warning**
> If you use this action in multiple actions in the same repository, make sure you set different cache files.

> **Note**
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

## License

The scripts and documentation in this project are released under the [MIT License](LICENSE).
