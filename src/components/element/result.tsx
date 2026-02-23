import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import universityLogo from '/assets/University-of-Guyana-Logo.png'
import pdfFallback from '/assets/pdf.png'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { FiSearch } from 'react-icons/fi'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const API_HOST = (import.meta.env.VITE_API_HOST ?? '').replace(/\/$/, '')
const SEARCH_ENDPOINT = '/server/api/discover/search/objects'
const SEARCH_SORT = import.meta.env.VITE_SEARCH_SORT ?? 'dc.date.accessioned,DESC'
const DSPACE_SCOPE_UUID = import.meta.env.VITE_DSPACE_SCOPE_UUID ?? ''
const PAGE_SIZE = Number.parseInt(import.meta.env.VITE_RESULTS_PAGE_SIZE ?? '15', 10)
const RECENT_RECOMMENDATION_SIZE = Number.parseInt(import.meta.env.VITE_RECENT_RECOMMENDATION_SIZE ?? '5', 10)

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])

const readMetadataValue = (
  metadata: Record<string, unknown> | null,
  field: string,
): string | null => {
  if (!metadata) return null
  const values = asArray(metadata[field])
  const first = values[0]
  if (isRecord(first) && typeof first.value === 'string' && first.value.trim()) {
    return first.value
  }
  return null
}

const readMetadataValues = (
  metadata: Record<string, unknown> | null,
  field: string,
): string[] => {
  if (!metadata) return []
  return asArray(metadata[field])
    .map((entry) => (isRecord(entry) && typeof entry.value === 'string' ? entry.value : null))
    .filter((value): value is string => Boolean(value))
}

const readMetadataYear = (metadata: Record<string, unknown> | null): string | null => {
  const candidates = [
    readMetadataValue(metadata, 'dc.date.issued'),
    readMetadataValue(metadata, 'dc.date.accessioned'),
    readMetadataValue(metadata, 'dc.date.available'),
  ].filter((value): value is string => Boolean(value))

  for (const value of candidates) {
    const match = value.match(/\b(19|20)\d{2}\b/)
    if (match) return match[0]
  }

  return null
}

const getIndexableObject = (item: unknown): Record<string, unknown> | null => {
  if (!isRecord(item)) return null

  if (isRecord(item.indexableObject)) {
    return item.indexableObject
  }

  const embedded = isRecord(item._embedded) ? item._embedded : null
  if (embedded && isRecord(embedded.indexableObject)) {
    return embedded.indexableObject
  }

  return null
}

const readTitle = (item: unknown, fallbackIndex: number): string => {
  if (!isRecord(item)) {
    return `Result ${fallbackIndex + 1}`
  }

  const indexableObject = getIndexableObject(item)
  const name = indexableObject && typeof indexableObject.name === 'string' ? indexableObject.name : null
  if (name) return name

  const metadata = indexableObject && isRecord(indexableObject.metadata) ? indexableObject.metadata : null
  const firstTitle = asArray(metadata?.['dc.title'])[0]
  if (isRecord(firstTitle) && typeof firstTitle.value === 'string') {
    return firstTitle.value
  }

  return `Result ${fallbackIndex + 1}`
}

const readObjectInfo = (item: unknown, fallbackIndex: number) => {
  if (!isRecord(item)) {
    return {
      title: `Result ${fallbackIndex + 1}`,
      abstractText: null as string | null,
      type: null as string | null,
      year: null as string | null,
      handle: null as string | null,
    }
  }

  const indexableObject = getIndexableObject(item)
  const metadata = indexableObject && isRecord(indexableObject.metadata) ? indexableObject.metadata : null

  return {
    title: readTitle(item, fallbackIndex),
    abstractText: readMetadataValue(metadata, 'dc.description.abstract'),
    type: readMetadataValue(metadata, 'dc.type'),
    year: readMetadataYear(metadata),
    handle: indexableObject && typeof indexableObject.handle === 'string' ? indexableObject.handle : null,
  }
}

const readItemKey = (item: unknown, fallbackIndex: number): string => {
  const indexableObject = getIndexableObject(item)
  const uuid = indexableObject && typeof indexableObject.uuid === 'string' ? indexableObject.uuid : null
  return uuid ?? `result-${fallbackIndex}`
}

const readItemHandle = (item: unknown): string | null => {
  const indexableObject = getIndexableObject(item)
  return indexableObject && typeof indexableObject.handle === 'string'
    ? indexableObject.handle
    : null
}

