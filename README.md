# Lens Exact Match Sorter

Sort Google Lens **Exact matches** by image size, directly on Google's results page. Version **1.2.1** orders the full loaded list across Google's separate result batches instead of sorting each batch independently.

## Install in Chrome

1. Open this repository's **Releases** section and choose **v1.2.1**.
2. Download **Source code (zip)** and unzip it into a permanent folder.
3. Open `chrome://extensions/` in Chrome.
4. Turn on **Developer mode**.
5. Click **Load unpacked** and select the extracted folder containing `manifest.json`.
6. Refresh any Google Lens results tabs that were already open.

No Node.js installation or build step is needed to use the extension. Keep the extracted folder in place while the extension is installed. Disable older copies of Lens Exact Match Sorter to avoid conflicts.

## Use

1. Run a Google Lens image search and open **Exact matches**.
2. Use **Largest first** or **Smallest first** directly above the results.
3. Scroll to load additional results. Newly loaded supported matches join the chosen sort order automatically.

The extension moves the existing result cards rather than creating a separate list. Original links and card contents are preserved. Ordinary search and Visual matches are not sorted.

## How size is ranked

Results are ranked by Google's reported width multiplied by height, not thumbnail dimensions. Unknown sizes stay last, and equal-size results retain their original relative order. Only loaded, supported matches are included. Reported dimensions are not an independent measurement of the original image or a guarantee of the largest copy online.

## Compatibility and troubleshooting

The manifest enables the extension on `www.google.com/search` and `lens.google.com`. Google can change its page markup, so other domains, languages, or layouts may not be supported.

If the controls do not appear, confirm that **Exact matches** is selected and refresh the page. After updating the files, click **Reload** for the extension at `chrome://extensions/`, then refresh the results page.

The preserved 1.2.1 package still has an old 1.2.0 label in its popup footer. Chrome's extension version and `manifest.json` correctly show 1.2.1.

## Privacy

The extension performs its sorting locally on the page. Its scripts do not send search data to an external service, add analytics, or download original images. It declares the `activeTab` permission and the Google content-script matches listed above.

## Version 1.2.1

Fixes global ordering across result groups. The local regression suite passed 76 tests, including a 243-result fixture across eight groups, additional loaded batches, repeated direction changes, stable ties, unknown sizes, and preservation of original cards. This public package contains the extension runtime files.

This is an independent project and is not affiliated with or endorsed by Google.
