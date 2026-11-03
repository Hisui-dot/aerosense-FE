import { useState, useEffect } from 'react';
import { Card } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { TopBar } from '@/app/components/layout/TopBar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { alertsApi } from '@/app/services/api';

interface LogEntry {
  id: string;
  location: string;
  timestamp: string;
  status: string;
  date: string;
  timestampValue: number;
}

export const Logs = () => {
  const [dateFilter, setDateFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const data = await alertsApi.getAll().catch(() => []);

        const mappedLogs: LogEntry[] = data.map((a: any) => {
          let dateObj = a.resolvedAt ? new Date(a.resolvedAt) : (a.createdAt ? new Date(a.createdAt) : new Date());
          if (isNaN(dateObj.getTime())) dateObj = new Date();
          return {
            id: String(a.id).startsWith('SIM') ? String(a.id) : `ALT-${String(a.id).substring(0, 6).toUpperCase()}`,
            location: `${a.floor || 'Unknown Floor'} — ${a.location || 'Unknown Room'}`,
            timestamp: `${dateObj.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} - ${dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}`,
            status: a.status === 'ACTIVE' ? 'NEW' : a.status === 'REOPENED' ? 'REOPENED' : a.status === 'RESPONDING' ? 'RESPONDING' : a.status === 'ACKNOWLEDGED' ? 'ACKNOWLEDGED' : a.status === 'FALSE_ALARM' ? 'FALSE ALARM' : 'RESOLVED',
            date: dateObj.toISOString().split('T')[0],
            timestampValue: dateObj.getTime(),
          };
        });
        
        mappedLogs.sort((a, b) => b.timestampValue - a.timestampValue);
        setLogs(mappedLogs);
      } catch (error) {
        console.error('Failed to fetch logs', error);
      }
    };
    fetchLogs();
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => { setPage(1); }, [dateFilter, locationFilter]);

  const filteredLogs = logs.filter((log) => {
    if (locationFilter !== 'all' && !log.location.includes(locationFilter)) return false;
    
    if (dateFilter !== 'all') {
      const now = Date.now();
      const oneDay = 24 * 60 * 60 * 1000;
      if (dateFilter === 'today' && (now - log.timestampValue) > oneDay) return false;
      if (dateFilter === 'week' && (now - log.timestampValue) > 7 * oneDay) return false;
      if (dateFilter === 'month' && (now - log.timestampValue) > 30 * oneDay) return false;
    }
    
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedLogs = filteredLogs.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="min-h-screen bg-[#82BCFE] pb-20">
      <TopBar title="Logs" />

      {/* Filters */}
      <div className="bg-white p-4 border-t border-gray-200 shadow-sm">
        <div className="grid grid-cols-2 gap-3 max-w-2xl mx-auto">
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="border-2 border-gray-300 rounded-xl">
              <SelectValue placeholder="Date Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Dates</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
            </SelectContent>
          </Select>

          <Select value={locationFilter} onValueChange={setLocationFilter}>
            <SelectTrigger className="border-2 border-gray-300 rounded-xl">
              <SelectValue placeholder="Location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              <SelectItem value="Classroom">Classroom</SelectItem>
              <SelectItem value="CR">CR</SelectItem>
              <SelectItem value="Library">Library</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Log List */}
      <div className="p-4 max-w-2xl mx-auto space-y-3">
        {pagedLogs.map((log) => (
          <Card key={log.id} className="p-5 bg-white shadow-lg rounded-2xl border-0">
            <div className="flex justify-between items-start mb-2">
              <div className="font-bold text-gray-900 text-lg">{log.location}</div>
              <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-0 font-semibold">
                {log.status}
              </Badge>
            </div>
            <div className="text-sm text-gray-600 font-medium">{log.timestamp}</div>
          </Card>
        ))}
            </div>

      {/* Pagination */}
      {filteredLogs.length > 0 && (
        <div className="max-w-2xl mx-auto mt-6 flex flex-col items-center gap-2 pb-6">
          <p className="text-sm font-medium text-blue-900">
            Page {safePage} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button 
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="px-4 py-2 bg-white text-blue-900 font-bold rounded-lg shadow disabled:opacity-50"
            >
              Previous
            </button>
            <button 
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="px-4 py-2 bg-white text-blue-900 font-bold rounded-lg shadow disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

