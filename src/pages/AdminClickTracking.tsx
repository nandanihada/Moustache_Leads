import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Clock, MapPin, Smartphone, Globe, Shield, Zap } from 'lucide-react';
import { API_BASE_URL } from '../services/apiConfig';
import { AdminPageGuard } from '@/components/AdminPageGuard';

interface Click {
  click_id: string;
  user_id: string;
  publisher_id: string;
  publisher_name?: string;
  offer_id: string;
  offer_name: string;
  placement_id: string;
  timestamp: string;
  event_type?: 'click' | 'conversion';
  payout_amount?: number;
  points_awarded?: number;
  device: {
    type?: string;
    model?: string;
    os?: string;
    browser?: string;
  };
  network: {
    ip_address?: string;
    asn?: string;
    isp?: string;
    organization?: string;
  };
  geo: {
    country?: string;
    region?: string;
    city?: string;
    postal_code?: string;
    latitude?: number;
    longitude?: number;
  };
  fraud_indicators: {
    fraud_status?: string;
    fraud_score?: number;
    duplicate_click?: boolean;
    fast_click?: boolean;
    bot_like?: boolean;
    vpn_detected?: boolean;
    proxy_detected?: boolean;
  };
}

interface ClickDetails extends Click {
  device: {
    type?: string;
    model?: string;
    os?: string;
    os_version?: string;
    browser?: string;
    browser_version?: string;
    screen_resolution?: string;
    screen_dpi?: number;
    timezone?: string;
    language?: string;
  };
  fingerprint: {
    user_agent_hash?: string;
    canvas?: string;
    webgl?: string;
    fonts?: string;
    plugins?: string;
  };
  network: {
    ip_address?: string;
    ip_version?: string;
    asn?: string;
    isp?: string;
    organization?: string;
    proxy_detected?: boolean;
    vpn_detected?: boolean;
    tor_detected?: boolean;
    datacenter_detected?: boolean;
    connection_type?: string;
  };
  geo: {
    country?: string;
    country_code?: string;
    region?: string;
    city?: string;
    postal_code?: string;
    latitude?: number;
    longitude?: number;
    timezone?: string;
  };
  fraud_indicators: {
    duplicate_detected?: boolean;
    fast_click?: boolean;
    vpn_proxy?: boolean;
    bot_like?: boolean;
    fraud_score?: number;
    fraud_status?: string;
  };
}

