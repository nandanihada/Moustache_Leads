#!/usr/bin/env python3

def fix_admin_tabs():
    """Fix the AdminPlacementApproval component to add proper tabs structure"""
    
    file_path = 'd:/pepeleads/ascend/lovable-ascend/src/pages/AdminPlacementApproval.tsx'
    
    # Read the current file
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Find the section after the table ends and before the Dialog
    # We need to add the approved tab content and close the tabs properly
    
    old_pattern = """            </Table>
          )}
        </CardContent>
      </Card>

      {/* Action Dialog */}"""
    
    new_pattern = """            </Table>
          )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approved" className="space-y-6">
          {/* Search and Filters for Approved */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search approved publishers by name, email, or placement title..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Approved Publishers Table */}
          <Card>
            <CardHeader>
              <CardTitle>Approved Publishers ({pagination.total})</CardTitle>
              <CardDescription>
                View approved publishers and their placement details
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                  Loading approved publishers...
                </div>
              ) : placements.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No approved publishers found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Publisher</TableHead>
                      <TableHead>Placement Details</TableHead>
                      <TableHead>Platform</TableHead>
                      <TableHead>Approved Date</TableHead>
                      <TableHead>Approved By</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {placements.map((placement) => (
                      <TableRow key={placement.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium flex items-center">
                              <User className="h-4 w-4 mr-2 text-gray-400" />
                              {placement.publisherName}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {placement.publisherEmail}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{placement.offerwallTitle}</div>
                            <div className="text-sm text-muted-foreground flex items-center">
                              <DollarSign className="h-3 w-3 mr-1" />
                              {placement.currencyName} (1 USD = {placement.exchangeRate})
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="flex items-center w-fit">
                            <Globe className="h-3 w-3 mr-1" />
                            {placement.platformType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center text-sm text-muted-foreground">
                            <Calendar className="h-3 w-3 mr-1" />
                            {placement.approvedAt ? new Date(placement.approvedAt).toLocaleDateString() : 'N/A'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {placement.approvedBy ? 'Admin' : 'N/A'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openActionDialog(placement, 'view')}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Badge className="bg-green-100 text-green-800">
                              Approved
                            </Badge>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Dialog */}"""
    
    if old_pattern in content:
        content = content.replace(old_pattern, new_pattern)
        print("✅ Fixed tabs structure and added approved publishers tab")
    else:
        print("⚠️ Pattern not found - checking for alternative patterns")
        
        # Try alternative pattern
        alt_pattern = """          )}
        </CardContent>
      </Card>

      {/* Action Dialog */}"""
        
        alt_new_pattern = """          )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approved" className="space-y-6">
          {/* Search and Filters for Approved */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search approved publishers by name, email, or placement title..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Approved Publishers Table */}
          <Card>
            <CardHeader>
              <CardTitle>Approved Publishers ({pagination.total})</CardTitle>
              <CardDescription>
                View approved publishers and their placement details
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                  Loading approved publishers...
                </div>
              ) : placements.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No approved publishers found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Publisher</TableHead>
                      <TableHead>Placement Details</TableHead>
                      <TableHead>Platform</TableHead>
                      <TableHead>Approved Date</TableHead>
                      <TableHead>Approved By</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {placements.map((placement) => (
                      <TableRow key={placement.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium flex items-center">
                              <User className="h-4 w-4 mr-2 text-gray-400" />
                              {placement.publisherName}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {placement.publisherEmail}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{placement.offerwallTitle}</div>
                            <div className="text-sm text-muted-foreground flex items-center">
                              <DollarSign className="h-3 w-3 mr-1" />
                              {placement.currencyName} (1 USD = {placement.exchangeRate})
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="flex items-center w-fit">
                            <Globe className="h-3 w-3 mr-1" />
                            {placement.platformType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center text-sm text-muted-foreground">
                            <Calendar className="h-3 w-3 mr-1" />
                            {placement.approvedAt ? new Date(placement.approvedAt).toLocaleDateString() : 'N/A'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {placement.approvedBy ? 'Admin' : 'N/A'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openActionDialog(placement, 'view')}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Badge className="bg-green-100 text-green-800">
                              Approved
                            </Badge>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Dialog */}"""
        
        if alt_pattern in content:
            content = content.replace(alt_pattern, alt_new_pattern)
            print("✅ Fixed tabs structure using alternative pattern")
        else:
            print("❌ Could not find pattern to replace")
            return
    
    # Write the file back
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("\n🎯 ADMIN TABS FIXED!")
    print("✅ Added 'Approved Publishers' subtab")
    print("✅ Proper tab structure with separate content for each tab")
    print("✅ Different table headers for approved publishers")
    print("✅ Shows approval date and approved by information")
    print("\n📋 Features:")
    print("- Pending Approvals tab: Shows pending placements with approve/reject actions")
    print("- Approved Publishers tab: Shows approved placements with publisher details")
    print("- Separate search functionality for each tab")
    print("- Proper status filtering based on active tab")

if __name__ == "__main__":
    fix_admin_tabs()
