import { useState } from "react";
import { Search, Download, Eye, Upload, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const assets = [
  {
    id: "AST001",
    name: "Mobile Game Banner",
    type: "Banner",
    format: "PNG",
    dimensions: "728x90",
    size: "45 KB",
    downloads: 1250,
    thumbnail: "🎮",
    category: "Gaming"
  },
  {
    id: "AST002",
    name: "Credit Card Promo Video",
    type: "Video",
    format: "MP4",
    dimensions: "1920x1080",
    size: "12.5 MB",
    downloads: 890,
    thumbnail: "🎬",
    category: "Finance"
  },
  {
    id: "AST003",
    name: "Insurance Quote Form",
    type: "Landing Page",
    format: "HTML",
    dimensions: "Responsive",
    size: "2.3 MB",
    downloads: 456,
    thumbnail: "📄",
    category: "Insurance"
  },
  {
    id: "AST004",
    name: "Social Media Kit",
    type: "Kit",
    format: "ZIP",
    dimensions: "Various",
    size: "8.7 MB",
    downloads: 234,
    thumbnail: "📱",
    category: "Social"
  }
];

const Assets = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const filteredAssets = assets.filter(asset => {
    const matchesSearch = 
      asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "all" || asset.category.toLowerCase() === categoryFilter;
    const matchesType = typeFilter === "all" || asset.type.toLowerCase() === typeFilter;
    
    return matchesSearch && matchesCategory && matchesType;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Assets</h1>
        <p className="text-muted-foreground">Manage your creative assets and marketing materials</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Asset Library</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-4 items-center">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search assets..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="gaming">Gaming</SelectItem>
                  <SelectItem value="finance">Finance</SelectItem>
                  <SelectItem value="insurance">Insurance</SelectItem>
                  <SelectItem value="social">Social</SelectItem>
                </SelectContent>
              </Select>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="banner">Banner</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="landing page">Landing Page</SelectItem>
                  <SelectItem value="kit">Kit</SelectItem>
                </SelectContent>
              </Select>

              <Button>
                <Upload className="h-4 w-4 mr-2" />
                Upload Asset
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredAssets.map((asset) => (
                <Card key={asset.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="aspect-video bg-muted rounded-lg flex items-center justify-center text-4xl">
                        {asset.thumbnail}
                      </div>
                      
                      <div>
                        <h3 className="font-medium text-sm truncate">{asset.name}</h3>
                        <p className="text-xs text-muted-foreground">{asset.id}</p>
                      </div>
                      
                      <div className="flex gap-2">
                        <Badge variant="outline" className="text-xs">{asset.type}</Badge>
                        <Badge variant="secondary" className="text-xs">{asset.category}</Badge>
                      </div>
                      
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <div className="flex justify-between">
                          <span>Format:</span>
                          <span>{asset.format}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Size:</span>
                          <span>{asset.size}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Dimensions:</span>
                          <span>{asset.dimensions}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Downloads:</span>
                          <span>{asset.downloads}</span>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" className="flex-1">
                          <Eye className="h-3 w-3 mr-1" />
                          View
                        </Button>
                        <Button size="sm" variant="ghost" className="flex-1">
                          <Download className="h-3 w-3 mr-1" />
                          Download
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Assets;