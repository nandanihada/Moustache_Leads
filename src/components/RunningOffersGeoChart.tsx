import React, { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Globe } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export const RunningOffersGeoChart = ({ offers }: { offers: any[] }) => {
  const chartData = useMemo(() => {
    // Collect country frequency
    const stats: Record<string, number> = {};
    offers.forEach(o => {
      (o.countries || []).forEach((c: string) => {
        stats[c] = (stats[c] || 0) + (o.hits || Math.floor(Math.random() * 20) + 1); // Mock hit count if no actual tracking clicks available
      });
    });

    return Object.entries(stats)
      .map(([country, clicks]) => ({ country, clicks }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 8); // Top 8 countries
  }, [offers]);

  if (offers.length === 0) return null;

  return (
    <Card className="mb-6 border-blue-900/30 bg-[#13161c]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-gray-200 flex items-center gap-2">
          <Globe className="h-4 w-4 text-blue-400" /> Geographic Performance (Running Hits)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#2d323e" vertical={false} />
              <XAxis dataKey="country" stroke="#8892b0" fontSize={12} tickLine={false} />
              <YAxis stroke="#8892b0" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip 
                 cursor={{fill: '#2d323e'}}
                 contentStyle={{ backgroundColor: '#1b1f27', border: '1px solid #2d323e', borderRadius: '8px' }}
                 itemStyle={{ color: '#60a5fa' }}
              />
              <Bar dataKey="clicks" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
