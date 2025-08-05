import { useState } from "react";
import { Search, Play, Pause, BarChart, Settings } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const placements = [
  {
    id: "PLC001",
    name: "Banner - Homepage Header",
    type: "Display Banner",
    dimensions: "728x90",
    status: "active",
    clicks: 15420,
    conversions: 234,
    revenue: "$5,850.00",
    ctr: "1.52%",
    cr: "1.52%"
  },
  {
    id: "PLC002",
    name: "Pop-under - Exit Intent",
    type: "Pop-under",
    dimensions: "800x600",
    status: "active",
    clicks: 8930,
    conversions: 156,
    revenue: "$3,900.00",
    ctr: "2.34%",
    cr: "1.75%"
  },
  {
    id: "PLC003",
    name: "Native Ad - Article Feed",
    type: "Native",
    dimensions: "300x250",
    status: "paused",
    clicks: 12560,
    conversions: 189,
    revenue: "$4,725.00",
    ctr: "1.89%",
    cr: "1.50%"
  },
  {
    id: "PLC004",
    name: "Video Pre-roll",
    type: "Video",
    dimensions: "640x360",
    status: "active",
    clicks: 6780,
    conversions: 89,
    revenue: "$2,225.00",
    ctr: "3.21%",
    cr: "1.31%"
  }
];

const Placements = () => {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredPlacements = placements.filter(placement =>
    placement.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    placement.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    placement.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "default";
      case "paused":
        return "secondary";
      default:
        return "secondary";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Placements</h1>
        <p className="text-muted-foreground">Manage your ad placements and performance</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Placement Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-4 items-center">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search placements..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button>Create Placement</Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Placement</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Dimensions</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Clicks</TableHead>
                  <TableHead>Conversions</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead>CTR</TableHead>
                  <TableHead>CR</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPlacements.map((placement) => (
                  <TableRow key={placement.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{placement.name}</p>
                        <p className="text-sm text-muted-foreground">{placement.id}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{placement.type}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{placement.dimensions}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusColor(placement.status)}>
                        {placement.status.charAt(0).toUpperCase() + placement.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>{placement.clicks.toLocaleString()}</TableCell>
                    <TableCell>{placement.conversions}</TableCell>
                    <TableCell className="font-semibold text-primary">{placement.revenue}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{placement.ctr}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{placement.cr}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost">
                          {placement.status === "active" ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                        <Button size="sm" variant="ghost">
                          <BarChart className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost">
                          <Settings className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Placements;