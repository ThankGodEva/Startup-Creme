import React, { useState, useEffect, useMemo } from 'react';

interface StartupLogoProps {
  startup: {
    name: string;
    logo_url?: string | null;
    website_url?: string;
  };
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

function extractDomain(url?: string): string | null {
  if (!url) return null;
  try {
    const withProto = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
    const host = new URL(withProto).hostname.toLowerCase();
    return host.replace(/^www\./, '');
  } catch {
    return null;
  }
}

export const StartupLogo: React.FC<StartupLogoProps> = ({
  startup,
  size = 'md',
  className = '',
}) => {
  const domain = useMemo(() => extractDomain(startup.website_url), [startup.website_url]);

  // Construct a waterfall cascade of candidate logo sources
  const candidates = useMemo(() => {
    const list: string[] = [];
    const rawLogo = startup.logo_url?.trim();

    if (rawLogo) {
      // 1. Direct logo URL provided by the startup
      list.push(rawLogo);
      // 2. Same-origin backend logo proxy (bypasses browser tracking/hotlink blocking)
      list.push(`/api/directory/logo-proxy?url=${encodeURIComponent(rawLogo)}&name=${encodeURIComponent(startup.name)}`);
    }

    if (domain) {
      // 3. Google high-resolution favicon service (128px high-density vector/raster icon)
      list.push(`https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=128`);
      // 4. Same-origin backend logo proxy using domain
      list.push(`/api/directory/logo-proxy?domain=${encodeURIComponent(domain)}&name=${encodeURIComponent(startup.name)}`);
      // 5. DuckDuckGo high-res icon service
      list.push(`https://icons.duckduckgo.com/ip3/${domain}.ico`);
    }

    return list;
  }, [startup.logo_url, startup.name, domain]);

  const [candidateIndex, setCandidateIndex] = useState(0);
  const [hasLoaded, setHasLoaded] = useState(false);

  // Reset cascade if startup changes
  useEffect(() => {
    setCandidateIndex(0);
    setHasLoaded(false);
  }, [startup.name, startup.logo_url, startup.website_url]);

  const currentSrc = candidateIndex < candidates.length ? candidates[candidateIndex] : null;

  const handleImageError = () => {
    setHasLoaded(false);
    setCandidateIndex((prev) => prev + 1);
  };

  const handleImageLoad = () => {
    setHasLoaded(true);
  };

  // Dimensions based on size prop
  const containerClasses = useMemo(() => {
    switch (size) {
      case 'sm':
        return 'h-9 min-w-9 max-w-[90px] p-1 rounded-lg';
      case 'lg':
        return 'h-14 min-w-14 max-w-[140px] p-2 rounded-2xl';
      case 'md':
      default:
        return 'h-12 min-w-12 max-w-[120px] p-1.5 rounded-xl';
    }
  }, [size]);

  const imageClasses = useMemo(() => {
    switch (size) {
      case 'sm':
        return 'max-h-7 max-w-full w-auto h-auto object-contain';
      case 'lg':
        return 'max-h-11 max-w-full w-auto h-auto object-contain';
      case 'md':
      default:
        return 'max-h-9 max-w-full w-auto h-auto object-contain';
    }
  }, [size]);

  const initial = startup.name ? startup.name.trim().charAt(0).toUpperCase() : '?';

  // If all candidate image sources fail, show an elegant monogram badge
  if (!currentSrc) {
    return (
      <div
        className={`${containerClasses} border border-slate-200 bg-slate-100/80 flex items-center justify-center text-slate-800 font-serif font-bold text-lg shrink-0 shadow-2xs select-none ${className}`}
        title={`${startup.name} logo`}
        aria-label={`${startup.name} logo`}
      >
        <span>{initial}</span>
      </div>
    );
  }

  return (
    <div
      className={`${containerClasses} border border-slate-200 bg-white flex items-center justify-center shrink-0 shadow-2xs overflow-hidden relative ${className}`}
    >
      {!hasLoaded && (
        <div className="absolute inset-0 bg-slate-50 flex items-center justify-center text-slate-400 font-serif font-bold text-sm animate-pulse">
          {initial}
        </div>
      )}
      <img
        key={currentSrc}
        src={currentSrc}
        alt={`${startup.name} logo`}
        className={`${imageClasses} transition-opacity duration-200 ${hasLoaded ? 'opacity-100' : 'opacity-0'}`}
        loading="lazy"
        referrerPolicy="no-referrer"
        onLoad={handleImageLoad}
        onError={handleImageError}
      />
    </div>
  );
};
