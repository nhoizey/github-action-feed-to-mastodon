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
