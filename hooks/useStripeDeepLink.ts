import { useEffect, useRef } from 'react';
import { Linking } from 'react-native';

type Handler = (type: string) => void;

interface UseStripeDeepLinkOpts {
  onSuccess?: Handler;
  onCancel?: Handler;
  onPortalReturn?: Handler;
}

export function useStripeDeepLink(opts: UseStripeDeepLinkOpts) {
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    function handleUrl({ url }: { url: string }) {
      if (url.includes('stripe-success')) {
        const type = new URL(url).searchParams.get('type') ?? 'subscription';
        optsRef.current.onSuccess?.(type);
      } else if (url.includes('stripe-cancel')) {
        const type = new URL(url).searchParams.get('type') ?? 'subscription';
        optsRef.current.onCancel?.(type);
      } else if (url.includes('stripe-portal-return')) {
        const type = new URL(url).searchParams.get('type') ?? 'portal';
        optsRef.current.onPortalReturn?.(type);
      }
    }
    const sub = Linking.addEventListener('url', handleUrl);
    return () => sub.remove();
  }, []);
}
