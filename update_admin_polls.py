import re

with open('src/pages/AdminPolls.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update states to support editing options and user filtering
states_old = """  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingQuestion, setEditingQuestion] = useState('');"""

states_new = """  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  
  // Custom options state
  const [pollOptions, setPollOptions] = useState([{id: 'yes', text: 'Yes'}, {id: 'no', text: 'No'}]);
  
  // User Filters
  const [filterCountry, setFilterCountry] = useState<string>('all');
  const [filterPlacement, setFilterPlacement] = useState<string>('all');
  const [filterVertical, setFilterVertical] = useState<string>('all');
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingQuestion, setEditingQuestion] = useState('');
  const [editingOptions, setEditingOptions] = useState<any[]>([]);"""
content = content.replace(states_old, states_new)

# 2. Add Filter functions
fetch_end = """  useEffect(() => {
    fetchData();
  }, []);"""

filter_logic = """  useEffect(() => {
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
  };"""
content = content.replace(fetch_end, filter_logic)

# 3. Update Create Poll payload
create_payload_old = """        body: JSON.stringify({ 
          question: newQuestion, 
          is_active: false,
          target_countries: targetCountries,
          target_users: targetUsers,
          require_placement: placementVal
        })"""

create_payload_new = """        body: JSON.stringify({ 
          question: newQuestion, 
          is_active: false,
          target_countries: targetCountries,
          target_users: targetUsers,
          require_placement: placementVal,
          options: pollOptions.map(opt => ({...opt, votes: 0}))
        })"""
content = content.replace(create_payload_old, create_payload_new)

# 3.5 reset options
reset_old = """      setTargetUsers([]);
      setRequirePlacement('all');"""
reset_new = """      setTargetUsers([]);
      setRequirePlacement('all');
      setPollOptions([{id: 'yes', text: 'Yes'}, {id: 'no', text: 'No'}]);"""
content = content.replace(reset_old, reset_new)

# 4. Implement handleUpdatePoll for question AND options
update_question_old = """  const handleUpdateQuestion = async (pollId: string) => {
    if (!editingQuestion.trim()) return;
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/admin/polls/${pollId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('admin_token') || localStorage.getItem('token')}`
        },
        body: JSON.stringify({ question: editingQuestion })
      });
      if (!response.ok) throw new Error('Failed to update question');
      toast({ title: 'Success', description: 'Poll question updated' });
      setEditingId(null);
      fetchData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update question', variant: 'destructive' });
    }
  };"""

update_question_new = """  const handleUpdateQuestion = async (pollId: string) => {
    if (!editingQuestion.trim()) return;
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/admin/polls/${pollId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('admin_token') || localStorage.getItem('token')}`
        },
        body: JSON.stringify({ question: editingQuestion, options: editingOptions })
      });
      if (!response.ok) throw new Error('Failed to update poll');
      toast({ title: 'Success', description: 'Poll updated' });
      setEditingId(null);
      fetchData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update poll', variant: 'destructive' });
    }
  };"""
content = content.replace(update_question_old, update_question_new)


# 5. Add UI for creating options and filtering users in the UI
# Create UI inject under question input
input_old = """              <Input 
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                placeholder="e.g. Do you like our new dashboard?"
                className="w-full"
                onKeyDown={(e) => e.key === 'Enter' && handleCreatePoll()}
              />"""

input_new = """              <Input 
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
              </div>"""
content = content.replace(input_old, input_new)

# Add Filter functionality into target users dropdown
popover_users_old = """                {/* Specific Users Dropdown */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="flex-1 justify-between text-left font-normal bg-background/50">
                      <span className="flex items-center truncate">
                        <Users className="w-4 h-4 mr-2" />
                        {targetUsers.length === 0 ? "All Users" : `${targetUsers.length} Users Selected`}
                      </span>
                      <ChevronsUpDown className="w-4 h-4 opacity-50 ml-2 shrink-0" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0" align="start">
                    <ScrollArea className="h-64 rounded-md border-0">
                      <div className="p-4 space-y-3">
                        <h4 className="font-medium mb-1 text-sm text-muted-foreground">Isolate Specific Users</h4>"""

popover_users_new = """                {/* Specific Users Dropdown */}
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
                  
                    <ScrollArea className="h-48 rounded-md border-0">
                      <div className="p-4 space-y-3">
                        <h4 className="font-medium mb-1 text-sm text-muted-foreground">Select Individually</h4>"""
content = content.replace(popover_users_old, popover_users_new)

# 6. Edit button to load options
edit_button_old = """                              className="text-blue-500 hover:text-blue-600 hover:bg-blue-500/10 h-8 w-8"
                              onClick={() => {
                                setEditingId(poll._id);
                                setEditingQuestion(poll.question);
                              }}
                            >"""

edit_button_new = """                              className="text-blue-500 hover:text-blue-600 hover:bg-blue-500/10 h-8 w-8"
                              onClick={() => {
                                setEditingId(poll._id);
                                setEditingQuestion(poll.question);
                                setEditingOptions(poll.options || [{id:'yes', text:'Yes'}, {id:'no', text:'No'}]);
                              }}
                            >"""
content = content.replace(edit_button_old, edit_button_new)

# 7. Edit view options mapping
edit_view_old = """                            <div className="flex items-center gap-2 w-full max-w-sm">
                              <Input 
                                value={editingQuestion}
                                onChange={(e) => setEditingQuestion(e.target.value)}
                                className="h-8 flex-1"
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
                            </div>"""

edit_view_new = """                            <div className="flex flex-col gap-2 w-full max-w-xl">
                              <div className="flex items-center gap-2">
                                <Input 
                                  value={editingQuestion}
                                  onChange={(e) => setEditingQuestion(e.target.value)}
                                  className="h-8 flex-1"
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
                                    className="h-7 text-xs max-w-[150px]"
                                  />
                                ))}
                              </div>
                            </div>"""
content = content.replace(edit_view_old, edit_view_new)

# 8. Add View Time header and row to Analytics table
th_old = """                    <tr>
                      <th className="px-4 py-3">User</th>
                      <th className="px-4 py-3">Country</th>
                      <th className="px-4 py-3 text-center">Viewed</th>
                      <th className="px-4 py-3 text-center">Responded</th>
                      <th className="px-4 py-3 text-center">Answer</th>
                      <th className="px-4 py-3">Time</th>
                    </tr>"""
th_new = """                    <tr>
                      <th className="px-4 py-3" style={{width: '25%'}}>User</th>
                      <th className="px-4 py-3" style={{width: '10%'}}>Country</th>
                      <th className="px-4 py-3 text-center" style={{width: '10%'}}>Viewed</th>
                      <th className="px-4 py-3" style={{width: '15%'}}>View Time</th>
                      <th className="px-4 py-3 text-center" style={{width: '10%'}}>Responded</th>
                      <th className="px-4 py-3 text-center" style={{width: '10%'}}>Answer</th>
                      <th className="px-4 py-3" style={{width: '15%'}}>Response Time</th>
                    </tr>"""
content = content.replace(th_old, th_new)

td_old = """                      <tr key={idx} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
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
                        <td className="px-4 py-3 text-xs text-gray-400">
                          {detail.response_time ? new Date(detail.response_time).toLocaleString() : '-'}
                        </td>
                      </tr>"""
td_new = """                      <tr key={idx} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
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
                      </tr>"""
content = content.replace(td_old, td_new)

with open('src/pages/AdminPolls.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
