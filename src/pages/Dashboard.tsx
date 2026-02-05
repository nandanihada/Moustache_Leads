import React, { useEffect, useState } from "react";
import { TrendingUp, Users, MousePointer, DollarSign, Target, Gift } from "lucide-react";
import { KPIWidget } from "@/components/dashboard/KPIWidget";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import PlacementRequired from "@/components/PlacementRequired";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { dashboardApi, DashboardStats, ChartDataPoint, TopOffer } from "@/services/dashboardApi";
import { toast } from "sonner";

/* -------------------------
   Dashboard Component
------------------------- */
const DashboardContent = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [topOffers, setTopOffers] = useState<TopOffer[]>([]);
  const [chartLoading, setChartLoading] = useState(true);
  const [offersLoading, setOffersLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
    fetchChartData();
    fetchTopOffers();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      const response = await dashboardApi.getStats();
      if (response.success) {
        setStats(response.stats);
      } else {
        toast.error('Failed to load dashboard statistics');
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      toast.error('Failed to load dashboard statistics');
    } finally {
      setLoading(false);
    }
  };

  const fetchChartData = async () => {
    try {
      setChartLoading(true);
      const response = await dashboardApi.getChartData();
      if (response.success) {
        setChartData(response.chart_data);
      }
    } catch (error) {
      console.error('Error fetching chart data:', error);
    } finally {
      setChartLoading(false);
    }
  };

  const fetchTopOffers = async () => {
    try {
      setOffersLoading(true);
      const response = await dashboardApi.getTopOffers();
      if (response.success) {
        setTopOffers(response.top_offers);
      }
    } catch (error) {
      console.error('Error fetching top offers:', error);
    } finally {
      setOffersLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your affiliate performance</p>
      </div>

      {/* KPI Widgets */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPIWidget
          title="Total Revenue"
          value={loading ? "Loading..." : `$${stats?.total_revenue?.toFixed(2) || '0.00'}`}
          change={loading ? "" : stats?.revenue_change?.text || "+0%"}
          changeType={stats?.revenue_change?.type || "neutral"}
          icon={DollarSign}
        />
        <KPIWidget
          title="Total Clicks"
          value={loading ? "Loading..." : stats?.total_clicks?.toLocaleString() || '0'}
          change={loading ? "" : `${stats?.total_clicks || 0} total`}
          changeType="neutral"
          icon={MousePointer}
        />
        <KPIWidget
          title="Conversions"
          value={loading ? "Loading..." : stats?.total_conversions?.toLocaleString() || '0'}
          change={loading ? "" : stats?.conversions_change?.text || "+0%"}
          changeType={stats?.conversions_change?.type || "neutral"}
          icon={Target}
        />
        <KPIWidget
          title="Active Offers"
          value={loading ? "Loading..." : stats?.active_offers?.toString() || '0'}
          change="Available offers"
          changeType="neutral"
          icon={Gift}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Performance Overview</CardTitle>
          </CardHeader>
          <CardContent>
            {chartLoading ? (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                Loading chart data...
              </div>
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="clicks" fill="hsl(var(--primary))" name="Clicks" />
                  <Bar dataKey="conversions" fill="hsl(var(--secondary))" name="Conversions" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No performance data yet. Start promoting offers to see your stats!
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {loading ? (
                <div className="text-center text-muted-foreground py-8">Loading...</div>
              ) : stats?.recent_activity && stats.recent_activity.length > 0 ? (
                stats.recent_activity.map((activity) => (
                  <div key={activity.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{activity.action}</p>
                      <p className="text-sm text-muted-foreground">{activity.offer}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-primary">{activity.amount}</p>
                      <p className="text-sm text-muted-foreground">{activity.time}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-muted-foreground py-8">No recent activity</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Performing Offers */}
      <Card>
        <CardHeader>
          <CardTitle>Top Performing Offers</CardTitle>
        </CardHeader>
        <CardContent>
          {offersLoading ? (
            <div className="text-center text-muted-foreground py-8">Loading top offers...</div>
          ) : topOffers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Offer Name</TableHead>
                  <TableHead>Clicks</TableHead>
                  <TableHead>Conversions</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead>Conv. Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topOffers.map((offer) => (
                  <TableRow key={offer.id}>
                    <TableCell className="font-medium">{offer.name}</TableCell>
                    <TableCell>{offer.clicks.toLocaleString()}</TableCell>
                    <TableCell>{offer.conversions}</TableCell>
                    <TableCell className="text-primary font-medium">{offer.revenue}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{offer.conversionRate}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              No conversion data yet. Start promoting offers to see your top performers!
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

/* -------------------------
   Main Dashboard Component
------------------------- */
const Dashboard = () => {
  return (
    <PlacementRequired>
      <DashboardContent />
    </PlacementRequired>
  );
};

export default Dashboard;