function AdminClickTracking() {
  const [activeTab, setActiveTab] = useState('all-clicks');
  const [trackingSource, setTrackingSource] = useState<'offerwall' | 'dashboard'>('offerwall');
  const [clicks, setClicks] = useState<Click[]>([]);
  const [dashboardClicks, setDashboardClicks] = useState<Click[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedClick, setSelectedClick] = useState<ClickDetails | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [searchUserId, setSearchUserId] = useState('');
  const [searchPublisherId, setSearchPublisherId] = useState('');
  const [searchOfferId, setSearchOfferId] = useState('');
  const [userTimeline, setUserTimeline] = useState<Click[]>([]);
  const [publisherTimeline, setPublisherTimeline] = useState<Click[]>([]);

  const token = localStorage.getItem('token');

  // Fetch all clicks
  const fetchAllClicks = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/offerwall/click-history?limit=50`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await response.json();
      setClicks(data.data || []);
    } catch (error) {
      console.error('Error fetching clicks:', error);
    }
    setLoading(false);
  };

  // Fetch dashboard clicks (from offers page)
  const fetchDashboardClicks = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/dashboard/click-history?limit=50`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await response.json();
      setDashboardClicks(data.data || []);
    } catch (error) {
      console.error('Error fetching dashboard clicks:', error);
    }
    setLoading(false);
  };

  // Fetch clicks by user
  const fetchClicksByUser = async () => {
    if (!searchUserId) return;
    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/offerwall/click-history?user_id=${searchUserId}&limit=50`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await response.json();
      setClicks(data.data || []);
    } catch (error) {
      console.error('Error fetching user clicks:', error);
    }
    setLoading(false);
  };

  // Fetch clicks by publisher
  const fetchClicksByPublisher = async () => {
    if (!searchPublisherId) return;
    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/offerwall/click-history?publisher_id=${searchPublisherId}&limit=50`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await response.json();
      setClicks(data.data || []);
    } catch (error) {
      console.error('Error fetching publisher clicks:', error);
    }
    setLoading(false);
  };

  // Fetch clicks by offer
  const fetchClicksByOffer = async () => {
    if (!searchOfferId) return;
    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/offerwall/click-history?offer_id=${searchOfferId}&limit=50`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await response.json();
      setClicks(data.data || []);
    } catch (error) {
      console.error('Error fetching offer clicks:', error);
    }
    setLoading(false);
  };

  // Fetch user timeline
  const fetchUserTimeline = async (userId: string) => {
    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/offerwall/user-timeline/${userId}?limit=100`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await response.json();
      setUserTimeline(data.timeline || []);
    } catch (error) {
      console.error('Error fetching user timeline:', error);
    }
    setLoading(false);
  };

  // Fetch publisher timeline
  const fetchPublisherTimeline = async (publisherId: string) => {
    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/offerwall/publisher-timeline/${publisherId}?limit=100`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await response.json();
      setPublisherTimeline(data.timeline || []);
    } catch (error) {
      console.error('Error fetching publisher timeline:', error);
    }
    setLoading(false);
  };

  // Fetch click details
  const fetchClickDetails = async (clickId: string, source: 'offerwall' | 'dashboard' = 'offerwall') => {
    try {
      const endpoint = source === 'dashboard' 
        ? `${API_BASE_URL}/api/admin/dashboard/click-details/${clickId}`
        : `${API_BASE_URL}/api/admin/offerwall/click-details/${clickId}`;
      
      const response = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setSelectedClick(data.data);
      setShowDetailsModal(true);
    } catch (error) {
      console.error('Error fetching click details:', error);
    }
  };

  // Load all clicks on mount
  useEffect(() => {
    fetchAllClicks();
    fetchDashboardClicks();
  }, []);

  const getFraudBadgeColor = (status?: string) => {
    switch (status) {
      case 'clean':
        return 'bg-green-100 text-green-800';
      case 'suspicious':
        return 'bg-yellow-100 text-yellow-800';
      case 'blocked':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Click Tracking</h1>
        <p className="text-gray-500 mt-2">View detailed information about all clicks</p>
      </div>

      {/* Source Selector - Offerwall vs Dashboard */}
      <div className="flex gap-4 mb-4">
        <Button
          variant={trackingSource === 'offerwall' ? 'default' : 'outline'}
          onClick={() => setTrackingSource('offerwall')}
          className="flex items-center gap-2"
        >
          <Globe className="h-4 w-4" />
          Offerwall Clicks
        </Button>
        <Button
          variant={trackingSource === 'dashboard' ? 'default' : 'outline'}
          onClick={() => setTrackingSource('dashboard')}
          className="flex items-center gap-2"
        >
          <Zap className="h-4 w-4" />
          Dashboard/Offers Page Clicks
        </Button>
      </div>

      {/* Dashboard Clicks Section */}
      {trackingSource === 'dashboard' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Dashboard Offer Clicks
            </CardTitle>
            <CardDescription>
              Clicks from users browsing offers on the dashboard/offers page (not from offerwall iframe)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={fetchDashboardClicks} disabled={loading} className="mb-4">
              {loading ? 'Loading...' : 'Refresh'}
            </Button>

            {dashboardClicks.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <AlertCircle className="mx-auto mb-2 h-8 w-8" />
                <p>No dashboard clicks found</p>
                <p className="text-sm mt-2">Clicks will appear here when users click offers from the Offers page</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Offer</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Device</TableHead>
                      <TableHead>Country</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboardClicks.map((click) => (
                      <TableRow key={click.click_id}>
                        <TableCell className="font-mono text-sm">{click.user_id || 'Anonymous'}</TableCell>
                        <TableCell className="text-sm">{(click as any).user_email || 'N/A'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{(click as any).user_role || 'user'}</Badge>
                        </TableCell>
                        <TableCell>{click.offer_name}</TableCell>
                        <TableCell className="text-sm">
                          {formatDate(click.timestamp)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Smartphone className="h-4 w-4" />
                            {click.device?.type || 'Unknown'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Globe className="h-4 w-4" />
                            {click.geo?.country || 'Unknown'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => fetchClickDetails(click.click_id, 'dashboard')}
                          >
                            Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Offerwall Clicks Section */}
      {trackingSource === 'offerwall' && (
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="all-clicks">All Clicks</TabsTrigger>
          <TabsTrigger value="by-user">By User</TabsTrigger>
          <TabsTrigger value="by-publisher">By Publisher</TabsTrigger>
          <TabsTrigger value="by-offer">By Offer</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        {/* All Clicks Tab */}
        <TabsContent value="all-clicks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Recent Clicks</CardTitle>
              <CardDescription>View all clicks from all users and publishers</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={fetchAllClicks} disabled={loading} className="mb-4">
                {loading ? 'Loading...' : 'Refresh'}
              </Button>

              {clicks.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <AlertCircle className="mx-auto mb-2 h-8 w-8" />
                  <p>No clicks found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Event Type</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Publisher</TableHead>
                        <TableHead>Offer</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Device</TableHead>
                        <TableHead>Country</TableHead>
                        <TableHead>Fraud</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clicks.map((click) => (
                        <TableRow key={click.click_id}>
                          <TableCell>
                            <Badge variant={click.event_type === 'conversion' ? 'default' : 'secondary'}>
                              {click.event_type === 'conversion' ? '✓ Conversion' : 'Click'}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{click.user_id}</TableCell>
                          <TableCell className="font-mono text-sm">{click.publisher_id}</TableCell>
                          <TableCell>{click.offer_name}</TableCell>
                          <TableCell className="text-sm">
                            {formatDate(click.timestamp)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Smartphone className="h-4 w-4" />
                              {click.device?.type || 'Unknown'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Globe className="h-4 w-4" />
                              {click.geo?.country || 'Unknown'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={getFraudBadgeColor(click.fraud_indicators?.fraud_status)}>
                              {click.fraud_indicators?.fraud_status || 'Unknown'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => fetchClickDetails(click.click_id)}
                            >
                              Details
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* By User Tab */}
        <TabsContent value="by-user" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Clicks by User</CardTitle>
              <CardDescription>Search for clicks from a specific user</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Enter User ID..."
                  value={searchUserId}
                  onChange={(e) => setSearchUserId(e.target.value)}
                />
                <Button onClick={fetchClicksByUser} disabled={loading || !searchUserId}>
                  {loading ? 'Loading...' : 'Search'}
                </Button>
              </div>

              {clicks.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <AlertCircle className="mx-auto mb-2 h-8 w-8" />
                  <p>No clicks found for this user</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Offer</TableHead>
                        <TableHead>Publisher</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Device</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clicks.map((click) => (
                        <TableRow key={click.click_id}>
                          <TableCell>{click.offer_name}</TableCell>
                          <TableCell className="font-mono text-sm">{click.publisher_id}</TableCell>
                          <TableCell className="text-sm">
                            {formatDate(click.timestamp)}
                          </TableCell>
                          <TableCell>{click.device?.type || 'Unknown'}</TableCell>
                          <TableCell>
                            {click.geo?.city}, {click.geo?.country}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => fetchClickDetails(click.click_id)}
                            >
                              Details
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* By Publisher Tab */}
        <TabsContent value="by-publisher" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Clicks by Publisher</CardTitle>
              <CardDescription>Search for clicks from a specific publisher</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Enter Publisher ID..."
                  value={searchPublisherId}
                  onChange={(e) => setSearchPublisherId(e.target.value)}
                />
                <Button onClick={fetchClicksByPublisher} disabled={loading || !searchPublisherId}>
                  {loading ? 'Loading...' : 'Search'}
                </Button>
              </div>

              {clicks.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <AlertCircle className="mx-auto mb-2 h-8 w-8" />
                  <p>No clicks found for this publisher</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Offer</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Device</TableHead>
                        <TableHead>Fraud Status</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clicks.map((click) => (
                        <TableRow key={click.click_id}>
                          <TableCell className="font-mono text-sm">{click.user_id}</TableCell>
                          <TableCell>{click.offer_name}</TableCell>
                          <TableCell className="text-sm">
                            {formatDate(click.timestamp)}
                          </TableCell>
                          <TableCell>{click.device?.type || 'Unknown'}</TableCell>
                          <TableCell>
                            <Badge className={getFraudBadgeColor(click.fraud_indicators?.fraud_status)}>
                              {click.fraud_indicators?.fraud_status || 'Unknown'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => fetchClickDetails(click.click_id)}
                            >
                              Details
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* By Offer Tab */}
        <TabsContent value="by-offer" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Clicks by Offer</CardTitle>
              <CardDescription>Search for clicks on a specific offer</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Enter Offer ID..."
                  value={searchOfferId}
                  onChange={(e) => setSearchOfferId(e.target.value)}
                />
                <Button onClick={fetchClicksByOffer} disabled={loading || !searchOfferId}>
                  {loading ? 'Loading...' : 'Search'}
                </Button>
              </div>

              {clicks.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <AlertCircle className="mx-auto mb-2 h-8 w-8" />
                  <p>No clicks found for this offer</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Publisher</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Device</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clicks.map((click) => (
                        <TableRow key={click.click_id}>
                          <TableCell className="font-mono text-sm">{click.user_id}</TableCell>
                          <TableCell className="font-mono text-sm">{click.publisher_id}</TableCell>
                          <TableCell className="text-sm">
                            {formatDate(click.timestamp)}
                          </TableCell>
                          <TableCell>{click.device?.type || 'Unknown'}</TableCell>
                          <TableCell>
                            {click.geo?.city}, {click.geo?.country}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => fetchClickDetails(click.click_id)}
                            >
                              Details
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* User Timeline */}
            <Card>
              <CardHeader>
                <CardTitle>User Click Timeline</CardTitle>
                <CardDescription>View user's click history chronologically</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter User ID..."
                    value={searchUserId}
                    onChange={(e) => setSearchUserId(e.target.value)}
                  />
                  <Button
                    onClick={() => fetchUserTimeline(searchUserId)}
                    disabled={loading || !searchUserId}
                  >
                    Load
                  </Button>
                </div>

                {userTimeline.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Clock className="mx-auto mb-2 h-8 w-8" />
                    <p>No timeline data</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {userTimeline.map((click, idx) => (
                      <div key={idx} className="border rounded-lg p-3 hover:bg-gray-50">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold">{click.offer_name}</p>
                            <p className="text-sm text-gray-600">{click.publisher_id}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {formatDate(click.timestamp)}
                            </p>
                          </div>
                          <Badge className={getFraudBadgeColor(click.fraud_indicators?.fraud_status)}>
                            {click.fraud_indicators?.fraud_status || 'Unknown'}
                          </Badge>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2 w-full"
                          onClick={() => fetchClickDetails(click.click_id)}
                        >
                          View Details
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Publisher Timeline */}
            <Card>
              <CardHeader>
                <CardTitle>Publisher Click Timeline</CardTitle>
                <CardDescription>View publisher's click history chronologically</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter Publisher ID..."
                    value={searchPublisherId}
                    onChange={(e) => setSearchPublisherId(e.target.value)}
                  />
                  <Button
                    onClick={() => fetchPublisherTimeline(searchPublisherId)}
                    disabled={loading || !searchPublisherId}
                  >
                    Load
                  </Button>
                </div>

                {publisherTimeline.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Clock className="mx-auto mb-2 h-8 w-8" />
                    <p>No timeline data</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {publisherTimeline.map((click, idx) => (
                      <div key={idx} className="border rounded-lg p-3 hover:bg-gray-50">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold">{click.offer_name}</p>
                            <p className="text-sm text-gray-600">{click.user_id}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {formatDate(click.timestamp)}
                            </p>
                          </div>
                          <Badge className={getFraudBadgeColor(click.fraud_indicators?.fraud_status)}>
                            {click.fraud_indicators?.fraud_status || 'Unknown'}
                          </Badge>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2 w-full"
                          onClick={() => fetchClickDetails(click.click_id)}
                        >
                          View Details
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
      )}

      {/* Click Details Modal */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Click Details</DialogTitle>
            <DialogDescription>Complete information about this click</DialogDescription>
          </DialogHeader>

          {selectedClick && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold text-sm text-gray-600">Click ID</h3>
                  <p className="font-mono text-sm mt-1">{selectedClick.click_id}</p>
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-gray-600">User ID</h3>
                  <p className="font-mono text-sm mt-1">{selectedClick.user_id}</p>
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-gray-600">Publisher ID</h3>
                  <p className="font-mono text-sm mt-1">{selectedClick.publisher_id}</p>
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-gray-600">Publisher Name</h3>
                  <p className="text-sm mt-1">{selectedClick.publisher_name || 'Unknown'}</p>
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-gray-600">Offer</h3>
                  <p className="font-mono text-sm mt-1">{selectedClick.offer_name}</p>
                </div>
                <div className="col-span-2">
                  <h3 className="font-semibold text-sm text-gray-600">Time</h3>
                  <p className="text-sm mt-1">{formatDate(selectedClick.timestamp)}</p>
                </div>
              </div>

              {/* Device Info */}
              <div className="border-t pt-4">
                <h3 className="font-semibold flex items-center gap-2 mb-3">
                  <Smartphone className="h-4 w-4" />
                  Device Information
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Type:</span>
                    <p className="font-mono">{selectedClick.device?.type || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Model:</span>
                    <p className="font-mono">{selectedClick.device?.model || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">OS:</span>
                    <p className="font-mono">
                      {selectedClick.device?.os} {selectedClick.device?.os_version}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Browser:</span>
                    <p className="font-mono">
                      {selectedClick.device?.browser} {selectedClick.device?.browser_version}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Screen:</span>
                    <p className="font-mono">{selectedClick.device?.screen_resolution || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Timezone:</span>
                    <p className="font-mono">{selectedClick.device?.timezone || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Network Info */}
              <div className="border-t pt-4">
                <h3 className="font-semibold flex items-center gap-2 mb-3">
                  <Zap className="h-4 w-4" />
                  Network Information
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">IP Address:</span>
                    <p className="font-mono">{selectedClick.network?.ip_address || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">ASN:</span>
                    <p className="font-mono">{selectedClick.network?.asn || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">ISP:</span>
                    <p className="font-mono">{selectedClick.network?.isp || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Organization:</span>
                    <p className="font-mono">{selectedClick.network?.organization || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Geo Location */}
              <div className="border-t pt-4">
                <h3 className="font-semibold flex items-center gap-2 mb-3">
                  <MapPin className="h-4 w-4" />
                  Geo-Location
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Country:</span>
                    <p className="font-mono">
                      {selectedClick.geo?.country} ({selectedClick.geo?.country_code})
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Region:</span>
                    <p className="font-mono">{selectedClick.geo?.region || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">City:</span>
                    <p className="font-mono">{selectedClick.geo?.city || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Postal Code:</span>
                    <p className="font-mono">{selectedClick.geo?.postal_code || 'N/A'}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-600">Coordinates:</span>
                    <p className="font-mono">
                      {selectedClick.geo?.latitude}, {selectedClick.geo?.longitude}
                    </p>
                  </div>
                </div>
              </div>

              {/* Fraud Indicators */}
              <div className="border-t pt-4">
                <h3 className="font-semibold flex items-center gap-2 mb-3">
                  <Shield className="h-4 w-4" />
                  Fraud Indicators
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Fraud Status:</span>
                    <p className="mt-1">
                      <Badge className={getFraudBadgeColor(selectedClick.fraud_indicators?.fraud_status)}>
                        {selectedClick.fraud_indicators?.fraud_status || 'Unknown'}
                      </Badge>
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Fraud Score:</span>
                    <p className="font-mono">{selectedClick.fraud_indicators?.fraud_score || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Duplicate Detected:</span>
                    <p className="font-mono">
                      {selectedClick.fraud_indicators?.duplicate_click ? 'Yes' : 'No'}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Fast Click:</span>
                    <p className="font-mono">
                      {selectedClick.fraud_indicators?.fast_click ? 'Yes' : 'No'}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">VPN Detected:</span>
                    <p className="font-mono">
                      {selectedClick.fraud_indicators?.vpn_detected ? 'Yes' : 'No'}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Proxy Detected:</span>
                    <p className="font-mono">
                      {selectedClick.fraud_indicators?.proxy_detected ? 'Yes' : 'No'}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Bot-like:</span>
                    <p className="font-mono">
                      {selectedClick.fraud_indicators?.bot_like ? 'Yes' : 'No'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Security Checks */}
              <div className="border-t pt-4">
                <h3 className="font-semibold flex items-center gap-2 mb-3">
                  <Shield className="h-4 w-4" />
                  Security Checks
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">VPN Detected:</span>
                    <p className="font-mono">
                      {selectedClick.network?.vpn_detected ? 'Yes' : 'No'}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Proxy Detected:</span>
                    <p className="font-mono">
                      {selectedClick.network?.proxy_detected ? 'Yes' : 'No'}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Tor Detected:</span>
                    <p className="font-mono">
                      {selectedClick.network?.tor_detected ? 'Yes' : 'No'}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Datacenter Detected:</span>
                    <p className="font-mono">
                      {selectedClick.network?.datacenter_detected ? 'Yes' : 'No'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

const AdminClickTrackingWithGuard = () => (
  <AdminPageGuard requiredTab="click-tracking">
    <AdminClickTracking />
  </AdminPageGuard>
);

export default AdminClickTrackingWithGuard;

