import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import universityLogo from '/assets/University-of-Guyana-Logo.png'
import { Link, Route, Routes } from 'react-router-dom'
import { FiMenu, FiSearch, FiX } from 'react-icons/fi'
import axios from 'axios'
import AboutPage from '@/pages/about'
import Suggest from '@/components/element/suggest'

const API_HOST = (import.meta.env.VITE_API_HOST ?? '').replace(/\/$/, '')
const SEARCH_ENDPOINT = '/server/api/discover/search/objects'

function HomePage() {
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [activeQuery, setActiveQuery] = useState<string>('')
  const [apiResponse, setApiResponse] = useState<Record<string, unknown> | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [requestError, setRequestError] = useState<string | null>(null)

  const handleSearch = () => {
    setActiveQuery(searchQuery.trim())
  }

  useEffect(() => {
    const query = activeQuery.trim()

    if (!query) {
      setApiResponse(null)
      setRequestError(null)
      setIsLoading(false)
      return
    }

    const controller = new AbortController()

    const fetchSearchResults = async () => {
      setIsLoading(true)
      setRequestError(null)

      try {
        if (!API_HOST) {
          setRequestError('API host is not configured.')
          return
        }

        const response = await axios.get(`${API_HOST}${SEARCH_ENDPOINT}`, {
          params: {
            query,
            page: 0,
            size: 5,
            sort: 'dc.date.accessioned,DESC',
            scope: '7e5c02a9-d75c-48c4-becd-03b395bd25f3',
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

    fetchSearchResults()

    return () => controller.abort()
  }, [activeQuery])

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  return (
    <div className="w-full max-w-2xl space-y-8">
      {/* Title */}
      <div className="text-center space-y-2">
        <h1 className="text-5xl font-normal text-foreground">
          <span className="text-primary">Policy</span>{' '}
          <span className="text-secondary">Search</span>
        </h1>
        <p className="text-muted-foreground">Search University of Guyana policies</p>
      </div>

      {/* Search Bar */}
      <div className="relative space-y-2">
        <div className="px-4 flex items-center gap-2 border border-input rounded-full bg-background shadow-sm hover:shadow-md transition-shadow focus-within:shadow-md focus-within:ring-1 focus-within:ring-primary/25">
          <Input
            type="text"
            placeholder="Search policies..."
            value={searchQuery}
            onChange={(e) => {
              const nextValue = e.target.value
              setSearchQuery(nextValue)
              if (!nextValue.trim()) {
                setActiveQuery('')
              }
            }}
            onKeyDown={handleKeyPress}
            className="flex-1 border-0 rounded-full focus-visible:ring-0 focus-visible:ring-offset-0 h-14 text-base px-6 pr-0"
          />
          <Button
            onClick={handleSearch}
            className="rounded-full h-10 w-10 p-0 mr-2"
            variant="ghost"
            aria-label="Search"
          >
            <FiSearch className="h-5 w-5" />
          </Button>
        </div>
      {/* Search Results */}
        {isLoading && (
          <p className="text-sm text-muted-foreground ms-12">Searching...</p>
        )}
        {requestError && <p className="text-sm text-destructive m-0">{requestError}</p>}
        {!isLoading && !requestError && (
          <Suggest query={activeQuery} apiResponse={apiResponse} />
        )}
      {/* </div> */}
      </div>

    </div>
  )
}

function App() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header with Logo */}
      <header className="fixed top-0 left-0 right-0 z-50 w-full py-1 px-4 border-b border-border/60 bg-background/50 backdrop-blur-md">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <img
            src={universityLogo}
            alt="University of Guyana"
            className="h-16 object-contain"
          />
          <div className="hidden md:flex items-center gap-4 font-medium text-muted-foreground">
            <Link to="/" className="hover:text-primary transition-colors">
              Home
            </Link>
            <Link to="/about" className="hover:text-primary transition-colors">
              About
            </Link>
            <a
              href="https://www.uog.edu.gy"
              className="hover:text-primary transition-colors"
              target="_blank"
              rel="noreferrer"
            >
              UG Website
            </a>
          </div>
          <button
            type="button"
            className="md:hidden inline-flex items-center justify-center rounded-md border border-border p-2 text-muted-foreground hover:text-primary hover:border-primary transition-colors"
            aria-label="Toggle menu"
            aria-expanded={isMobileMenuOpen}
            onClick={() => setIsMobileMenuOpen((open) => !open)}
          >
            {isMobileMenuOpen ? (
              <FiX className="h-5 w-5" />
            ) : (
              <FiMenu className="h-5 w-5" />
            )}
          </button>
        </div>
        {isMobileMenuOpen && (
          <div className="max-w-4xl mx-auto md:hidden pb-3">
            <nav className="rounded-xl border border-border bg-card p-3 flex flex-col gap-1 text-muted-foreground font-medium">
              <Link
                to="/"
                className="px-3 py-2 rounded-md hover:bg-muted hover:text-primary transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Home
              </Link>
              <Link
                to="/about"
                className="px-3 py-2 rounded-md hover:bg-muted hover:text-primary transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                About
              </Link>
              <a
                href="https://www.uog.edu.gy"
                className="px-3 py-2 rounded-md hover:bg-muted hover:text-primary transition-colors"
                target="_blank"
                rel="noreferrer"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                UG Website
              </a>
            </nav>
          </div>
        )}
      </header>

      {/* Main Search Area */}
      <main className="flex-1 flex items-start justify-center px-4 py-12 mt-16">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
        </Routes>
      </main>

      <footer className="w-full py-4 px-4 border-t border-border/60">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-sm text-muted-foreground/80">
            &copy; 2026 University of Guyana. All rights reserved.
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground/60">
            Managed and Maintained by IGRIS.
          </p>
        </div>
      </footer>
    </div>
  )
}

export default App