const readItemFileName = (item: unknown): string | null => {
  const indexableObject = getIndexableObject(item)
  if (!indexableObject) return null

  if (typeof indexableObject.name === 'string' && indexableObject.name.trim()) {
    return indexableObject.name
  }

  const metadata = isRecord(indexableObject.metadata) ? indexableObject.metadata : null
  return readMetadataValues(metadata, 'dc.title')[0] ?? null
}

const readItemUuid = (item: unknown): string | null => {
  const indexableObject = getIndexableObject(item)
  return indexableObject && typeof indexableObject.uuid === 'string' ? indexableObject.uuid : null
}

const toAbsoluteUrl = (value: string | null): string | null => {
  if (!value) return null
  if (value.startsWith('http://') || value.startsWith('https://')) return value
  if (!API_HOST) return null
  return `${API_HOST}${value.startsWith('/') ? value : `/${value}`}`
}

const toImageContentUrl = (value: string | null): string | null => {
  const href = toAbsoluteUrl(value)
  if (!href) return null

  if (/\/server\/api\/core\/bitstreams\/[^/]+\/thumbnail\/?$/.test(href)) {
    return href.replace(/\/thumbnail\/?$/, '/content')
  }

  return href
}

const isItemThumbnailEndpoint = (href: string): boolean =>
  /\/server\/api\/core\/items\/[^/]+\/thumbnail\/?$/.test(href)

const readThumbnailHref = (item: unknown): string | null => {
  if (!isRecord(item)) return null

  const embedded = isRecord(item._embedded) ? item._embedded : null
  const thumbnailValue = embedded?.thumbnail
  const thumbnail = isRecord(thumbnailValue)
    ? thumbnailValue
    : isRecord(asArray(thumbnailValue)[0])
      ? (asArray(thumbnailValue)[0] as Record<string, unknown>)
      : null

  const thumbLinks = thumbnail && isRecord(thumbnail._links) ? thumbnail._links : null
  const contentLink = thumbLinks && isRecord(thumbLinks.content) ? thumbLinks.content : null
  if (contentLink && typeof contentLink.href === 'string') {
    return toImageContentUrl(contentLink.href)
  }

  const selfLink = thumbLinks && isRecord(thumbLinks.self) ? thumbLinks.self : null
  if (selfLink && typeof selfLink.href === 'string') {
    return toImageContentUrl(selfLink.href)
  }

  const indexableObject = getIndexableObject(item)
  const indexLinks = indexableObject && isRecord(indexableObject._links) ? indexableObject._links : null
  const thumbnailLink = indexLinks && isRecord(indexLinks.thumbnail) ? indexLinks.thumbnail : null
  if (thumbnailLink && typeof thumbnailLink.href === 'string') {
    return toImageContentUrl(thumbnailLink.href)
  }

  return null
}

const extractObjects = (apiResponse: Record<string, unknown> | null): unknown[] => {
  if (!apiResponse) return []
  const embedded = isRecord(apiResponse._embedded) ? apiResponse._embedded : null
  const searchResult = embedded && isRecord(embedded.searchResult) ? embedded.searchResult : null
  const nestedEmbedded = searchResult && isRecord(searchResult._embedded) ? searchResult._embedded : null
  return nestedEmbedded ? asArray(nestedEmbedded.objects) : []
}

