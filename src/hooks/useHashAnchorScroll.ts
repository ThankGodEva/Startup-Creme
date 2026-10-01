import { useState, useEffect, useCallback } from 'react';

export interface RouteLocation {
  pathname: string;
  search: string;
  hash: string;
}

export namespace Route {
  export interface MetaArgs {
    location: RouteLocation;
    params?: Record<string, string | undefined>;
    data?: unknown;
  }
}

export interface MetaDescriptor {
  title?: string;
  name?: string;
  content?: string;
  property?: string;
  tagName?: string;
  rel?: string;
  href?: string;
}

/**
 * Lightweight, zero-dependency location hook compatible with React Router 7's useLocation()
 * Tracks pathname, search, and hash across popstate, hashchange, and programmatic history updates.
 */
export function useLocation(): RouteLocation {
  const getSnapshot = (): RouteLocation => {
    if (typeof window === 'undefined') {
      return { pathname: '/', search: '', hash: '' };
    }
    return {
      pathname: window.location.pathname,
      search: window.location.search,
      hash: window.location.hash,
    };
  };

  const [location, setLocation] = useState<RouteLocation>(getSnapshot);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleLocationUpdate = () => {
      setLocation({
        pathname: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash,
      });
    };

    window.addEventListener('hashchange', handleLocationUpdate);
    window.addEventListener('popstate', handleLocationUpdate);
    window.addEventListener('startupcreme:hashchange', handleLocationUpdate);

    return () => {
      window.removeEventListener('hashchange', handleLocationUpdate);
      window.removeEventListener('popstate', handleLocationUpdate);
      window.removeEventListener('startupcreme:hashchange', handleLocationUpdate);
    };
  }, []);

  return location;
}

/**
 * Synchronizes active sub-tab/section state with URL hash fragments and smooth-scrolls
 * to the matching DOM element ID without triggering full page reloads.
 */
export function useHashAnchorScroll(
  setActiveTab: (tab: string) => void,
  options?: {
    defaultHash?: string;
    validHashes?: string[];
    metaFn?: (args: Route.MetaArgs) => MetaDescriptor[];
  }
) {
  const location = useLocation();

  useEffect(() => {
    const rawHash = location.hash.replace(/^#/, '').trim();
    const activeHash =
      rawHash || (options?.defaultHash ? options.defaultHash.replace(/^#/, '') : '');

    if (rawHash) {
      if (!options?.validHashes || options.validHashes.includes(rawHash)) {
        setActiveTab(rawHash);
      }
      // Allow DOM paint before scrolling
      const timer = setTimeout(() => {
        const element = document.getElementById(rawHash);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
      return () => clearTimeout(timer);
    } else if (activeHash && (!options?.validHashes || options.validHashes.includes(activeHash))) {
      setActiveTab(activeHash);
    }
  }, [location.hash, setActiveTab]);

  // Synchronize live document <title>, <link rel="canonical">, and <meta property="og:url">
  useEffect(() => {
    if (typeof document === 'undefined' || !options?.metaFn) return;

    const descriptors = options.metaFn({ location });
    for (const desc of descriptors) {
      if (desc.title) {
        document.title = desc.title;
      }
      if (desc.tagName === 'link' && desc.rel === 'canonical' && desc.href) {
        let canonicalEl = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
        if (!canonicalEl) {
          canonicalEl = document.createElement('link');
          canonicalEl.setAttribute('rel', 'canonical');
          document.head.appendChild(canonicalEl);
        }
        canonicalEl.setAttribute('href', desc.href);
      }
      if (desc.property === 'og:url' && desc.content) {
        let ogUrlEl = document.querySelector<HTMLMetaElement>('meta[property="og:url"]');
        if (!ogUrlEl) {
          ogUrlEl = document.createElement('meta');
          ogUrlEl.setAttribute('property', 'og:url');
          document.head.appendChild(ogUrlEl);
        }
        ogUrlEl.setAttribute('content', desc.content);
      }
      if (desc.name === 'description' && desc.content) {
        const descEl = document.querySelector<HTMLMetaElement>('meta[name="description"]');
        if (descEl) {
          descEl.setAttribute('content', desc.content);
        }
      }
    }
  }, [location.pathname, location.hash, options?.metaFn]);

  const navigateToHash = useCallback(
    (targetHash: string, scroll = true) => {
      const cleanHash = targetHash.replace(/^#/, '').trim();
      if (!cleanHash) return;

      setActiveTab(cleanHash);

      if (typeof window !== 'undefined') {
        const newUrl = `${window.location.pathname}${window.location.search}#${cleanHash}`;
        window.history.replaceState(null, '', newUrl);
        window.dispatchEvent(new CustomEvent('startupcreme:hashchange', { detail: { hash: `#${cleanHash}` } }));

        if (scroll) {
          setTimeout(() => {
            const element = document.getElementById(cleanHash);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }, 80);
        }
      }
    },
    [setActiveTab]
  );

  return {
    currentHash: location.hash.replace(/^#/, ''),
    location,
    navigateToHash,
  };
}
