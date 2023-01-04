# GitHub Action: JSON Feed to Mastoson

A GitHub Action that creates messages (toots) on your Mastodon account from JSON Feed items.

## Inputs

| input              | required? | default                               | description                                                                    |
| ------------------ | --------- | ------------------------------------- | ------------------------------------------------------------------------------ |
| feedUrl            | true      |                                       | URL of the JSON Feed to fetch                                                  |
| mastodonInstance   | true      |                                       | The root URL of the Mastodon instance where the toot should be created         |
| mastodonToken      | true      |                                       | Your access token for the Mastodon API, get it from /settings/applications/new |
| nbTootsPerItem     | false     | 1                                     | Number of toots that can be created from the same item                         |
| globalDelayToots   | false     | 1440 (1 day)                          | Delay (in minutes) between any toot from this feed                             |
| delayTootsSameItem | false     | 129600 (90 days)                      | Delay (in minutes) between any toot for the same item from this feed           |
| cacheDirectory     | false     | `.cache`                              | Path to the directory where cache files are stored                             |
| cacheFile          | false     | `jsonfeed-to-mastodon.json`           | Name of the JSON file caching data from the feed and toots                     |
| cacheTimestampFile | false     | `jsonfeed-to-mastodon-timestamp.json` | Name of the JSON file caching the timestamp of the last toot                   |

## Outputs

| output  | description                      |
| ------- | -------------------------------- |
| tootUrl | URL of the toot that was created |

## Example usage

I recommend trying first an action required a manual action, to test the settings.

```yaml
name: Create toots from JSON Feed items
on:
  workflow_dispatch:

env:
  CACHE_DIRECTORY: ".cache"

jobs:
  Mastodon:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout 🛎️
        uses: actions/checkout@v3

      - name: Set up Node.js ⚙️
        uses: actions/setup-node@v3
        with:
          node-version-file: ".nvmrc"
          cache: "npm"

      - name: Install dependencies 📦
        run: npm ci

      - name: JSON Feed to Mastodon 🦣
        uses: nhoizey/github-action-jsonfeed-to-mastodon@v1
        env:
          RUNNER_TEMPORARY_DIRECTORY: ${{ runner.temp }}
        with:
          feedUrl: "https://nicolas-hoizey.photo/feeds/mastodon/photos-test.json"
          mastodonInstance: ${{ secrets.TEST_MASTODON_INSTANCE }}
          mastodonToken: ${{ secrets.TEST_MASTODON_TOKEN }}
          cacheDirectory: ${{ env.CACHE_DIRECTORY }}
          globalDelayToots: 1

      - name: Pull any changes 📥
        run: git pull

      - name: Commit and push 📤
        uses: stefanzweifel/git-auto-commit-action@v4
        with:
          commit_message: "chore(cache): update Mastodon cache file (automated)"
          file_pattern: "${{ env.CACHE_DIRECTORY }}/*.json"
          skip_fetch: false
```

You can then enhance your action with a schedule as defined in GitHub's [events that trigger workflows](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#schedule).
