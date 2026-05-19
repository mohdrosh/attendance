import { useState, useCallback } from 'react';
import { Request as AttendanceRequest } from '@attendance/shared';
import { apiFetch } from '../api/client';

export function useRequests() {
  const [requests, setRequests] = useState<AttendanceRequest[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/requests');
      if (res.ok) setRequests(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  return { requests, loading, fetchRequests };
}
