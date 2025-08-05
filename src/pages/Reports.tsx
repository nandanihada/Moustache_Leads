import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line 
} from "recharts";

const conversionData = [
  { date: "2024-01-01", clicks: 1200, conversions: 84, revenue: 2100 },
  { date: "2024-01-02", clicks: 980, conversions: 67, revenue: 1675 },
  { date: "2024-01-03", clicks: 1450, conversions: 102, revenue: 2550 },
  { date: "2024-01-04", clicks: 1100, conversions: 78, revenue: 1950 },
  { date: "2024-01-05", clicks: 1350, conversions: 95, revenue: 2375 },
];

const placementData = [
  { name: "Banner - Top Header", clicks: 5420, conversions: 342, revenue: 8550, reversals: 12 },
  { name: "Pop-under - Exit Intent", clicks: 3210, conversions: 189, revenue: 4725, reversals: 8 },
  { name: "Native Ad - Content Feed", clicks: 4150, conversions: 267, revenue: 6675, reversals: 15 },
  { name: "Email Campaign", clicks: 2890, conversions: 145, revenue: 3625, reversals: 5 },
];

const countryData = [
  { country: "🇺🇸 United States", clicks: 8950, conversions: 567, revenue: 14175, percentage: "45%" },
  { country: "🇬🇧 United Kingdom", clicks: 4230, conversions: 234, revenue: 5850, percentage: "25%" },
  { country: "🇨🇦 Canada", clicks: 3120, conversions: 178, revenue: 4450, percentage: "18%" },
  { country: "🇦🇺 Australia", clicks: 1890, conversions: 98, revenue: 2450, percentage: "12%" },
];

const reversalData = [
  { id: "REV001", offer: "Mobile Game Install", amount: "$25.00", reason: "Fraud", date: "2024-01-05" },
  { id: "REV002", offer: "Credit Card Signup", amount: "$150.00", reason: "Chargeback", date: "2024-01-04" },
  { id: "REV003", offer: "Insurance Quote", amount: "$8.50", reason: "Invalid Lead", date: "2024-01-03" },
];

const postbackData = [
  { id: "PB001", url: "https://tracker.example.com/postback", status: "Success", timestamp: "2024-01-05 14:30", response: "200 OK" },
  { id: "PB002", url: "https://affiliate.example.com/conversion", status: "Failed", timestamp: "2024-01-05 14:25", response: "404 Not Found" },
  { id: "PB003", url: "https://network.example.com/track", status: "Success", timestamp: "2024-01-05 14:20", response: "200 OK" },
];

const Reports = () => {
  const [activeTab, setActiveTab] = useState("conversion");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Reports</h1>
        <p className="text-muted-foreground">Detailed analytics and performance reports</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Analytics Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="conversion">Conversion</TabsTrigger>
              <TabsTrigger value="placement">Placement</TabsTrigger>
              <TabsTrigger value="countries">Countries</TabsTrigger>
              <TabsTrigger value="reversal">Reversal</TabsTrigger>
              <TabsTrigger value="postbacks">Postbacks</TabsTrigger>
            </TabsList>

            <TabsContent value="conversion" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Conversion Trends</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={conversionData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="clicks" stroke="hsl(var(--primary))" strokeWidth={2} />
                      <Line type="monotone" dataKey="conversions" stroke="hsl(var(--secondary))" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="placement" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Placement Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={placementData}>
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

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Placement Name</TableHead>
                    <TableHead>Clicks</TableHead>
                    <TableHead>Conversions</TableHead>
                    <TableHead>Reversals</TableHead>
                    <TableHead>Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {placementData.map((placement, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{placement.name}</TableCell>
                      <TableCell>{placement.clicks.toLocaleString()}</TableCell>
                      <TableCell>{placement.conversions}</TableCell>
                      <TableCell>{placement.reversals}</TableCell>
                      <TableCell className="text-primary font-medium">${placement.revenue.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="countries" className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Country</TableHead>
                    <TableHead>Clicks</TableHead>
                    <TableHead>Conversions</TableHead>
                    <TableHead>Revenue</TableHead>
                    <TableHead>Share</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {countryData.map((country, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{country.country}</TableCell>
                      <TableCell>{country.clicks.toLocaleString()}</TableCell>
                      <TableCell>{country.conversions}</TableCell>
                      <TableCell className="text-primary font-medium">${country.revenue.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{country.percentage}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="reversal" className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reversal ID</TableHead>
                    <TableHead>Offer</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reversalData.map((reversal) => (
                    <TableRow key={reversal.id}>
                      <TableCell className="font-mono text-sm">{reversal.id}</TableCell>
                      <TableCell>{reversal.offer}</TableCell>
                      <TableCell className="text-red-600 font-medium">{reversal.amount}</TableCell>
                      <TableCell>
                        <Badge variant="destructive">{reversal.reason}</Badge>
                      </TableCell>
                      <TableCell>{reversal.date}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="postbacks" className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Postback ID</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Response</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {postbackData.map((postback) => (
                    <TableRow key={postback.id}>
                      <TableCell className="font-mono text-sm">{postback.id}</TableCell>
                      <TableCell className="max-w-xs truncate">{postback.url}</TableCell>
                      <TableCell>
                        <Badge variant={postback.status === "Success" ? "default" : "destructive"}>
                          {postback.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{postback.timestamp}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{postback.response}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Reports;