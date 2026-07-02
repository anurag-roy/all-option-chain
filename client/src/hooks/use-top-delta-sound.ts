import { playNotificationSound } from '@client/lib/notification-sound';
import { getTop3DeltaSet, hasTop3DeltaChanged } from '@client/lib/top-delta';
import type { ChainEngineStatus, OptionChainData } from '@shared/types/types';
import { useEffect, useRef } from 'react';

export function useTopDeltaSound(
  optionChainData: OptionChainData,
  chainStatus: ChainEngineStatus['status']
) {
  const previousTop3Ref = useRef<Set<number> | null>(null);
  const primedRef = useRef(false);

  useEffect(() => {
    if (chainStatus !== 'ready') {
      primedRef.current = false;
      previousTop3Ref.current = null;
    }
  }, [chainStatus]);

  useEffect(() => {
    if (chainStatus !== 'ready') {
      return;
    }

    const nextTop3 = getTop3DeltaSet(optionChainData);

    if (!primedRef.current) {
      previousTop3Ref.current = nextTop3;
      primedRef.current = true;
      return;
    }

    const previousTop3 = previousTop3Ref.current;
    if (previousTop3 && hasTop3DeltaChanged(previousTop3, nextTop3)) {
      playNotificationSound();
    }

    previousTop3Ref.current = nextTop3;
  }, [optionChainData, chainStatus]);
}
