import { useEffect, useState } from 'react';
import type { RDKitModule } from '@rdkit/rdkit';
import { initRdkit } from './RdkitService';

export type RdkitState =
  | { status: 'loading'; rdkit: null; error: null }
  | { status: 'ready'; rdkit: RDKitModule; error: null }
  | { status: 'error'; rdkit: null; error: Error };

/**
 * RDKit WASM'ini tembel yukler. Tuval RDKit gelmeden de calisabilmeli,
 * bu yuzden hicbir bilesen bu hook'un 'ready' olmasini beklemek zorunda degil.
 */
export function useRdkit(): RdkitState {
  const [state, setState] = useState<RdkitState>({
    status: 'loading',
    rdkit: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    initRdkit().then(
      (rdkit) => !cancelled && setState({ status: 'ready', rdkit, error: null }),
      (error: Error) => !cancelled && setState({ status: 'error', rdkit: null, error }),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
