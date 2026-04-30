import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Edit, CheckCircle2, BarChart3, HelpCircle, Users, Activity, Settings, Globe, Check, ChevronsUpDown, X } from 'lucide-react';
import { AdminPageGuard } from '@/components/AdminPageGuard';
import { getApiBaseUrl } from '@/services/apiConfig';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';

const AVAILABLE_COUNTRIES = [
  "US", "GB", "CA", "AU", "DE", "FR", "NL", "IT", "ES", "SE", "NO", "DK", "FI", "CH", "IN", "BR", "JP", "KR",
  "BD", "PK", "NG", "EG", "TR", "MX", "AR", "CO", "PE", "CL", "VE", "EC", "BO", "PY", "UY",
  "ZA", "KE", "GH", "TZ", "UG", "ET", "MA", "DZ", "TN", "LY", "SD",
  "ID", "MY", "TH", "VN", "PH", "SG", "MM", "KH", "LA", "BN",
  "CN", "HK", "TW", "MO",
  "RU", "UA", "PL", "RO", "CZ", "HU", "GR", "PT", "BE", "AT", "BG", "RS", "HR", "SK", "SI", "LT", "LV", "EE",
  "AE", "SA", "IL", "JO", "LB", "KW", "QA", "BH", "OM", "IQ", "YE",
  "NZ", "FJ", "PG"
];

const COUNTRY_NAMES: Record<string, string> = {
  "US": "United States", "GB": "United Kingdom", "CA": "Canada", "AU": "Australia",
  "DE": "Germany", "FR": "France", "NL": "Netherlands", "IT": "Italy", "ES": "Spain",
  "SE": "Sweden", "NO": "Norway", "DK": "Denmark", "FI": "Finland", "CH": "Switzerland",
  "IN": "India", "BR": "Brazil", "JP": "Japan", "KR": "South Korea",
  "BD": "Bangladesh", "PK": "Pakistan", "NG": "Nigeria", "EG": "Egypt", "TR": "Turkey",
  "MX": "Mexico", "AR": "Argentina", "CO": "Colombia", "PE": "Peru", "CL": "Chile",
  "VE": "Venezuela", "EC": "Ecuador", "BO": "Bolivia", "PY": "Paraguay", "UY": "Uruguay",
  "ZA": "South Africa", "KE": "Kenya", "GH": "Ghana", "TZ": "Tanzania", "UG": "Uganda",
  "ET": "Ethiopia", "MA": "Morocco", "DZ": "Algeria", "TN": "Tunisia", "LY": "Libya", "SD": "Sudan",
  "ID": "Indonesia", "MY": "Malaysia", "TH": "Thailand", "VN": "Vietnam", "PH": "Philippines",
  "SG": "Singapore", "MM": "Myanmar", "KH": "Cambodia", "LA": "Laos", "BN": "Brunei",
  "CN": "China", "HK": "Hong Kong", "TW": "Taiwan", "MO": "Macau",
  "RU": "Russia", "UA": "Ukraine", "PL": "Poland", "RO": "Romania", "CZ": "Czech Republic",
  "HU": "Hungary", "GR": "Greece", "PT": "Portugal", "BE": "Belgium", "AT": "Austria",
  "BG": "Bulgaria", "RS": "Serbia", "HR": "Croatia", "SK": "Slovakia", "SI": "Slovenia",
  "LT": "Lithuania", "LV": "Latvia", "EE": "Estonia",
  "AE": "UAE", "SA": "Saudi Arabia", "IL": "Israel", "JO": "Jordan", "LB": "Lebanon",
  "KW": "Kuwait", "QA": "Qatar", "BH": "Bahrain", "OM": "Oman", "IQ": "Iraq", "YE": "Yemen",
  "NZ": "New Zealand", "FJ": "Fiji", "PG": "Papua New Guinea"
};

