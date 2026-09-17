import { useCallback, useSyncExternalStore } from 'react';

/**
 * Bir CSS medya sorgusunu izler.
 *
 * `useSyncExternalStore` tam olarak bunun icin var: React disindaki bir
 * kaynaga (burada matchMedia) abone olup degeri render ile tutarli tutar.
 * useState + useEffect ile yapilsaydi ilk render yanlis degerle cizilirdi.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false, // sunucuda render yok, yine de imza istiyor
  );
}

/** Tuval yaninda arac paneli ve bilgi paneli ayni anda sigmiyor. */
export const COMPACT_QUERY = '(max-width: 820px)';

/** Fare yerine parmakla kullaniliyor mu? Vurus yaricapini buna gore buyutuyoruz. */
export const COARSE_POINTER_QUERY = '(pointer: coarse)';
