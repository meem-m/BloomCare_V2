import { useEffect, useState, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { syncPendingLogs } from './storageService';
import { supabase } from './supabase';

/**
 * Hook to monitor network status and sync pending logs on reconnect
 */
export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(true);
  const syncScheduledRef = useRef(null);

  useEffect(() => {
    let unsubscribe;

    const setupNetworkListener = async () => {
      // Check initial network status
      const state = await NetInfo.fetch();
      setIsOnline(state.isConnected ?? true);

      // Subscribe to network changes
      unsubscribe = NetInfo.addEventListener((state) => {
        const connected = state.isConnected ?? false;
        setIsOnline(connected);

        // If reconnected, sync pending logs after 2 seconds
        if (connected && !syncScheduledRef.current) {
          syncScheduledRef.current = setTimeout(async () => {
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (user?.id) {
                await syncPendingLogs(user.id);
              }
            } catch (err) {
              console.error('Error syncing pending logs:', err);
            } finally {
              syncScheduledRef.current = null;
            }
          }, 2000);
        }
      });
    };

    setupNetworkListener();

    return () => {
      unsubscribe?.();
      if (syncScheduledRef.current) {
        clearTimeout(syncScheduledRef.current);
      }
    };
  }, []);

  return isOnline;
};

/**
 * Manual check for network status
 */
export const checkNetworkStatus = async () => {
  const state = await NetInfo.fetch();
  return state.isConnected ?? false;
};
