import { useEffect, useState } from 'react'
import pdfFallback from '/assets/pdf.png'

type SuggestProps = {
  query: string
  apiResponse: Record<string, unknown> | null
}

const API_HOST = (import.meta.env.VITE_API_HOST ?? '').replace(/\/$/, '')

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
  const dcTitle = metadata ? asArray(metadata['dc.title']) : []
  const firstTitle = dcTitle[0]
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
    }
  }

  const indexableObject = getIndexableObject(item)
  const metadata = indexableObject && isRecord(indexableObject.metadata) ? indexableObject.metadata : null

  return {
    title: readTitle(item, fallbackIndex),
    abstractText: readMetadataValue(metadata, 'dc.description.abstract'),
    type: readMetadataValue(metadata, 'dc.type'),
    year: readMetadataYear(metadata),
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
  const titleCandidates = readMetadataValues(metadata, 'dc.title')
  return titleCandidates[0] ?? null
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

function Suggest({ query, apiResponse }: SuggestProps) {
  const objects = extractObjects(apiResponse)
  const [resolvedThumbnailMap, setResolvedThumbnailMap] = useState<Record<string, string | null>>({})
  const [resolvedPdfHrefMap, setResolvedPdfHrefMap] = useState<Record<string, string | null>>({})

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

    const getContentHrefFromBitstream = (bitstream: unknown): string | null => {
      const bitstreamRecord = isRecord(bitstream) ? bitstream : null
      const links = bitstreamRecord && isRecord(bitstreamRecord._links) ? bitstreamRecord._links : null
      const contentLink = links && isRecord(links.content) ? links.content : null
      const href = contentLink && typeof contentLink.href === 'string' ? toAbsoluteUrl(contentLink.href) : null
      return href
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

      const firstBitstream = bitstreams[0]
      return getContentHrefFromBitstream(firstBitstream)
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
          const item = objects.find((candidate, idx) => readItemKey(candidate, idx) === key)
          const itemUuid = item ? readItemUuid(item) : null
          if (itemUuid) {
            pdfHref = await resolveFromItemBundles(itemUuid)
          }
        }

        if (!isCancelled) {
          setResolvedPdfHrefMap((prev) => ({ ...prev, [key]: pdfHref }))
        }
      } catch {
        const item = objects.find((candidate, idx) => readItemKey(candidate, idx) === key)
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

    objects.forEach((item, index) => {
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
  }, [objects, resolvedPdfHrefMap])

  if (!query.trim()) return null

  return (
    <div className="grid space-y-1">
      {objects.length === 0 && (
        <article className="mx-4 rounded-xl border border-border bg-card p-4">
            <p className="mt-1 text-foreground font-medium">{query} <span className="text-muted-foreground text-xs">- Search policies</span></p>
        </article>
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

        const card = (
          <article className="mx-4 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40">
            <div className="flex items-center gap-4 ">
              <img
                src={thumbnailSrc}
                alt={info.title}
                className="h-16 w-12 rounded border border-border object-cover bg-muted/20"
                loading="lazy"
                onError={(event) => {
                  const img = event.currentTarget
                  if (img.src !== pdfFallback) {
                    img.src = pdfFallback
                  }
                }}
              />
              <div className="min-w-0">
                <p className="mt-1 text-foreground font-medium">{info.title}</p>
                <div className="mt-1 flex w-full gap-4">
                  <p className="text-xs text-muted-foreground">
                    Year: {info.year ?? 'N/A'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Type: {info.type ?? 'N/A'}
                  </p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-3">
                  {info.abstractText ?? ''}
                </p>
              </div>
            </div>
          </article>
        )

        if (pdfHref) {
          return (
            <a
              key={itemKey}
              href={pdfHref}
              target="_blank"
              rel="noreferrer"
              className="block"
            >
              {card}
            </a>
          )
        }

        return <div key={itemKey}>{card}</div>
      })}
    </div>
  )
}

export default Suggest
