# GitHub Action: JSON Feed to Mastoson

A GitHub Action that creates messages (toots) on your Mastodon account from JSON Feed items.

## Settings

| option             | required? | default                                      | description                                                                    |
| ------------------ | --------- | -------------------------------------------- | ------------------------------------------------------------------------------ |
| feedUrl            | true      |                                              | URL of the JSON Feed to fetch                                                  |
| mastodonInstance   | true      |                                              | The root URL of the Mastodon instance where the toot should be created         |
| mastodonToken      | true      |                                              | Your access token for the Mastodon API, get it from /settings/applications/new |
| nbTootsPerItem     | false     | 1                                            | Number of toots that can be created from the same item                         |
| globalDelayToots   | false     | 1440 (1 day)                                 | Delay (in minutes) between any toot from this feed                             |
| delayTootsSameItem | false     | 129600 (90 days)                             | Delay (in minutes) between any toot for the same item from this feed           |
| cacheFile          | false     | `.cache/jsonfeed-to-mastodon.json`           | Path to the JSON file caching data from the feed and toots                     |
| cacheTimestampFile | false     | `.cache/jsonfeed-to-mastodon-timestamp.json` | Path to the JSON file caching the timestamp of the last toot                   |