const readNumericField = (record: Record<string, unknown> | null, field: string): number | null => {
  if (!record) return null
  const value = record[field]
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseInt(value, 10)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

const getPageRecord = (apiResponse: Record<string, unknown> | null): Record<string, unknown> | null => {
  if (!apiResponse) return null
  const rootPage = isRecord(apiResponse.page) ? apiResponse.page : null
  if (rootPage) return rootPage

  const embedded = isRecord(apiResponse._embedded) ? apiResponse._embedded : null
  const searchResult = embedded && isRecord(embedded.searchResult) ? embedded.searchResult : null
  return searchResult && isRecord(searchResult.page) ? searchResult.page : null
}

const readTotalPages = (apiResponse: Record<string, unknown> | null): number => {
  const page = getPageRecord(apiResponse)
  const totalPages = readNumericField(page, 'totalPages')
  return Math.max(0, totalPages ?? 0)
}

const readTotalElements = (apiResponse: Record<string, unknown> | null): number => {
  const page = getPageRecord(apiResponse)
  return Math.max(0, readNumericField(page, 'totalElements') ?? 0)
}

const readHandleUrl = (handle: string | null): string | null => {
  if (!handle || !API_HOST) return null
  return `${API_HOST}/handle/${handle}`
}

const parsePageParam = (value: string | null): number => {
  if (!value) return 1
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

const getPageWindow = (currentPage: number, totalPages: number): number[] => {
  const start = Math.max(1, currentPage - 2)
  const end = Math.min(totalPages, currentPage + 2)
  const pages: number[] = []
  for (let page = start; page <= end; page += 1) {
    pages.push(page)
  }
  return pages
}

const sanitizePositiveInt = (value: number, fallback: number): number =>
  Number.isFinite(value) && value > 0 ? value : fallback

function ResultPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const currentQuery = (searchParams.get('q') ?? '').trim()
  const currentPage = parsePageParam(searchParams.get('page'))

  const [searchInput, setSearchInput] = useState(currentQuery)
  const [apiResponse, setApiResponse] = useState<Record<string, unknown> | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [recentRecommendations, setRecentRecommendations] = useState<unknown[]>([])
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false)
  const [resolvedThumbnailMap, setResolvedThumbnailMap] = useState<Record<string, string | null>>({})
  const [resolvedPdfHrefMap, setResolvedPdfHrefMap] = useState<Record<string, string | null>>({})

  useEffect(() => {
    setSearchInput(currentQuery)
  }, [currentQuery])

  useEffect(() => {
    if (!currentQuery) {
      setApiResponse(null)
      setRequestError(null)
      setIsLoading(false)
      return
    }

    const controller = new AbortController()

    const fetchResults = async () => {
      setIsLoading(true)
      setRequestError(null)
      setRecentRecommendations([])
      setResolvedThumbnailMap({})
      setResolvedPdfHrefMap({})

      try {
        if (!API_HOST) {
          setRequestError('API host is not configured.')
          return
        }

        const response = await axios.get(`${API_HOST}${SEARCH_ENDPOINT}`, {
          params: {
            query: currentQuery,
            page: currentPage - 1,
            size: sanitizePositiveInt(PAGE_SIZE, 15),
            sort: SEARCH_SORT,
            scope: DSPACE_SCOPE_UUID,
            embed: 'thumbnail',
            dsoType: 'ITEM',
            'f.original_bundle_filenames': '.pdf,contains',
          },
          signal: controller.signal,
        })

        setApiResponse(response.data)
      } catch (error) {
        if (axios.isAxiosError(error) && error.code === 'ERR_CANCELED') {
          return
        }
        setRequestError('Could not fetch search results.')
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    fetchResults()
    return () => controller.abort()
  }, [currentPage, currentQuery])

  const objects = useMemo(() => extractObjects(apiResponse), [apiResponse])
  const totalPages = readTotalPages(apiResponse)
  const totalElements = readTotalElements(apiResponse) || objects.length

  useEffect(() => {
    if (!currentQuery || isLoading || requestError || objects.length > 0) {
      setIsLoadingRecommendations(false)
      return
    }

    const controller = new AbortController()

    const fetchRecommendations = async () => {
      try {
        if (!API_HOST) return

        setIsLoadingRecommendations(true)
        const response = await axios.get(`${API_HOST}${SEARCH_ENDPOINT}`, {
          params: {
            query: '*',
            page: 0,
            size: sanitizePositiveInt(RECENT_RECOMMENDATION_SIZE, 5),
            sort: SEARCH_SORT,
            scope: DSPACE_SCOPE_UUID,
            embed: 'thumbnail',
            dsoType: 'ITEM',
            'f.original_bundle_filenames': '.pdf,contains',
          },
          signal: controller.signal,
        })

        const recommendedObjects = extractObjects(response.data).slice(0, sanitizePositiveInt(RECENT_RECOMMENDATION_SIZE, 5))
        setRecentRecommendations(recommendedObjects)
      } catch (error) {
        if (axios.isAxiosError(error) && error.code === 'ERR_CANCELED') {
          return
        }
        setRecentRecommendations([])
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingRecommendations(false)
        }
      }
    }

    fetchRecommendations()

    return () => controller.abort()
  }, [currentQuery, isLoading, objects, requestError])

  useEffect(() => {
    let isCancelled = false

    const resolveItemThumbnail = async (href: string) => {
      try {
        const response = await fetch(href)
        const payload: unknown = await response.json()
        const payloadRecord = isRecord(payload) ? payload : null
        const links = payloadRecord && isRecord(payloadRecord._links) ? payloadRecord._links : null
        const contentLink = links && isRecord(links.content) ? links.content : null
        const contentHref =
          contentLink && typeof contentLink.href === 'string'
            ? toImageContentUrl(contentLink.href)
            : null

        if (!isCancelled) {
          setResolvedThumbnailMap((prev) => ({ ...prev, [href]: contentHref }))
        }
      } catch {
        if (!isCancelled) {
          setResolvedThumbnailMap((prev) => ({ ...prev, [href]: null }))
        }
      }
    }

    const itemThumbnailHrefs = objects
      .map((item) => readThumbnailHref(item))
      .filter((href): href is string => Boolean(href))
      .filter((href) => isItemThumbnailEndpoint(href))
      .filter((href, index, all) => all.indexOf(href) === index)

    itemThumbnailHrefs.forEach((href) => {
      if (!(href in resolvedThumbnailMap)) {
        void resolveItemThumbnail(href)
      }
    })

    return () => {
      isCancelled = true
    }
  }, [objects, resolvedThumbnailMap])

  useEffect(() => {
    let isCancelled = false
    const allItems = [...objects, ...recentRecommendations]

    const getContentHrefFromBitstream = (bitstream: unknown): string | null => {
      const bitstreamRecord = isRecord(bitstream) ? bitstream : null
      const links = bitstreamRecord && isRecord(bitstreamRecord._links) ? bitstreamRecord._links : null
      const contentLink = links && isRecord(links.content) ? links.content : null
      return contentLink && typeof contentLink.href === 'string' ? toAbsoluteUrl(contentLink.href) : null
    }

    const resolveFromItemBundles = async (itemUuid: string): Promise<string | null> => {
      const bundlesUrl = `${API_HOST}/server/api/core/items/${itemUuid}/bundles`
      const bundlesResponse = await fetch(bundlesUrl)
      if (!bundlesResponse.ok) return null

      const bundlesPayload: unknown = await bundlesResponse.json()
      const bundlesRecord = isRecord(bundlesPayload) ? bundlesPayload : null
      const bundlesEmbedded = bundlesRecord && isRecord(bundlesRecord._embedded) ? bundlesRecord._embedded : null
      const bundles = bundlesEmbedded ? asArray(bundlesEmbedded.bundles) : []
      const originalBundle = bundles.find((bundle) => {
        const bundleRecord = isRecord(bundle) ? bundle : null
        return bundleRecord && bundleRecord.name === 'ORIGINAL'
      })

      if (!isRecord(originalBundle)) return null

      const bundleLinks = isRecord(originalBundle._links) ? originalBundle._links : null
      const bitstreamsLink = bundleLinks && isRecord(bundleLinks.bitstreams) ? bundleLinks.bitstreams : null
      const bitstreamsHref =
        bitstreamsLink && typeof bitstreamsLink.href === 'string'
          ? toAbsoluteUrl(bitstreamsLink.href)
          : null
      if (!bitstreamsHref) return null

      const bitstreamsResponse = await fetch(bitstreamsHref)
      if (!bitstreamsResponse.ok) return null

      const bitstreamsPayload: unknown = await bitstreamsResponse.json()
      const bitstreamsRecord = isRecord(bitstreamsPayload) ? bitstreamsPayload : null
      const bitstreamsEmbedded =
        bitstreamsRecord && isRecord(bitstreamsRecord._embedded) ? bitstreamsRecord._embedded : null
      const bitstreams = bitstreamsEmbedded ? asArray(bitstreamsEmbedded.bitstreams) : []

      for (const bitstream of bitstreams) {
        const bitstreamRecord = isRecord(bitstream) ? bitstream : null
        if (!bitstreamRecord) continue

        const metadata = isRecord(bitstreamRecord.metadata) ? bitstreamRecord.metadata : null
        const formatValues = readMetadataValues(metadata, 'dc.format')
        const titleValues = readMetadataValues(metadata, 'dc.title')
        const looksLikePdf =
          formatValues.some((value) => value.toLowerCase().includes('pdf')) ||
          titleValues.some((value) => value.toLowerCase().endsWith('.pdf')) ||
          (typeof bitstreamRecord.name === 'string' && bitstreamRecord.name.toLowerCase().endsWith('.pdf'))

        const contentHref = getContentHrefFromBitstream(bitstreamRecord)
        if (looksLikePdf && contentHref) return contentHref
      }

      return getContentHrefFromBitstream(bitstreams[0])
    }

    const resolvePdfHref = async (key: string, handle: string, fileName: string) => {
      try {
        if (!API_HOST) {
          if (!isCancelled) {
            setResolvedPdfHrefMap((prev) => ({ ...prev, [key]: null }))
          }
          return
        }

        const url = new URL('/server/api/core/bitstreams/search/byItemHandle', API_HOST)
        url.searchParams.set('handle', handle)
        url.searchParams.set('filename', fileName)

        const response = await fetch(url.toString())
        if (!response.ok) {
          if (!isCancelled) {
            setResolvedPdfHrefMap((prev) => ({ ...prev, [key]: null }))
          }
          return
        }

        const payload: unknown = await response.json()
        const payloadRecord = isRecord(payload) ? payload : null
        const links = payloadRecord && isRecord(payloadRecord._links) ? payloadRecord._links : null
        const contentLink = links && isRecord(links.content) ? links.content : null
        let pdfHref =
          contentLink && typeof contentLink.href === 'string' ? toAbsoluteUrl(contentLink.href) : null

        if (!pdfHref) {
          const item = allItems.find((candidate, idx) => readItemKey(candidate, idx) === key)
          const itemUuid = item ? readItemUuid(item) : null
          if (itemUuid) {
            pdfHref = await resolveFromItemBundles(itemUuid)
          }
        }

        if (!isCancelled) {
          setResolvedPdfHrefMap((prev) => ({ ...prev, [key]: pdfHref }))
        }
      } catch {
        const item = allItems.find((candidate, idx) => readItemKey(candidate, idx) === key)
        const itemUuid = item ? readItemUuid(item) : null
        let fallbackHref: string | null = null

        if (itemUuid && API_HOST) {
          try {
            fallbackHref = await resolveFromItemBundles(itemUuid)
          } catch {
            fallbackHref = null
          }
        }

        if (!isCancelled) {
          setResolvedPdfHrefMap((prev) => ({ ...prev, [key]: fallbackHref }))
        }
      }
    }

    allItems.forEach((item, index) => {
      const key = readItemKey(item, index)
      if (key in resolvedPdfHrefMap) return

      const handle = readItemHandle(item)
      const fileName = readItemFileName(item)

      if (!handle || !fileName) {
        setResolvedPdfHrefMap((prev) => ({ ...prev, [key]: null }))
        return
      }

      void resolvePdfHref(key, handle, fileName)
    })

    return () => {
      isCancelled = true
    }
  }, [objects, recentRecommendations, resolvedPdfHrefMap])

  const submitSearch = () => {
    const nextQuery = searchInput.trim()
    if (!nextQuery) return
    setSearchParams({ q: nextQuery, page: '1' })
  }

  const goToPage = (nextPage: number) => {
    if (!currentQuery || nextPage < 1 || nextPage > totalPages) return
    setSearchParams({ q: currentQuery, page: String(nextPage) })
  }

  const pageWindow = getPageWindow(currentPage, totalPages)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/80 bg-background">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-6 py-4">
          <img
            src={universityLogo}
            alt="University of Guyana"
            className="h-12 w-auto object-contain md:block cursor-pointer"
            onClick={() => navigate("/")}
          /> 
          <div className="mx-auto flex w-full max-w-2xl items-center gap-2 rounded-full border border-input bg-background px-3 shadow-sm">
            <Input
              type="text"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  submitSearch()
                }
              }}
              placeholder="Search policies..."
              className="h-12 border-0 text-base focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <Button
              type="button"
              onClick={submitSearch}
              variant="ghost"
              aria-label="Search"
              className="h-9 w-9 rounded-full p-0"
            >
              <FiSearch className="h-5 w-5" />
            </Button>
          </div>
          <Link to="/" className="min-w-28 text-2xl font-semibold leading-none hidden h-12 w-auto object-contain md:block flex items-center content-center gap-1">
            <span className="text-primary">UG</span>
            <span className="text-secondary">P</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-6 py-8">
        {!currentQuery && (
          <p className="text-sm text-muted-foreground">Enter a search term to view results.</p>
        )}
        {isLoading && <p className="text-sm text-muted-foreground">Searching...</p>}
        {requestError && <p className="text-sm text-destructive">{requestError}</p>}

        {!isLoading && !requestError && currentQuery && (
          <>
            <p className="mb-4 text-sm text-muted-foreground">
              {totalElements.toLocaleString()} result{totalElements === 1 ? '' : 's'} for{' '}
              <span className="font-medium text-foreground">{currentQuery}</span>
            </p>

            <div className="space-y-6">
              {objects.length === 0 && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    No policies found for this query.
                  </p>
                  <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
                    <p className="text-sm font-medium text-foreground">
                      Recommended recent submissions
                    </p>
                    {isLoadingRecommendations && (
                      <p className="mt-2 text-xs text-muted-foreground">Loading recommendations...</p>
                    )}
                    {!isLoadingRecommendations && recentRecommendations.length === 0 && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        No recent submissions available right now.
                      </p>
                    )}
                    {!isLoadingRecommendations && recentRecommendations.length > 0 && (
                      <ul className="mt-2 space-y-2">
                        {recentRecommendations.map((item, index) => {
                          const info = readObjectInfo(item, index)
                          const itemKey = readItemKey(item, index)
                          const pdfHref = resolvedPdfHrefMap[itemKey] ?? null

                          return (
                            <li key={`recommended-${itemKey}`} className="text-sm">
                              {pdfHref ? (
                                <a
                                  href={pdfHref}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-blue-700 hover:underline"
                                >
                                  {info.title}
                                </a>
                              ) : (
                                <span className="text-foreground">{info.title} (PDF unavailable)</span>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              {objects.map((item, index) => {
                const info = readObjectInfo(item, index)
                const itemKey = readItemKey(item, index)
                const rawThumbnailHref = readThumbnailHref(item)
                const thumbnailHref = rawThumbnailHref
                  ? isItemThumbnailEndpoint(rawThumbnailHref)
                    ? resolvedThumbnailMap[rawThumbnailHref] ?? null
                    : rawThumbnailHref
                  : null
                const thumbnailSrc = thumbnailHref ?? pdfFallback
                const pdfHref = resolvedPdfHrefMap[itemKey] ?? null
                const handleUrl = readHandleUrl(info.handle)
                const destinationHref = pdfHref ?? handleUrl
                const displayUrl = destinationHref ?? (info.handle ? `handle/${info.handle}` : 'No public URL')

                return (
                  <article key={itemKey} className="flex gap-4">
                    <img
                      src={thumbnailSrc}
                      alt={info.title}
                      className="mt-1 h-20 w-14 shrink-0 rounded border border-border object-cover bg-muted/20"
                      loading="lazy"
                      onError={(event) => {
                        const img = event.currentTarget
                        if (img.src !== pdfFallback) {
                          img.src = pdfFallback
                        }
                      }}
                    />
                    <div className="min-w-0">
                      {destinationHref ? (
                        <a
                          href={destinationHref}
                          target="_blank"
                          rel="noreferrer"
                          className="text-2xl font-semibold leading-tight text-blue-600 hover:underline"
                        >
                          {info.title}
                        </a>
                      ) : (
                        <p className="text-2xl font-semibold leading-tight text-blue-600">
                          {info.title}
                        </p>
                      )}

                      <p className="mt-1 break-all text-sm text-blue-700">
                        {displayUrl}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Type: {info.type ?? 'N/A'} | Year: {info.year ?? 'N/A'} | Handle:{' '}
                        {info.handle ?? 'N/A'}
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {info.abstractText ?? 'No abstract available.'}
                      </p>
                    </div>
                  </article>
                )
              })}
            </div>
          </>
        )}

        {!isLoading && !requestError && totalPages > 1 && (
          <nav className="mt-10 flex items-center justify-center gap-2" aria-label="Pagination">
            <Button
              type="button"
              variant="outline"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              className="h-9 px-3"
            >
              Previous
            </Button>
            {pageWindow.map((page) => (
              <Button
                key={page}
                type="button"
                variant={page === currentPage ? 'default' : 'outline'}
                onClick={() => goToPage(page)}
                className="h-9 min-w-9 px-3"
              >
                {page}
              </Button>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="h-9 px-3"
            >
              Next
            </Button>
          </nav>
        )}
      </main>
    </div>
  )
}

export default ResultPage
