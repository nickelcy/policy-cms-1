# DSpace API Documentation

For endpoint-to-code mapping, see: [Endpoints Usage in Policy CMS](./endpoints-usage.md)

## Overview

This document describes the DSpace REST API integration for the Policy CMS application. The production API is hosted at:

**Base URL**: `https://dspace.nickelcy.com/server/api`

## Search Endpoint

The primary endpoint used for searching policies is the DSpace Discovery Search endpoint.

### Endpoint

```
GET /server/api/discover/search/objects
```

### Official Documentation

For complete API contract details, refer to the [DSpace REST Contract - Search Endpoint](https://github.com/DSpace/RestContract/blob/main/search-endpoint.md).

## Query Parameters

The search endpoint accepts the following query parameters:

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `query` | string | Search query string | `"university policy"` |
| `page` | integer | Page number for pagination (0-indexed) | `0`, `1`, `2` |
| `size` | integer | Number of results per page | `5`, `10`, `20` |
| `sort` | string | Sort field and direction | `"score,DESC"`, `"dc.date.issued,DESC"` |
| `scope` | string | UUID of the collection/community to scope the search | `"123e4567-e89b-12d3-a456-426614174000"` |
| `dsoType` | string | Filter by DSpace object type | `"ITEM"`, `"COLLECTION"`, `"COMMUNITY"` |
| `filter` | string | Additional filter criteria (can be used multiple times) | `"dc.type,equals,Policy"` |
| `embed` | string | Related objects to embed in response | `"thumbnail"`, `"metadata"` |

### Parameter Details

#### `query`
The search query string. Supports full-text search across indexed fields.

**Example**: `query=student+handbook`

#### `page`
Zero-indexed page number for pagination. Default is `0`.

**Example**: `page=0` (first page), `page=1` (second page)

#### `size`
Number of results to return per page. For dropdown suggestions, we limit this to 5 results.

**Example**: `size=5` (for suggestions), `size=20` (for full results)

#### `sort`
Sort field and direction, separated by comma. Common sort options:
- `score,DESC` - Relevance (default)
- `dc.date.issued,DESC` - Date issued (newest first)
- `dc.title,ASC` - Title (alphabetical)

**Example**: `sort=dc.date.issued,DESC`

#### `scope`
UUID of a specific collection or community to limit the search scope. If omitted, searches across all accessible content.

**Example**: `scope=123e4567-e89b-12d3-a456-426614174000`

#### `dsoType`
Filter results by DSpace object type:
- `ITEM` - Individual items/documents
- `COLLECTION` - Collections
- `COMMUNITY` - Communities

**Example**: `dsoType=ITEM`

#### `filter`
Additional filter criteria. Can be used multiple times. Format: `field,operator,value`

Common operators:
- `equals` - Exact match
- `contains` - Contains substring
- `authority` - Filter by authority value

**Example**: `filter=dc.type,equals,Policy`

#### `embed`
Request related objects to be embedded in the response. Can be used multiple times.

**Example**: `embed=thumbnail&embed=metadata`

## Usage in Policy CMS

### Google-like Search Interface

The Policy CMS implements a Google-like search interface with autocomplete suggestions. The search flow works as follows:

#### Autocomplete Suggestions (Dropdown)

When a user types in the search box, autocomplete suggestions are displayed in a dropdown:

- **Size limit**: `size=5` - Limits results to 5 items for quick dropdown display
- **Query parameter**: Uses the `query` parameter for search terms
- **Sort**: Typically uses `sort=score,DESC` for relevance-based ordering

#### Full Search Results

If no suggestions are clicked (i.e., the user submits the search or presses Enter), the application displays the full search results:

- **Size limit**: `size=15` - Shows 15 results per page for optimal viewing
- **Pagination**: Full pagination support using the `page` parameter
- **Sort**: Uses `sort=score,DESC` to show the best/most relevant results first
- **Display**: Results are presented in a paginated list format

This approach provides a smooth user experience: quick suggestions for autocomplete, and comprehensive results with pagination for full searches.

### Example Requests

#### Basic Search
```http
GET /server/api/discover/search/objects?query=student+policy&size=10&page=0
```

#### Search with Filters
```http
GET /server/api/discover/search/objects?query=handbook&dsoType=ITEM&filter=dc.type,equals,Policy&size=20&page=0&sort=dc.date.issued,DESC
```

#### Autocomplete Suggestions (Dropdown)
```http
GET /server/api/discover/search/objects?query=university&size=5&sort=score,DESC
```

#### Full Search Results (No Suggestion Clicked)
```http
GET /server/api/discover/search/objects?query=university&size=15&page=0&sort=score,DESC
```

This returns the best/most relevant results with pagination. Navigate through pages by incrementing the `page` parameter:
- Page 0: `page=0`
- Page 1: `page=1`
- Page 2: `page=2`
- etc.

#### Scoped Search
```http
GET /server/api/discover/search/objects?query=academic&scope=123e4567-e89b-12d3-a456-426614174000&size=10
```

### JavaScript/React Example

```javascript
const searchPolicies = async (query, page = 0, size = 15) => {
  const baseUrl = 'https://dspace.nickelcy.com/server/api/discover/search/objects';
  const params = new URLSearchParams({
    query: query,
    page: page.toString(),
    size: size.toString(),
    sort: 'score,DESC',
    dsoType: 'ITEM',
  });

  const response = await fetch(`${baseUrl}?${params}`);
  const data = await response.json();
  return data;
};

// For autocomplete suggestions (dropdown)
const getSuggestions = async (query) => {
  return searchPolicies(query, 0, 5);
};

// For full search results (when no suggestion is clicked)
const getFullSearchResults = async (query, page = 0) => {
  return searchPolicies(query, page, 15);
};
```

## Response Format

The API returns a JSON response containing:

- `_embedded` - Embedded objects (items, collections, etc.)
- `page` - Pagination information (size, totalElements, totalPages, number)
- `_links` - HATEOAS links for navigation

### Example Response Structure

```json
{
  "_embedded": {
    "searchResult": {
      "_embedded": {
        "objects": [
          {
            "indexableObject": {
              "uuid": "123e4567-e89b-12d3-a456-426614174000",
              "name": "Student Handbook 2024",
              "type": "item",
              "_links": {
                "self": {
                  "href": "/server/api/core/items/123e4567-e89b-12d3-a456-426614174000"
                }
              }
            },
            "hitHighlights": []
          }
        ]
      }
    }
  },
  "_links": {
    "self": {
      "href": "/server/api/discover/search/objects?query=handbook"
    }
  },
  "page": {
    "size": 10,
    "totalElements": 25,
    "totalPages": 3,
    "number": 0
  }
}
```

## Error Handling

The API follows standard HTTP status codes:

- `200 OK` - Successful request
- `400 Bad Request` - Invalid parameters
- `401 Unauthorized` - Authentication required
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

## Authentication

For public content, authentication is typically not required. However, for accessing private or restricted content, DSpace may require authentication tokens.

## Best Practices

1. **Pagination**: Always implement pagination for large result sets
2. **Caching**: Consider caching search results for frequently accessed queries
3. **Error Handling**: Implement proper error handling for network failures
4. **Rate Limiting**: Be mindful of API rate limits in production
5. **Query Optimization**: Use appropriate filters to narrow down results and improve performance

## Additional Resources

- [DSpace REST API Documentation](https://wiki.lyrasis.org/display/DSDOC7x/REST+API)
- [DSpace REST Contract](https://github.com/DSpace/RestContract)
- [DSpace Discovery Search Documentation](https://wiki.lyrasis.org/display/DSDOC7x/Discovery)
