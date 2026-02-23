# Endpoints Usage in Policy CMS

This document describes the exact DSpace endpoints currently used by this application and how each endpoint is used in the frontend flow.

## Base Host

- Configured via `.env`:
  - `VITE_API_HOST=https://dspace.nickelcy.com`
- Effective base for API calls:
  - `${VITE_API_HOST}/server/api`

## 1) Search Items

### Endpoint

- `GET /server/api/discover/search/objects`

### Where used

- `src/App.tsx`

### Purpose

- Runs live search as the user types in the search box.
- Returns DSpace search results that include item info and embedded data.

### Query parameters used

- `query`: user input text
- `page=0`
- `size=5`
- `sort=dc.date.accessioned,DESC`
- `scope=7e5c02a9-d75c-48c4-becd-03b395bd25f3`
- `embed=thumbnail`
- `dsoType=ITEM`
- `f.original_bundle_filenames=.pdf,contains`

## 2) Resolve Thumbnail for Item Result

### Endpoint (item thumbnail)

- `GET /server/api/core/items/{itemUuid}/thumbnail`

### Where used

- `src/components/element/suggest.tsx`

### Purpose

- For some results, DSpace returns an item thumbnail endpoint (metadata endpoint).
- The app calls this endpoint to resolve a thumbnail/bitstream link.

### Follow-up link used

- From response: `_links.content.href`
- This gives an actual image content endpoint for display.

## 3) Thumbnail/Image Content

### Endpoint (bitstream content)

- `GET /server/api/core/bitstreams/{bitstreamUuid}/content`

### Where used

- `src/components/element/suggest.tsx`

### Purpose

- Used as `img` source for result thumbnails.
- If not available/fails, app falls back to local `assets/pdf.png`.

## 4) Resolve PDF Link (Primary)

### Endpoint

- `GET /server/api/core/bitstreams/search/byItemHandle?handle={handle}&filename={filename}`

### Where used

- `src/components/element/suggest.tsx`

### Purpose

- Finds the target bitstream for an item based on item handle + filename.
- App reads `_links.content.href` from this response.
- That URL becomes the card click target (`href`) for opening the PDF.

## 5) Resolve PDF Link (Fallback Path)

If `byItemHandle` does not return a usable bitstream content link, the app uses a fallback chain:

### 5.1 Item Bundles

- `GET /server/api/core/items/{itemUuid}/bundles`

Purpose:
- Locate bundle named `ORIGINAL`.

### 5.2 Bundle Bitstreams

- `GET {originalBundle._links.bitstreams.href}`
  - Typically: `/server/api/core/bundles/{bundleUuid}/bitstreams`

Purpose:
- Read bitstreams in `ORIGINAL` bundle.
- Prefer bitstream that looks like PDF (`dc.format` contains `pdf` or filename ends with `.pdf`).
- Use `_links.content.href` as final PDF URL.

## 6) Card Link Target in UI

### Final link target used by cards

- `.../server/api/core/bitstreams/{uuid}/content`

### Where applied

- `src/components/element/suggest.tsx`

### Behavior

- If a PDF content URL is resolved, card is wrapped with an anchor opening in a new tab.
- If not resolved, card remains non-clickable.

## 7) Endpoints Not Called Directly by Current UI

These are documented in DSpace docs but currently not used directly in this app flow:

- `GET /server/api/core/bitstreams/{uuid}`
- `GET /server/api/core/bitstreams/{uuid}/format`
- `GET /server/api/core/bitstreams/{uuid}/bundle`
- `GET /server/api/core/bitstreams/{uuid}/accessStatus`
- write/update/delete bitstream endpoints

## Notes

- This app currently performs live requests per typed query (no debounce yet).
- The frontend expects DSpace HAL-style `_links` and `_embedded` payloads.
- Endpoint behavior may vary based on repository permissions and item metadata quality.
