import React from "react";
import { TrendingUp, Users, MousePointer, DollarSign, Target, Gift } from "lucide-react";
import { KPIWidget } from "@/components/dashboard/KPIWidget";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

/* -------------------------
   Chart + Data
------------------------- */
const chartData = [
  { name: "Jan", clicks: 4000, conversions: 240, revenue: 2400 },
  { name: "Feb", clicks: 3000, conversions: 139, revenue: 2210 },
  { name: "Mar", clicks: 2000, conversions: 980, revenue: 2290 },
  { name: "Apr", clicks: 2780, conversions: 390, revenue: 2000 },
  { name: "May", clicks: 1890, conversions: 480, revenue: 2181 },
  { name: "Jun", clicks: 2390, conversions: 380, revenue: 2500 },
];

const recentActivity = [
  { id: 1, action: "New conversion", offer: "Mobile App Install", amount: "$25.00", time: "2 min ago" },
  { id: 2, action: "Payout processed", offer: "Credit Card Signup", amount: "$150.00", time: "1 hour ago" },
  { id: 3, action: "New lead", offer: "Insurance Quote", amount: "$8.50", time: "3 hours ago" },
];

const topOffers = [
  { id: 1, name: "Mobile Game Install", clicks: 1250, conversions: 89, revenue: "$2,225", conversionRate: "7.1%" },
  { id: 2, name: "Credit Card Signup", clicks: 890, conversions: 12, revenue: "$1,800", conversionRate: "1.3%" },
  { id: 3, name: "Insurance Quote", clicks: 2100, conversions: 156, revenue: "$1,326", conversionRate: "7.4%" },
];

/* -------------------------
   Dashboard Component
------------------------- */
const DashboardContent = () => {
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
          value="$45,234"
          change="+12.5% from last month"
          changeType="positive"
          icon={DollarSign}
        />
        <KPIWidget
          title="Total Clicks"
          value="125,430"
          change="+8.2% from last month"
          changeType="positive"
          icon={MousePointer}
        />
        <KPIWidget
          title="Conversions"
          value="3,245"
          change="-2.4% from last month"
          changeType="negative"
          icon={Target}
        />
        <KPIWidget
          title="Active Offers"
          value="89"
          change="+5 new offers"
          changeType="positive"
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
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="clicks" fill="hsl(var(--primary))" />
                <Bar dataKey="conversions" fill="hsl(var(--secondary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity) => (
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
              ))}
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
        </CardContent>
      </Card>
    </div>
  );
};

/* -------------------------
   Main Dashboard Component
------------------------- */
const Dashboard = () => {
  return <DashboardContent />;
};

export default Dashboard;