const AdminPolls = () => {
  const { toast } = useToast();
  const [polls, setPolls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newQuestion, setNewQuestion] = useState('');
  
  // Settings for new poll
  const [targetCountries, setTargetCountries] = useState<string[]>([]);
  const [targetUsers, setTargetUsers] = useState<string[]>([]);
  const [requirePlacement, setRequirePlacement] = useState<string>('all');
  
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  
  // Custom options state
  const [pollOptions, setPollOptions] = useState([{id: 'yes', text: 'Yes'}, {id: 'no', text: 'No'}]);
  
  // User Filters
  const [filterCountry, setFilterCountry] = useState<string>('all');
  const [filterPlacement, setFilterPlacement] = useState<string>('all');
  const [filterVertical, setFilterVertical] = useState<string>('all');
  const [userSearchTerm, setUserSearchTerm] = useState<string>('');
  const [countrySearchTerm, setCountrySearchTerm] = useState<string>('');
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingQuestion, setEditingQuestion] = useState('');
  const [editingOptions, setEditingOptions] = useState<any[]>([]);
  const [editingCountries, setEditingCountries] = useState<string[]>([]);
  const [editingUsers, setEditingUsers] = useState<string[]>([]);
  const [editingPlacement, setEditingPlacement] = useState<string>('all');

  // Analytics states
  const [chartData, setChartData] = useState<any[]>([]);
  const [selectedPollDetails, setSelectedPollDetails] = useState<any[]>([]);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [activePollAnalytics, setActivePollAnalytics] = useState<string | null>(null);
  
  const fetchData = async () => {
    try {
      const headers = {
        'Authorization': `Bearer ${localStorage.getItem('admin_token') || localStorage.getItem('token')}`
      };
      
      const [pollsRes, usersRes, chartRes] = await Promise.all([
        fetch(`${getApiBaseUrl()}/api/admin/polls`, { headers }),
        fetch(`${getApiBaseUrl()}/api/admin/polls/targetable-users`, { headers }),
        fetch(`${getApiBaseUrl()}/api/admin/polls/analytics`, { headers })
      ]);
      
      if (pollsRes.ok) {
        const data = await pollsRes.json();
        setPolls(data.polls || []);
      }
      
      if (usersRes.ok) {
        const data = await usersRes.json();
        setAvailableUsers(data.users || []);
      }
      
      if (chartRes.ok) {
        const data = await chartRes.json();
        setChartData(data.chart_data || []);
      }
      
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to fetch dashboard data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const applyUserFilters = () => {
    let filtered = [...availableUsers];
    if (filterCountry !== 'all') {
      filtered = filtered.filter(u => u.country === filterCountry);
    }
    if (filterPlacement !== 'all') {
      const hasPlacement = filterPlacement === 'yes';
      filtered = filtered.filter(u => u.has_placement === hasPlacement);
    }
    if (filterVertical !== 'all') {
      filtered = filtered.filter(u => u.verticals && u.verticals.includes(filterVertical));
    }
    setTargetUsers(filtered.map(u => u.id));
    toast({ title: 'Filters Applied', description: `Target list updated to ${filtered.length} users.` });
  };

  // Filter available users based on search term
  const filteredAvailableUsers = useMemo(() => {
    if (!userSearchTerm) return availableUsers;
    const search = userSearchTerm.toLowerCase();
    return availableUsers.filter(u => 
      (u.username && u.username.toLowerCase().includes(search)) ||
      (u.email && u.email.toLowerCase().includes(search)) ||
      (u.country && u.country.toLowerCase().includes(search))
    );
  }, [availableUsers, userSearchTerm]);

  // Filter countries based on search term
  const filteredCountries = useMemo(() => {
    if (!countrySearchTerm) return AVAILABLE_COUNTRIES;
    const search = countrySearchTerm.toLowerCase();
    return AVAILABLE_COUNTRIES.filter(c => c.toLowerCase().includes(search));
  }, [countrySearchTerm]);

  // Get selected user details
  const selectedUserDetails = useMemo(() => {
    return availableUsers.filter(u => targetUsers.includes(u.id));
  }, [availableUsers, targetUsers]);

  const aggregatedPieData = useMemo(() => {
    let totalViews = 0;
    let totalResponses = 0;
    chartData.forEach(item => {
      totalViews += item.views;
      totalResponses += item.responses;
    });
    
    // To show the proportion of Views that resulted in Responses
    // Pie 1: Ignored (Views - Responses), Pie 2: Responded (Responses)
    const ignored = Math.max(0, totalViews - totalResponses);
    
    if (totalViews === 0 && totalResponses === 0) return [];
    return [
      { name: 'Responded', value: totalResponses, color: '#10b981' },
      { name: 'Ignored (Viewed only)', value: ignored, color: '#6366f1' }
    ];
  }, [chartData]);

  const handleCreatePoll = async () => {
    if (!newQuestion.trim()) return;
    
    const placementVal = requirePlacement === 'all' ? null : requirePlacement === 'yes' ? true : false;
    
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/admin/polls`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('admin_token') || localStorage.getItem('token')}`
        },
        body: JSON.stringify({ 
          question: newQuestion, 
          is_active: true,
          target_countries: targetCountries,
          target_users: targetUsers,
          require_placement: placementVal,
          options: pollOptions.map(opt => ({...opt, votes: 0}))
        })
      });
      if (!response.ok) throw new Error('Failed to create poll');
      toast({ title: 'Success', description: 'Poll created and activated successfully' });
      setNewQuestion('');
      setTargetCountries([]);
      setTargetUsers([]);
      setRequirePlacement('all');
      setPollOptions([{id: 'yes', text: 'Yes'}, {id: 'no', text: 'No'}]);
      fetchData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to create poll', variant: 'destructive' });
    }
  };

  const handleToggleActive = async (pollId: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/admin/polls/${pollId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('admin_token') || localStorage.getItem('token')}`
        },
        body: JSON.stringify({ is_active: !currentStatus })
      });
      if (!response.ok) throw new Error('Failed to update poll');
      toast({ title: 'Success', description: 'Poll status updated' });
      fetchData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update poll status', variant: 'destructive' });
    }
  };

  const handleUpdateQuestion = async (pollId: string) => {
    if (!editingQuestion.trim()) return;
    try {
      const placementVal = editingPlacement === 'all' ? null : editingPlacement === 'yes' ? true : false;
      
      const response = await fetch(`${getApiBaseUrl()}/api/admin/polls/${pollId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('admin_token') || localStorage.getItem('token')}`
        },
        body: JSON.stringify({ 
          question: editingQuestion, 
          options: editingOptions,
          target_countries: editingCountries,
          target_users: editingUsers,
          require_placement: placementVal
        })
      });
      if (!response.ok) throw new Error('Failed to update poll');
      toast({ title: 'Success', description: 'Poll updated' });
      setEditingId(null);
      fetchData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update poll', variant: 'destructive' });
    }
  };

  const handleDeletePoll = async (pollId: string) => {
    if (!confirm('Are you sure you want to delete this poll?')) return;
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/admin/polls/${pollId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token') || localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to delete poll');
      toast({ title: 'Success', description: 'Poll deleted' });
      fetchData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete poll', variant: 'destructive' });
    }
  };

  const fetchPollDetails = async (pollId: string, question: string) => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/admin/polls/${pollId}/details`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token') || localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedPollDetails(data.details || []);
        setActivePollAnalytics(question);
        setIsDetailsOpen(true);
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load details', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-purple-500" />
            Poll Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Create soft questions and track user responses dynamically
          </p>
        </div>
      </div>

      {aggregatedPieData.length > 0 && (
        <Card className="border-purple-500/20 shadow-sm shadow-purple-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-purple-500" />
              Aggregate Engagement (Last 10 Polls)
            </CardTitle>
            <CardDescription>Visual breakdown of user interaction rates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={aggregatedPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                    label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {aggregatedPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-purple-500/20 shadow-sm shadow-purple-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-purple-500" />
            Create New Poll
          </CardTitle>
          <CardDescription>
            Configure questions and target specific users
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-col gap-4">
              <Input 
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                placeholder="e.g. Do you like our new dashboard?"
                className="w-full"
                onKeyDown={(e) => e.key === 'Enter' && handleCreatePoll()}
              />
              <div className="flex gap-4 items-center">
                 <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Poll Answers:</span>
                 {pollOptions.map((opt, idx) => (
                    <Input 
                      key={idx} 
                      value={opt.text} 
                      onChange={(e) => {
                         const updated = [...pollOptions];
                         updated[idx].text = e.target.value;
                         setPollOptions(updated);
                      }} 
                      placeholder={`Option ${idx + 1}`}
                      className="h-8 max-w-[200px]"
                    />
                 ))}
              </div>
              
              <div className="flex flex-col md:flex-row gap-4 items-center">
                {/* Countries Dropdown */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="flex-1 justify-between text-left font-normal bg-background/50">
                      <span className="flex items-center truncate">
                        <Globe className="w-4 h-4 mr-2" />
                        {targetCountries.length === 0 ? "All Countries" : `${targetCountries.length} ${targetCountries.length === 1 ? 'Country' : 'Countries'}`}
                      </span>
                      <ChevronsUpDown className="w-4 h-4 opacity-50 ml-2 shrink-0" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0" align="start">
                    <div className="p-3 border-b border-border space-y-2">
                      <Input 
                        placeholder="Search countries..."
                        value={countrySearchTerm}
                        onChange={(e) => setCountrySearchTerm(e.target.value)}
                        className="h-8 text-sm"
                      />
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-7 text-xs flex-1"
                          onClick={() => setTargetCountries([...AVAILABLE_COUNTRIES])}
                        >
                          Select All
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-7 text-xs flex-1 text-red-500 hover:text-red-600"
                          onClick={() => {
                            setTargetCountries([]);
                            setCountrySearchTerm('');
                          }}
                        >
                          Deselect All
                        </Button>
                      </div>
                      {targetCountries.length > 0 && (
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded p-2">
                          <p className="text-xs font-medium text-blue-600 mb-1">Selected: {targetCountries.length}</p>
                          <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                            {targetCountries.slice(0, 10).map(code => (
                              <Badge key={code} variant="secondary" className="text-xs bg-blue-100 text-blue-700 hover:bg-blue-200">
                                {COUNTRY_NAMES[code] || code}
                              </Badge>
                            ))}
                            {targetCountries.length > 10 && (
                              <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                                +{targetCountries.length - 10} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    <ScrollArea className="h-64 rounded-md border-0">
                      <div className="p-4 space-y-3">
                        <h4 className="font-medium mb-1 text-sm text-muted-foreground">Select Targeted GEOs</h4>
                        {filteredCountries.map(country => (
                          <div key={country} className="flex items-center space-x-2">
                            <Checkbox 
                              id={`c-${country}`} 
                              checked={targetCountries.includes(country)}
                              onCheckedChange={(checked) => {
                                if (checked) setTargetCountries([...targetCountries, country]);
                                else setTargetCountries(targetCountries.filter(c => c !== country));
                              }}
                            />
                            <label htmlFor={`c-${country}`} className="text-sm cursor-pointer flex-1">
                              {COUNTRY_NAMES[country] || country} <span className="text-xs text-muted-foreground">({country})</span>
                            </label>
                          </div>
                        ))}
                        {filteredCountries.length === 0 && (
                          <div className="text-sm text-muted-foreground py-2 text-center">No countries found</div>
                        )}
                      </div>
                    </ScrollArea>
                  </PopoverContent>
                </Popover>

                {/* Specific Users Dropdown */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="flex-1 justify-between text-left font-normal bg-background/50">
                      <span className="flex items-center truncate">
                        <Users className="w-4 h-4 mr-2" />
                        {targetUsers.length === 0 ? "Target Users" : `${targetUsers.length} Target Users Selected`}
                      </span>
                      <ChevronsUpDown className="w-4 h-4 opacity-50 ml-2 shrink-0" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0" align="start">
                    <div className="p-4 bg-muted/20 border-b border-border space-y-3">
                      <h4 className="font-medium text-sm">Smart Target Send Filters</h4>
                      
                      <Select value={filterCountry} onValueChange={setFilterCountry}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Filter Country" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Any Country</SelectItem>
                          {AVAILABLE_COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      
                      <Select value={filterPlacement} onValueChange={setFilterPlacement}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Placement Status" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Any Placement</SelectItem>
                          <SelectItem value="yes">Has Placement</SelectItem>
                          <SelectItem value="no">No Placement</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      <Select value={filterVertical} onValueChange={setFilterVertical}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Interest Vertical" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Any Vertical</SelectItem>
                          <SelectItem value="Sweeps">Sweeps</SelectItem>
                          <SelectItem value="Finance">Finance</SelectItem>
                          <SelectItem value="Dating">Dating</SelectItem>
                          <SelectItem value="CPA">CPA</SelectItem>
                          <SelectItem value="Nutra">Nutra</SelectItem>
                          <SelectItem value="Gaming">Gaming</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      <Button onClick={applyUserFilters} size="sm" className="w-full h-8 text-xs bg-purple-600 hover:bg-purple-700">Apply Filters</Button>
                    </div>
                  
                    <ScrollArea className="h-64 rounded-md border-0">
                      <div className="p-4 space-y-3">
                        <div className="flex items-center justify-between mb-3 gap-2">
                          <h4 className="font-medium text-sm text-muted-foreground">Select Individually</h4>
                          {targetUsers.length > 0 && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-6 text-xs text-red-500 hover:text-red-600"
                              onClick={() => {
                                setTargetUsers([]);
                                setUserSearchTerm('');
                              }}
                            >
                              Clear All
                            </Button>
                          )}
                        </div>
                        
                        <Input 
                          placeholder="Search by name, email, or country..."
                          value={userSearchTerm}
                          onChange={(e) => setUserSearchTerm(e.target.value)}
                          className="h-8 text-sm"
                        />
                        
                        {targetUsers.length > 0 && (
                          <div className="bg-blue-500/10 border border-blue-500/20 rounded p-2 mb-2">
                            <p className="text-xs font-medium text-blue-600 mb-1">Selected: {targetUsers.length}</p>
                            <div className="flex flex-wrap gap-1">
                              {selectedUserDetails.slice(0, 3).map(user => (
                                <div key={user.id} className="flex items-center gap-1">
                                  <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 hover:bg-blue-200">
                                    {user.username}
                                  </Badge>
                                  <button
                                    onClick={() => setTargetUsers(targetUsers.filter(id => id !== user.id))}
                                    className="hover:text-red-500 transition-colors"
                                    title={`Remove ${user.username}`}
                                  >
                                    <X className="w-3 h-3 text-blue-500" />
                                  </button>
                                </div>
                              ))}
                              {targetUsers.length > 3 && (
                                <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                                  +{targetUsers.length - 3} more
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {filteredAvailableUsers.map(user => (
                          <div key={user.id} className="flex items-center space-x-2">
                            <Checkbox 
                              id={`u-${user.id}`} 
                              checked={targetUsers.includes(user.id)}
                              onCheckedChange={(checked) => {
                                if (checked) setTargetUsers([...targetUsers, user.id]);
                                else setTargetUsers(targetUsers.filter(id => id !== user.id));
                              }}
                            />
                            <label htmlFor={`u-${user.id}`} className="text-sm cursor-pointer truncate flex flex-col flex-1 min-w-0">
                              <span className="truncate">{user.username} <span className="opacity-50 text-xs text-yellow-400">({user.country})</span></span>
                              <span className="text-xs text-muted-foreground truncate">{user.email}</span>
                            </label>
                          </div>
                        ))}
                        {availableUsers.length === 0 && (
                          <div className="text-sm text-muted-foreground py-2 text-center">No users available</div>
                        )}
                      </div>
                    </ScrollArea>
                  </PopoverContent>
                </Popover>

                {/* Placement Select */}
                <Select value={requirePlacement} onValueChange={setRequirePlacement}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Placement Target" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any Placement Status</SelectItem>
                    <SelectItem value="yes">Has Active Placements</SelectItem>
                    <SelectItem value="no">Zero Placements</SelectItem>
                  </SelectContent>
                </Select>
                
                <Button onClick={handleCreatePoll} className="bg-purple-600 hover:bg-purple-700 text-white shrink-0 sm:w-auto w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Poll
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4 w-full">
        {loading ? (
          <div className="text-center py-10 opacity-50">Loading polls...</div>
        ) : polls.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <HelpCircle className="w-12 h-12 mb-4 opacity-20" />
              <p>No polls created yet. Create your first poll above.</p>
            </CardContent>
          </Card>
        ) : (
          polls.map((poll) => {
            const totalVotes = poll.options.reduce((sum: number, opt: any) => sum + opt.votes, 0);
            const viewCount = poll.viewed_users?.length || 0;
            
            return (
              <Card key={poll._id} className={`w-full transition-all duration-300 ${poll.is_active ? 'border-purple-500 shadow-md shadow-purple-500/10' : 'opacity-80'}`}>
                <CardContent className="p-6">
                  <div className="flex flex-col w-full gap-6">
                    
                    <div className="w-full">
                      <div className="flex items-center justify-between w-full mb-4">
                        <div className="flex items-center gap-3">
                          {poll.is_active && (
                            <Badge className="bg-purple-500 text-white hover:bg-purple-600">Active</Badge>
                          )}
                          {editingId === poll._id ? (
                            <div className="flex flex-col gap-3 w-full max-w-4xl">
                              <div className="flex items-center gap-2">
                                <Input 
                                  value={editingQuestion}
                                  onChange={(e) => setEditingQuestion(e.target.value)}
                                  className="h-8 flex-1"
                                  placeholder="Poll question"
                                  autoFocus
                                  onKeyDown={(e) => e.key === 'Enter' && handleUpdateQuestion(poll._id)}
                                />
                                <Button 
                                  size="sm" 
                                  className="h-8 bg-emerald-500 hover:bg-emerald-600 text-white"
                                  onClick={() => handleUpdateQuestion(poll._id)}
                                >
                                  Save
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-8 text-muted-foreground"
                                  onClick={() => setEditingId(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                              <div className="flex gap-2">
                                {editingOptions.map((opt, idx) => (
                                  <Input 
                                    key={idx}
                                    value={opt.text}
                                    onChange={(e) => {
                                       const u = [...editingOptions];
                                       u[idx].text = e.target.value;
                                       setEditingOptions(u);
                                    }}
                                    placeholder={`Option ${idx + 1}`}
                                    className="h-7 text-xs max-w-[150px]"
                                  />
                                ))}
                              </div>
                              <div className="flex gap-2 flex-wrap">
                                {/* Countries Dropdown */}
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-8 text-xs">
                                      <Globe className="w-3 h-3 mr-1" />
                                      {editingCountries.length === 0 ? "All Countries" : `${editingCountries.length} ${editingCountries.length === 1 ? 'Country' : 'Countries'}`}
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-[300px] p-0" align="start">
                                    <div className="p-3 border-b border-border space-y-2">
                                      <div className="flex gap-2">
                                        <Button 
                                          size="sm" 
                                          variant="outline" 
                                          className="h-7 text-xs flex-1"
                                          onClick={() => setEditingCountries([...AVAILABLE_COUNTRIES])}
                                        >
                                          Select All
                                        </Button>
                                        <Button 
                                          size="sm" 
                                          variant="outline" 
                                          className="h-7 text-xs flex-1 text-red-500"
                                          onClick={() => setEditingCountries([])}
                                        >
                                          Clear
                                        </Button>
                                      </div>
                                    </div>
                                    <ScrollArea className="h-48">
                                      <div className="p-3 space-y-2">
                                        {AVAILABLE_COUNTRIES.map(country => (
                                          <div key={country} className="flex items-center space-x-2">
                                            <Checkbox 
                                              id={`edit-c-${country}`} 
                                              checked={editingCountries.includes(country)}
                                              onCheckedChange={(checked) => {
                                                if (checked) setEditingCountries([...editingCountries, country]);
                                                else setEditingCountries(editingCountries.filter(c => c !== country));
                                              }}
                                            />
                                            <label htmlFor={`edit-c-${country}`} className="text-xs cursor-pointer">
                                              {COUNTRY_NAMES[country] || country}
                                            </label>
                                          </div>
                                        ))}
                                      </div>
                                    </ScrollArea>
                                  </PopoverContent>
                                </Popover>

                                {/* Users Dropdown */}
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-8 text-xs">
                                      <Users className="w-3 h-3 mr-1" />
                                      {editingUsers.length === 0 ? "All Users" : `${editingUsers.length} Users`}
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-[300px] p-0" align="start">
                                    <div className="p-3 border-b border-border">
                                      <Button 
                                        size="sm" 
                                        variant="outline" 
                                        className="h-7 text-xs w-full text-red-500"
                                        onClick={() => setEditingUsers([])}
                                      >
                                        Clear All
                                      </Button>
                                    </div>
                                    <ScrollArea className="h-48">
                                      <div className="p-3 space-y-2">
                                        {availableUsers.map(user => (
                                          <div key={user.id} className="flex items-center space-x-2">
                                            <Checkbox 
                                              id={`edit-u-${user.id}`} 
                                              checked={editingUsers.includes(user.id)}
                                              onCheckedChange={(checked) => {
                                                if (checked) setEditingUsers([...editingUsers, user.id]);
                                                else setEditingUsers(editingUsers.filter(id => id !== user.id));
                                              }}
                                            />
                                            <label htmlFor={`edit-u-${user.id}`} className="text-xs cursor-pointer">
                                              {user.username}
                                            </label>
                                          </div>
                                        ))}
                                      </div>
                                    </ScrollArea>
                                  </PopoverContent>
                                </Popover>

                                {/* Placement Select */}
                                <Select value={editingPlacement} onValueChange={setEditingPlacement}>
                                  <SelectTrigger className="h-8 text-xs w-[180px]">
                                    <SelectValue placeholder="Placement" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="all">Any Placement</SelectItem>
                                    <SelectItem value="yes">Has Placement</SelectItem>
                                    <SelectItem value="no">No Placement</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          ) : (
                            <h3 className="text-xl font-bold break-words">{poll.question}</h3>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-4 bg-muted/30 p-2 px-4 rounded-lg border border-border/50 shrink-0">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="hidden sm:flex border-purple-500/30 text-purple-600 hover:bg-purple-500/10"
                            onClick={() => fetchPollDetails(poll._id, poll.question)}
                          >
                            <Users className="w-4 h-4 mr-2" />
                            View Analytics
                        </Button>
                          <div className="w-px h-6 bg-border hidden sm:block"></div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground font-medium">Active</span>
                            <Switch 
                              checked={poll.is_active}
                              onCheckedChange={() => handleToggleActive(poll._id, poll.is_active)}
                            />
                          </div>
                          <div className="w-px h-6 bg-border"></div>
                          <div className="flex items-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-blue-500 hover:text-blue-600 hover:bg-blue-500/10 h-8 w-8"
                              onClick={() => {
                                setEditingId(poll._id);
                                setEditingQuestion(poll.question);
                                setEditingOptions(poll.options || [{id:'yes', text:'Yes'}, {id:'no', text:'No'}]);
                                setEditingCountries(poll.target_countries || []);
                                setEditingUsers(poll.target_users || []);
                                setEditingPlacement(
                                  poll.require_placement === null ? 'all' : 
                                  poll.require_placement === true ? 'yes' : 'no'
                                );
                              }}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-red-500 hover:text-red-600 hover:bg-red-500/10 h-8 w-8"
                              onClick={() => handleDeletePoll(poll._id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Targeting Settings Info */}
                      <div className="space-y-2 mb-4">
                        {(poll.target_countries?.length > 0 || poll.target_users?.length > 0 || poll.require_placement !== null) && (
                          <div className="flex flex-wrap items-center gap-3 text-xs font-medium">
                            <span className="text-muted-foreground"><Settings className="w-3 h-3 inline mr-1" /> Targeting:</span>
                            {poll.target_countries?.length > 0 && (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button className="bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded border border-blue-500/20 shadow-sm hover:bg-blue-500/20 transition-colors cursor-pointer">
                                    {poll.target_countries.length} {poll.target_countries.length === 1 ? 'Country' : 'Countries'}
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[300px] p-3" align="start">
                                  <h4 className="font-medium text-sm mb-2 text-blue-600">Targeted Countries</h4>
                                  <div className="flex flex-wrap gap-1 max-h-[200px] overflow-y-auto">
                                    {poll.target_countries.map((code: string) => (
                                      <Badge key={code} variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                                        {COUNTRY_NAMES[code] || code}
                                      </Badge>
                                    ))}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            )}
                            {poll.target_users?.length > 0 && (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button className="bg-fuchsia-500/10 text-fuchsia-500 px-2 py-0.5 rounded border border-fuchsia-500/20 shadow-sm hover:bg-fuchsia-500/20 transition-colors cursor-pointer">
                                    {poll.target_users.length} Specific Users
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[300px] p-3" align="start">
                                  <h4 className="font-medium text-sm mb-2 text-fuchsia-600">Targeted Users</h4>
                                  <div className="flex flex-wrap gap-1 max-h-[200px] overflow-y-auto">
                                    {availableUsers
                                      .filter(u => poll.target_users.includes(u.id))
                                      .map(user => (
                                        <Badge key={user.id} variant="secondary" className="text-xs bg-fuchsia-100 text-fuchsia-700">
                                          {user.username}
                                        </Badge>
                                      ))}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            )}
                            {poll.require_placement !== null && (
                              <span className="bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded border border-amber-500/20 shadow-sm">
                                 Placements: {poll.require_placement ? 'Required' : 'None'}
                              </span>
                            )}
                          </div>
                        )}
                        {poll.created_at && (
                          <div className="flex justify-end">
                            <span className="bg-gray-500/10 text-gray-500 px-2 py-0.5 rounded border border-gray-500/20 shadow-sm text-xs">
                              Created: {new Date(poll.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at {new Date(poll.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 w-full">
                        {poll.options.map((opt: any) => {
                          const percent = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
                          return (
                            <div key={opt.id} className="flex-1 w-full sm:max-w-[250px]">
                              <div className="flex justify-between text-sm mb-1 text-muted-foreground w-full">
                                <span className="font-medium text-foreground">{opt.text}</span>
                                <span>{percent}% <span className="text-xs">({opt.votes})</span></span>
                              </div>
                              <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                                <div 
                                  className={`h-full ${opt.id === 'yes' ? 'bg-emerald-500' : 'bg-red-500'}`} 
                                  style={{ width: `${percent}%` }}
                                ></div>
                              </div>
                            </div>
                          );
                        })}
                        <div className="flex flex-col gap-1 w-full sm:w-auto mt-2 sm:mt-0 pt-2 sm:pt-0 sm:ml-auto border-t sm:border-0 border-border/50">
                          <div className="flex items-center gap-6 justify-between sm:justify-end">
                            <div className="flex flex-col text-right">
                              <div className="text-sm text-muted-foreground">
                                Views: <span className="font-bold text-blue-400">{viewCount}</span>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                Votes: <span className="font-bold text-emerald-400">{totalVotes}</span>
                              </div>
                            </div>
                            
                            {totalVotes > 0 && (
                              <div className="w-16 h-16 shrink-0">
                                <ResponsiveContainer width="100%" height="100%">
                                  <PieChart>
                                    <Pie
                                      data={poll.options}
                                      cx="50%"
                                      cy="50%"
                                      innerRadius={0}
                                      outerRadius={30}
                                      dataKey="votes"
                                      stroke="none"
                                    >
                                      {poll.options.map((opt: any, index: number) => (
                                        <Cell key={`cell-${index}`} fill={opt.id === 'yes' ? '#10b981' : '#ef4444'} />
                                      ))}
                                    </Pie>
                                    <RechartsTooltip 
                                      contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '4px', padding: '4px 8px', fontSize: '12px' }}
                                      itemStyle={{ color: '#fff' }}
                                    />
                                  </PieChart>
                                </ResponsiveContainer>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Analytics Modal */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col bg-slate-950 border-slate-800">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <Activity className="w-6 h-6 text-purple-500" />
              Poll Details
            </DialogTitle>
            <DialogDescription className="text-gray-400 font-medium line-clamp-1">
              "{activePollAnalytics}"
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto mt-4 pr-2">
            {selectedPollDetails.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                No views or responses recorded yet.
              </div>
            ) : (
              <div className="border border-slate-800 rounded-lg overflow-hidden">
                <table className="w-full text-sm text-left text-gray-300 relative">
                  <thead className="text-xs text-gray-400 uppercase bg-slate-900 border-b border-slate-800 sticky top-0 z-10 shadow-md">
                    <tr>
                      <th className="px-4 py-3" style={{width: '25%'}}>User</th>
                      <th className="px-4 py-3" style={{width: '10%'}}>Country</th>
                      <th className="px-4 py-3 text-center" style={{width: '10%'}}>Viewed</th>
                      <th className="px-4 py-3" style={{width: '15%'}}>View Time</th>
                      <th className="px-4 py-3 text-center" style={{width: '10%'}}>Responded</th>
                      <th className="px-4 py-3 text-center" style={{width: '10%'}}>Answer</th>
                      <th className="px-4 py-3" style={{width: '15%'}}>Response Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPollDetails.map((detail, idx) => (
                      <tr key={idx} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-white">{detail.username}</div>
                          <div className="text-xs text-gray-500 truncate max-w-[200px]">{detail.email}</div>
                        </td>
                        <td className="px-4 py-3">
                          {detail.country || 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {detail.viewed ? <CheckCircle2 className="w-4 h-4 text-blue-500 mx-auto" /> : '-'}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                          {detail.view_time ? new Date(detail.view_time).toLocaleString() : '-'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {detail.responded ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" /> : '-'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {detail.response ? (
                            <span className={`px-2 py-1 rounded text-xs font-bold ${detail.response === 'yes' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                              {detail.response.toUpperCase()}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                          {detail.response_time ? new Date(detail.response_time).toLocaleString() : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const AdminPollsWithGuard = () => (
  <AdminPageGuard requiredTab="overview">
    <AdminPolls />
  </AdminPageGuard>
);

export default AdminPollsWithGuard;
