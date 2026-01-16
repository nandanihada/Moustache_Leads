import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Send, Clock, CheckCircle, XCircle, Loader2, Users, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Publisher {
  user_id: string;
  username: string;
  email: string;
  postback_url: string;
  postback_method: string;
  status: string;
}

interface TestPostback {
  id: string;
  user_id: string;
  username: string;
  offer_name: string;
  points: string;
  count: string;
  interval_seconds: string;
}

interface TestLog {
  _id: string;
  test_id: string;
  user_id: string;
  username: string;
  offer_name: string;
  points: number;
  success: boolean;
  error?: string;
  status_code?: number;
  response_body?: string;
  response_time?: number;
  iteration: number;
  timestamp: string;
}

const AdminTestPostback = () => {
  const { toast } = useToast();
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [testPostbacks, setTestPostbacks] = useState<TestPostback[]>([
    { id: '1', user_id: '', username: '', offer_name: '', points: '', count: '5', interval_seconds: '10' }
  ]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [logs, setLogs] = useState<TestLog[]>([]);
  const [currentTestId, setCurrentTestId] = useState<string | null>(null);

  useEffect(() => {
    fetchPublishers();
  }, []);

  useEffect(() => {
    if (currentTestId) {
      const interval = setInterval(() => {
        fetchTestLogs(currentTestId);
      }, 3000); // Poll every 3 seconds

      return () => clearInterval(interval);
    }
  }, [currentTestId]);

  const fetchPublishers = async () => {
    try {
      setLoading(true);
      const { API_BASE_URL } = await import('../services/apiConfig');
      const token = localStorage.getItem('token');

      const response = await fetch(`${API_BASE_URL}/api/admin/test-postback/publishers`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch publishers');

      const data = await response.json();
      setPublishers(data.publishers || []);
    } catch (error) {
      console.error('Error fetching publishers:', error);
      toast({
        title: 'Error',
        description: 'Failed to load publishers with postback URLs',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTestLogs = async (testId: string) => {
    try {
      const { API_BASE_URL } = await import('../services/apiConfig');
      const token = localStorage.getItem('token');

      const response = await fetch(`${API_BASE_URL}/api/admin/test-postback/logs/${testId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch logs');

      const data = await response.json();
      setLogs(data.logs || []);
    } catch (error) {
      console.error('Error fetching logs:', error);
    }
  };

  const addPostback = () => {
    const newId = (testPostbacks.length + 1).toString();
    setTestPostbacks([
      ...testPostbacks,
      { id: newId, user_id: '', username: '', offer_name: '', points: '', count: '5', interval_seconds: '10' }
    ]);
  };

  const removePostback = (id: string) => {
    if (testPostbacks.length === 1) {
      toast({
        title: 'Cannot Remove',
        description: 'At least one postback configuration is required',
        variant: 'destructive'
      });
      return;
    }
    setTestPostbacks(testPostbacks.filter(pb => pb.id !== id));
  };

  const updatePostback = (id: string, field: keyof TestPostback, value: string) => {
    setTestPostbacks(testPostbacks.map(pb =>
      pb.id === id ? { ...pb, [field]: value } : pb
    ));
  };

  const validatePostbacks = (): boolean => {
    for (const pb of testPostbacks) {
      if (!pb.user_id) {
        toast({
          title: 'Validation Error',
          description: 'Please select a publisher for all postback configurations',
          variant: 'destructive'
        });
        return false;
      }
      if (!pb.username.trim()) {
        toast({
          title: 'Validation Error',
          description: 'Please enter a username for all postback configurations',
          variant: 'destructive'
        });
        return false;
      }
      if (!pb.offer_name.trim()) {
        toast({
          title: 'Validation Error',
          description: 'Please enter an offer name for all postback configurations',
          variant: 'destructive'
        });
        return false;
      }
      if (!pb.points || parseFloat(pb.points) <= 0) {
        toast({
          title: 'Validation Error',
          description: 'Please enter valid points (greater than 0)',
          variant: 'destructive'
        });
        return false;
      }
      if (!pb.count || parseInt(pb.count) < 1 || parseInt(pb.count) > 100) {
        toast({
          title: 'Validation Error',
          description: 'Count must be between 1 and 100',
          variant: 'destructive'
        });
        return false;
      }
      if (pb.interval_seconds && parseInt(pb.interval_seconds) < 0) {
        toast({
          title: 'Validation Error',
          description: 'Interval cannot be negative',
          variant: 'destructive'
        });
        return false;
      }
    }
    return true;
  };

  const sendTestPostbacks = async () => {
    if (!validatePostbacks()) return;

    try {
      setSending(true);
      const { API_BASE_URL } = await import('../services/apiConfig');
      const token = localStorage.getItem('token');

      const payload = {
        postbacks: testPostbacks.map(pb => ({
          user_id: pb.user_id,
          username: pb.username,
          offer_name: pb.offer_name,
          points: parseFloat(pb.points),
          count: parseInt(pb.count),
          interval_seconds: parseInt(pb.interval_seconds)
        }))
      };

      const response = await fetch(`${API_BASE_URL}/api/admin/test-postback/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send test postbacks');
      }

      const data = await response.json();
      setCurrentTestId(data.test_id);

      toast({
        title: 'Test Postbacks Scheduled',
        description: `${data.total_postbacks} test postback(s) scheduled for ${data.publishers_count} publisher(s)`,
      });

      // Start fetching logs
      setTimeout(() => fetchTestLogs(data.test_id), 1000);

    } catch (error: any) {
      console.error('Error sending test postbacks:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to send test postbacks',
        variant: 'destructive'
      });
    } finally {
      setSending(false);
    }
  };

  const getPublisherName = (userId: string) => {
    const publisher = publishers.find(p => p.user_id === userId);
    return publisher?.username || 'Unknown Publisher';
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Test Postback</h1>
        <p className="text-muted-foreground mt-2">
          Send test postbacks to registered publishers/partners for integration testing. Configure multiple publishers with different test data and intervals.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configure Test Postbacks</CardTitle>
          <CardDescription>
            Add multiple publisher configurations. Each can send multiple postbacks with custom intervals in seconds.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {testPostbacks.map((pb, index) => (
            <Card key={pb.id} className="p-4">
              <div className="flex items-start gap-4">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                  <div className="space-y-2">
                    <Label>Publisher *</Label>
                    <Select
                      value={pb.user_id}
                      onValueChange={(value) => updatePostback(pb.id, 'user_id', value)}
                      disabled={loading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select publisher" />
                      </SelectTrigger>
                      <SelectContent>
                        {publishers.length === 0 ? (
                          <div className="p-2 text-sm text-muted-foreground">
                            No publishers found
                          </div>
                        ) : (
                          publishers.map(publisher => (
                            <SelectItem key={publisher.user_id} value={publisher.user_id}>
                              {publisher.username}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Username *</Label>
                    <Input
                      placeholder="e.g., Don1"
                      value={pb.username}
                      onChange={(e) => updatePostback(pb.id, 'username', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Offer Name *</Label>
                    <Input
                      placeholder="e.g., Zen Offer"
                      value={pb.offer_name}
                      onChange={(e) => updatePostback(pb.id, 'offer_name', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Points *</Label>
                    <Input
                      type="number"
                      placeholder="e.g., 30"
                      value={pb.points}
                      onChange={(e) => updatePostback(pb.id, 'points', e.target.value)}
                      min="0"
                      step="0.01"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Count *</Label>
                    <Input
                      type="number"
                      placeholder="e.g., 5"
                      value={pb.count}
                      onChange={(e) => updatePostback(pb.id, 'count', e.target.value)}
                      min="1"
                      max="100"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Interval (seconds) *</Label>
                    <Input
                      type="number"
                      placeholder="e.g., 10"
                      value={pb.interval_seconds}
                      onChange={(e) => updatePostback(pb.id, 'interval_seconds', e.target.value)}
                      min="0"
                    />
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removePostback(pb.id)}
                  disabled={testPostbacks.length === 1}
                  className="mt-8"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              
              {pb.user_id && pb.count && pb.interval_seconds && parseInt(pb.count) > 1 && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
                  <Clock className="h-4 w-4 inline mr-2 text-blue-600" />
                  <span className="text-blue-700">
                    Will send {pb.count} postbacks to {getPublisherName(pb.user_id)} over {(parseInt(pb.count) - 1) * parseInt(pb.interval_seconds)} seconds
                  </span>
                </div>
              )}
            </Card>
          ))}

          <div className="flex gap-2">
            <Button onClick={addPostback} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Add Another Publisher
            </Button>

            <Button onClick={sendTestPostbacks} disabled={sending || loading}>
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Scheduling...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Test Postbacks
                </>
              )}
            </Button>

            <Button onClick={fetchPublishers} variant="outline" disabled={loading}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {currentTestId && (
        <Card>
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
            <CardDescription>
              Test ID: {currentTestId} | Total: {logs.length} | Success: {logs.filter(l => l.success).length} | Failed: {logs.filter(l => !l.success).length}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {logs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-8 w-8 mx-auto mb-2 animate-pulse" />
                  <p>Waiting for test results...</p>
                  <p className="text-sm mt-1">First postback should arrive shortly</p>
                </div>
              ) : (
                logs.map(log => (
                  <Card key={log._id} className={log.success ? 'border-green-200' : 'border-red-200'}>
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-3">
                        {log.success ? (
                          <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                        )}
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="font-medium">
                              #{log.iteration} - {getPublisherName(log.user_id)}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {formatTimestamp(log.timestamp)}
                            </div>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            User: <span className="font-medium">{log.username}</span> | 
                            Offer: <span className="font-medium">{log.offer_name}</span> | 
                            Points: <span className="font-medium">{log.points}</span>
                          </div>
                          {log.status_code && (
                            <div className="text-sm">
                              Status Code: <span className="font-mono">{log.status_code}</span>
                              {log.response_time && (
                                <span className="ml-3">
                                  Response Time: <span className="font-mono">{log.response_time.toFixed(2)}s</span>
                                </span>
                              )}
                            </div>
                          )}
                          {log.error && (
                            <div className="text-sm text-red-600">
                              Error: {log.error}
                            </div>
                          )}
                          {log.response_body && (
                            <details className="text-sm">
                              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                View Response
                              </summary>
                              <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto">
                                {log.response_body}
                              </pre>
                            </details>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminTestPostback;
