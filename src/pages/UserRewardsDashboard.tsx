import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Trophy,
  Coins,
  TrendingUp,
  Gift,
  Star,
  Target,
  RefreshCw,
  History,
  Award
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface UserPoints {
  user_id: string;
  total_points: number;
  available_points: number;
  redeemed_points: number;
  pending_points: number;
}

interface CompletedOffer {
  _id: string;
  user_id: string;
  offer_id: string;
  offer_name: string;
  payout_amount: number;
  points_awarded: number;
  completion_time: string;
  status: string;
}

interface UserStats {
  total_offers_completed: number;
  total_earnings: number;
  average_payout_per_offer: number;
}

const UserRewardsDashboard: React.FC = () => {
  const { user } = useAuth();
  const [userPoints, setUserPoints] = useState<UserPoints | null>(null);
  const [completedOffers, setCompletedOffers] = useState<CompletedOffer[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch user points
  const fetchUserPoints = async () => {
    try {
      if (!user?.username) {
        console.warn('No user logged in');
        return;
      }

      const token = localStorage.getItem('token');
      const response = await fetch(`/api/user/offerwall/points?user_id=${user.username}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error('Failed to fetch points');

      const data = await response.json();
      if (data.success) {
        setUserPoints(data.data);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err) {
      console.error('Error fetching points:', err);
      // Don't fail the whole dashboard if points fail
    }
  };

  // Fetch completed offers
  const fetchCompletedOffers = async () => {
    try {
      if (!user?.username) {
        console.warn('No user logged in');
        return;
      }

      const token = localStorage.getItem('token');
      const response = await fetch(`/api/user/offerwall/completed-offers?user_id=${user.username}&limit=10`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error('Failed to fetch completed offers');

      const data = await response.json();
      if (data.success) {
        setCompletedOffers(data.data.completed_offers);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err) {
      console.error('Error fetching completed offers:', err);
      // Don't fail the whole dashboard if offers fail
    }
  };

  // Fetch user stats
  const fetchUserStats = async () => {
    try {
      if (!user?.username) {
        console.warn('No user logged in');
        return;
      }

      const token = localStorage.getItem('token');
      // Note: placement_id might need to be dynamic or removed
      const response = await fetch(`/api/user/offerwall/stats?user_id=${user.username}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error('Failed to fetch stats');

      const data = await response.json();
      if (data.success) {
        setUserStats(data.data.stats);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
      // Don't fail the whole dashboard if stats fail
    }
  };

  // Refresh all data
  const refreshData = async () => {
    setRefreshing(true);
    await Promise.all([fetchUserPoints(), fetchCompletedOffers(), fetchUserStats()]);
    setRefreshing(false);
  };

  // Initial data load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await refreshData();
      setLoading(false);
    };

    loadData();
  }, []);

  // Calculate membership tier
  const getMembershipTier = (points: number) => {
    if (points >= 10000) return { name: 'Platinum', color: 'bg-purple-500', progress: 100 };
    if (points >= 5000) return { name: 'Gold', color: 'bg-yellow-500', progress: (points / 10000) * 100 };
    if (points >= 1000) return { name: 'Silver', color: 'bg-gray-500', progress: (points / 5000) * 100 };
    return { name: 'Bronze', color: 'bg-orange-500', progress: (points / 1000) * 100 };
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading rewards dashboard...</span>
        </div>
      </div>
    );
  }

  const tier = userPoints ? getMembershipTier(userPoints.total_points) : null;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Rewards Dashboard</h1>
          <p className="text-muted-foreground">Track your points and earnings</p>
        </div>
        <Button onClick={refreshData} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Points Overview */}
      {userPoints && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Available Points</CardTitle>
              <Coins className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{userPoints.available_points.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Ready to redeem</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Points</CardTitle>
              <Trophy className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{userPoints.total_points.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">All time earned</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Redeemed Points</CardTitle>
              <Gift className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{userPoints.redeemed_points.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Points spent</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Points</CardTitle>
              <History className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{userPoints.pending_points.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Processing</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Membership Tier */}
      {tier && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Award className="h-5 w-5" />
              <span>Membership Tier: {tier.name}</span>
            </CardTitle>
            <CardDescription>Your current membership status and benefits</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Progress to next tier</span>
                  <span>{tier.progress.toFixed(1)}%</span>
                </div>
                <Progress value={tier.progress} className="h-2" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <Badge className={tier.color}>Current Tier</Badge>
                  <p className="mt-2 text-sm">{tier.name} Member</p>
                </div>
                <div className="text-center">
                  <Star className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
                  <p className="text-sm">Bonus Multiplier</p>
                  <p className="font-bold">1.0x</p>
                </div>
                <div className="text-center">
                  <Target className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                  <p className="text-sm">Next Milestone</p>
                  <p className="font-bold">
                    {tier.name === 'Platinum' ? 'Max Tier' : `${tier.progress < 100 ? Math.ceil((100 - tier.progress) * 100) : 0} points`}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="history">Offer History</TabsTrigger>
          <TabsTrigger value="rewards">Redeem Rewards</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Performance Stats</CardTitle>
                <CardDescription>Your offerwall performance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {userStats && (
                    <>
                      <div className="flex justify-between">
                        <span>Offers Completed</span>
                        <span className="font-bold">{userStats.total_offers_completed}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Earnings</span>
                        <span className="font-bold">${userStats.total_earnings.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Avg Payout per Offer</span>
                        <span className="font-bold">${userStats.average_payout_per_offer.toFixed(2)}</span>
                      </div>
                    </>
                  )}
                  {!userStats && (
                    <p className="text-muted-foreground">No stats available yet</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Common tasks and shortcuts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Button className="w-full justify-start">
                    <Trophy className="h-4 w-4 mr-2" />
                    View Leaderboard
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <Gift className="h-4 w-4 mr-2" />
                    Redeem Points
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <History className="h-4 w-4 mr-2" />
                    View History
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Completed Offers</CardTitle>
              <CardDescription>Your recent offer completions</CardDescription>
            </CardHeader>
            <CardContent>
              {completedOffers.length > 0 ? (
                <div className="space-y-4">
                  {completedOffers.map((offer) => (
                    <div key={offer._id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <h4 className="font-semibold">{offer.offer_name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {new Date(offer.completion_time).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{offer.points_awarded} points</p>
                        <p className="text-sm text-muted-foreground">${offer.payout_amount.toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No completed offers yet</p>
                  <p className="text-sm">Start completing offers to earn points!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rewards" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Redeem Rewards</CardTitle>
              <CardDescription>Exchange your points for rewards</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Gift className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Rewards catalog coming soon</p>
                <p className="text-sm">You'll be able to redeem your points here</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default UserRewardsDashboard;
