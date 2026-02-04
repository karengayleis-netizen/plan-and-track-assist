import { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useStudents } from '@/hooks/useStudents';
import { useBenchmarks } from '@/hooks/useBenchmarks';
import { useClasses } from '@/hooks/useClasses';
import { useStaff } from '@/hooks/useStaff';
import { GRADES } from '@/types';
import { Upload, Search, Sparkles, Loader2, Users, BarChart3, AlertTriangle, Activity, Settings, Plus, Trash2, Save, UserPlus, Check, X, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { StatCard } from '@/components/dashboard';
import { formatGradeDisplay } from '@/types/homeroom';

interface AnalyzeSchoolDataResponse {
  recommendations: string;
}

interface LookupUserByEmailResponse {
  uid: string;
  email: string;
  displayName?: string | null;
}

export function AdminTab() {
  const { students } = useStudents();
  const { benchmarks } = useBenchmarks();
  const { classes, addClass, deleteClass, loading: classesLoading } = useClasses();
  const { 
    staffMembers, 
    searchResults, 
    loading: staffLoading, 
    searchLoading,
    fetchStaffMembers,
    searchStaffByEmail,
    saveStaffMember,
    deleteStaffMember,
    clearSearch,
  } = useStaff();
  
  // Class Management state
  const [classCode, setClassCode] = useState('');
  const [className, setClassName] = useState('');
  const [selectedGrades, setSelectedGrades] = useState<number[]>([]);
  
  // Staff Directory state - Search
  const [staffSearch, setStaffSearch] = useState('');
  
  // Staff Directory state - Add/Update Form
  const [staffUid, setStaffUid] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffDisplayName, setStaffDisplayName] = useState('');
  const [staffRole, setStaffRole] = useState<'teacher' | 'admin'>('teacher');
  const [canWrite, setCanWrite] = useState(false);
  const [selectedHomerooms, setSelectedHomerooms] = useState<string[]>([]);
  const [isSavingStaff, setIsSavingStaff] = useState(false);
  const [isLookingUpEmail, setIsLookingUpEmail] = useState(false);
  const [emailToLookup, setEmailToLookup] = useState('');
  
  const [isCreatingClass, setIsCreatingClass] = useState(false);
  
  // AI Strategy state
  const [selectedProgram, setSelectedProgram] = useState('fi');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiRecommendations, setAiRecommendations] = useState('');

  // Load staff members on mount
  useEffect(() => {
    fetchStaffMembers();
  }, [fetchStaffMembers]);

  // Calculate stats
  const totalStudents = students.length;
  const totalBenchmarks = benchmarks.length;
  const atRiskCount = students.filter(s => s.isHighNeed).length;
  const avgDataPerStudent = totalStudents > 0 ? (totalBenchmarks / totalStudents).toFixed(1) : '0';

  // Grade analytics
  const gradeAnalytics = GRADES.map(grade => {
    const gradeStudents = students.filter(s => s.grade === grade);
    const atRisk = gradeStudents.filter(s => s.isHighNeed).length;
    const stable = gradeStudents.length - atRisk;
    return {
      grade,
      students: gradeStudents.length,
      atRiskPercent: gradeStudents.length > 0 ? Math.round((atRisk / gradeStudents.length) * 100) : 0,
      stablePercent: gradeStudents.length > 0 ? Math.round((stable / gradeStudents.length) * 100) : 0
    };
  }).filter(g => g.students > 0);

  // Available grades as numbers (K=0, 1-8)
  const availableGrades = [0, 1, 2, 3, 4, 5, 6, 7, 8];

  const toggleGrade = (grade: number) => {
    setSelectedGrades(prev => 
      prev.includes(grade) 
        ? prev.filter(g => g !== grade)
        : [...prev, grade].sort((a, b) => a - b)
    );
  };

  const handleCreateClass = async () => {
    if (!classCode.trim()) {
      toast.error('Please enter a class code (e.g., 2AF)');
      return;
    }
    if (selectedGrades.length === 0) {
      toast.error('Please select at least one allowed grade');
      return;
    }

    setIsCreatingClass(true);
    try {
      await addClass({
        code: classCode.trim(),
        name: className.trim() || undefined,
        allowedGrades: selectedGrades,
      });
      toast.success(`Class "${classCode.toUpperCase()}" created successfully`);
      // Reset form
      setClassCode('');
      setClassName('');
      setSelectedGrades([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create class');
    } finally {
      setIsCreatingClass(false);
    }
  };

  const handleDeleteClass = async (id: string, code: string) => {
    if (!confirm(`Delete class "${code}"? This cannot be undone.`)) return;
    
    try {
      await deleteClass(id);
      toast.success(`Class "${code}" deleted`);
    } catch (err) {
      toast.error('Failed to delete class');
    }
  };

  // Staff Directory handlers
  const toggleHomeroom = (code: string) => {
    setSelectedHomerooms(prev => 
      prev.includes(code) 
        ? prev.filter(c => c !== code)
        : [...prev, code]
    );
  };

  const handleSaveStaff = async () => {
    if (!staffUid.trim()) {
      toast.error('Please enter the staff UID');
      return;
    }
    if (!staffEmail.trim()) {
      toast.error('Please enter the staff email');
      return;
    }

    setIsSavingStaff(true);
    try {
      await saveStaffMember({
        uid: staffUid.trim(),
        email: staffEmail.trim(),
        role: staffRole,
        canWrite: canWrite,
        assignedHomerooms: selectedHomerooms,
        displayName: staffDisplayName.trim() || undefined,
      });
      toast.success('Staff member saved successfully');
      // Reset form
      setStaffUid('');
      setStaffEmail('');
      setStaffDisplayName('');
      setStaffRole('teacher');
      setCanWrite(false);
      setSelectedHomerooms([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save staff member');
    } finally {
      setIsSavingStaff(false);
    }
  };

  const handleDeleteStaff = async (uid: string, email: string) => {
    if (!confirm(`Remove "${email}" from staff directory? This cannot be undone.`)) return;
    
    try {
      await deleteStaffMember(uid);
      toast.success(`Staff "${email}" removed`);
    } catch (err) {
      toast.error('Failed to remove staff member');
    }
  };

  // Phase 2: Email lookup via Cloud Function
  const handleLookupEmail = async () => {
    if (!emailToLookup.trim()) {
      toast.error('Please enter an email to lookup');
      return;
    }

    setIsLookingUpEmail(true);
    try {
      const lookupUserByEmail = httpsCallable<{ email: string }, LookupUserByEmailResponse>(
        functions,
        'lookupUserByEmail'
      );
      
      const result = await lookupUserByEmail({ email: emailToLookup.trim() });
      
      // Auto-fill the form with UID, email, and displayName
      setStaffUid(result.data.uid);
      setStaffEmail(result.data.email);
      if (result.data.displayName) {
        setStaffDisplayName(result.data.displayName);
      }
      toast.success(`Found user: ${result.data.email}${result.data.displayName ? ` (${result.data.displayName})` : ''}`);
    } catch (err: unknown) {
      console.error('Email lookup failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'User not found or lookup failed';
      toast.error(errorMessage);
    } finally {
      setIsLookingUpEmail(false);
    }
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    
    try {
      const analyzeSchoolData = httpsCallable<object, AnalyzeSchoolDataResponse>(
        functions, 
        'analyzeSchoolData'
      );
      
      const atRiskStudents = students.filter(s => s.isHighNeed).map(s => ({
        id: s.id,
        studentNumber: s.studentNumber,
        grade: s.grade,
        homeroom: s.homeroom
      }));
      
      const result = await analyzeSchoolData({
        program: selectedProgram,
        schoolStats: {
          totalStudents,
          totalBenchmarks,
          atRiskCount,
          avgDataPerStudent: parseFloat(avgDataPerStudent)
        },
        gradeAnalytics,
        atRiskStudents
      });
      
      setAiRecommendations(result.data.recommendations);
      toast.success('AI analysis complete!');
    } catch {
      toast.error('Failed to analyze. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Class Management */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Settings className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Class Management</CardTitle>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">
                Paths: schools/{'{schoolId}'}/homerooms/{'{code}'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Create homerooms (classes), assign allowed grades for split-grade support
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Create Class Form */}
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Create New Homeroom
              </h3>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="classCode">Homeroom Code *</Label>
                  <Input
                    id="classCode"
                    placeholder="e.g., 2AF, 45E, 3B"
                    value={classCode}
                    onChange={(e) => setClassCode(e.target.value.toUpperCase())}
                    className="focus:ring-primary mt-1"
                    maxLength={10}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Primary identifier for this class
                  </p>
                </div>
                
                <div>
                  <Label htmlFor="className">Display Name (optional)</Label>
                  <Input
                    id="className"
                    placeholder="e.g., Grade 2 French, Room 45"
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                    className="focus:ring-primary mt-1"
                    maxLength={50}
                  />
                </div>

                <div>
                  <Label>Allowed Grades * (select one or more)</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {availableGrades.map(grade => (
                      <button
                        key={grade}
                        type="button"
                        onClick={() => toggleGrade(grade)}
                        className={`px-3 py-1.5 text-sm font-medium rounded-md border transition-colors ${
                          selectedGrades.includes(grade)
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background border-border hover:bg-muted'
                        }`}
                      >
                        {formatGradeDisplay(grade)}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    For split grades (e.g., 4/5), select multiple grades
                  </p>
                </div>

                <Button 
                  className="w-full" 
                  onClick={handleCreateClass}
                  disabled={isCreatingClass || !classCode.trim() || selectedGrades.length === 0}
                >
                  {isCreatingClass ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Homeroom
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Existing Classes List */}
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground">Existing Homerooms</h3>
              {classesLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                  Loading classes...
                </div>
              ) : classes.length === 0 ? (
                <div className="border border-dashed border-border rounded-lg p-6 text-center text-muted-foreground">
                  <Settings className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No homerooms created yet</p>
                  <p className="text-xs mt-1">Create your first homeroom to get started</p>
                </div>
              ) : (
                <div className="border border-border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead>Code</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Grades</TableHead>
                        <TableHead className="w-[60px]">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {classes.map(cls => (
                        <TableRow key={cls.id} className="hover:bg-muted/30">
                          <TableCell className="font-mono font-medium">{cls.code}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {cls.name || '—'}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 flex-wrap">
                              {cls.allowedGrades.map(g => (
                                <span 
                                  key={g} 
                                  className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded"
                                >
                                  {formatGradeDisplay(g)}
                                </span>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:text-destructive"
                              onClick={() => handleDeleteClass(cls.id, cls.code)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Staff Directory */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Find Staff Card */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Search className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Find Staff (Email Search)</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Search existing staff directory by email
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Enter exact email address..." 
                  className="pl-8 focus:ring-primary"
                  value={staffSearch}
                  onChange={(e) => setStaffSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      searchStaffByEmail(staffSearch);
                    }
                  }}
                />
              </div>
              <Button 
                onClick={() => searchStaffByEmail(staffSearch)}
                disabled={searchLoading || !staffSearch.trim()}
                variant="secondary"
              >
                {searchLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
              {searchResults.length > 0 && (
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => {
                    clearSearch();
                    setStaffSearch('');
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            
            <div className="border border-border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>UID</TableHead>
                    <TableHead className="w-[60px]">Use</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {searchLoading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                        <span className="text-muted-foreground">Searching...</span>
                      </TableCell>
                    </TableRow>
                  ) : searchResults.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                        {staffSearch.trim() ? 'No staff found with that email.' : 'Enter an email to search.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    searchResults.map(staff => (
                      <TableRow key={staff.uid} className="hover:bg-muted/30">
                        <TableCell className="text-sm">{staff.email}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {staff.displayName || '—'}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {staff.uid.slice(0, 12)}...
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setStaffUid(staff.uid);
                              setStaffEmail(staff.email);
                              setStaffDisplayName(staff.displayName || '');
                              setStaffRole(staff.role);
                              setCanWrite(staff.canWrite);
                              setSelectedHomerooms(staff.assignedHomerooms || []);
                              toast.info('Staff loaded into form');
                            }}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Add/Update Staff Card */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <UserPlus className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Add/Update Staff Directory</CardTitle>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">
                  Collection: teachers/{'{uid}'}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Phase 2: Email lookup to get UID */}
            <div className="p-3 bg-muted/30 rounded-lg border border-border/50 space-y-2">
              <Label className="text-xs text-muted-foreground">Phase 2: Lookup UID by Email (Cloud Function)</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="staff@school.edu"
                  value={emailToLookup}
                  onChange={(e) => setEmailToLookup(e.target.value)}
                  className="flex-1"
                />
                <Button 
                  variant="secondary"
                  onClick={handleLookupEmail}
                  disabled={isLookingUpEmail || !emailToLookup.trim()}
                >
                  {isLookingUpEmail ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Mail className="h-4 w-4 mr-1" />
                      Lookup
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Uses Admin SDK to find Firebase Auth user by email
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="staffUid">Staff UID *</Label>
                <Input 
                  id="staffUid"
                  placeholder="Firebase UID"
                  value={staffUid}
                  onChange={(e) => setStaffUid(e.target.value)}
                  className="focus:ring-primary font-mono text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="staffEmail">Email *</Label>
                <Input 
                  id="staffEmail"
                  placeholder="staff@school.edu"
                  value={staffEmail}
                  onChange={(e) => setStaffEmail(e.target.value)}
                  className="focus:ring-primary"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="staffName">Display Name</Label>
                <Input 
                  id="staffName"
                  placeholder="John Smith"
                  value={staffDisplayName}
                  onChange={(e) => setStaffDisplayName(e.target.value)}
                  className="focus:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={staffRole} onValueChange={(v) => setStaffRole(v as 'teacher' | 'admin')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="teacher">Teacher</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox 
                id="canWrite" 
                checked={canWrite}
                onCheckedChange={(checked) => setCanWrite(checked as boolean)}
              />
              <Label htmlFor="canWrite">Can upload/edit roster (canWrite)</Label>
            </div>

            <div className="space-y-2">
              <Label>Assigned Homerooms</Label>
              <div className="flex flex-wrap gap-2">
                {classes.length === 0 ? (
                  <span className="text-sm text-muted-foreground">No homerooms available</span>
                ) : (
                  classes.map(cls => (
                    <button
                      key={cls.id}
                      type="button"
                      onClick={() => toggleHomeroom(cls.code)}
                      className={`px-2 py-1 text-xs font-medium rounded border transition-colors ${
                        selectedHomerooms.includes(cls.code)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background border-border hover:bg-muted'
                      }`}
                    >
                      {cls.code}
                    </button>
                  ))
                )}
              </div>
            </div>

            <Button 
              className="w-full" 
              onClick={handleSaveStaff}
              disabled={isSavingStaff || !staffUid.trim() || !staffEmail.trim()}
            >
              {isSavingStaff ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Staff Member
                </>
              )}
            </Button>

            {/* Current Staff Members */}
            <div className="pt-4 border-t border-border">
              <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Current Staff ({staffMembers.length})
              </h4>
              {staffLoading ? (
                <div className="text-center py-4 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                  Loading...
                </div>
              ) : staffMembers.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  No staff members added yet.
                </div>
              ) : (
                <div className="border border-border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Write</TableHead>
                        <TableHead className="w-[60px]">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {staffMembers.map(staff => (
                        <TableRow key={staff.uid} className="hover:bg-muted/30">
                          <TableCell className="text-sm">{staff.email}</TableCell>
                          <TableCell>
                            <Badge variant={staff.role === 'admin' ? 'default' : 'secondary'} className="text-xs">
                              {staff.role}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {staff.canWrite ? (
                              <Check className="h-4 w-4 text-success" />
                            ) : (
                              <X className="h-4 w-4 text-muted-foreground" />
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:text-destructive"
                              onClick={() => handleDeleteStaff(staff.uid, staff.email)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* School Monitor */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle>School Monitor (Peel/ON)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <h3 className="font-semibold text-foreground">All Grades</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Total Students"
                value={totalStudents}
                icon={Users}
                variant="primary"
              />
              <StatCard
                title="Total Benchmarks"
                value={totalBenchmarks}
                icon={BarChart3}
                variant="default"
              />
              <StatCard
                title="At Risk (Data/Flag)"
                value={atRiskCount}
                icon={AlertTriangle}
                variant="destructive"
              />
              <StatCard
                title="Avg Data/Student"
                value={avgDataPerStudent}
                icon={Activity}
                variant="success"
              />
            </div>

            {/* School Risk Profile placeholder */}
            <div className="border border-border/50 rounded-lg p-4 bg-muted/20">
              <h4 className="font-medium mb-2 text-foreground">School Risk Profile</h4>
              <div className="h-20 bg-muted/50 rounded flex items-center justify-center text-muted-foreground">
                Chart visualization
              </div>
            </div>

            {/* Areas of Need */}
            <div className="border border-border/50 rounded-lg p-4 bg-muted/20">
              <h4 className="font-medium mb-2 text-foreground">Areas of Need</h4>
              <div className="text-muted-foreground text-sm">
                Analysis based on benchmark data will appear here.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grade & Teacher Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle>Grade Analytics & Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Grade</TableHead>
                  <TableHead>Students</TableHead>
                  <TableHead>At Risk %</TableHead>
                  <TableHead>Stable %</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gradeAnalytics.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No grade data yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  gradeAnalytics.map(grade => (
                    <TableRow key={grade.grade} className="hover:bg-muted/30">
                      <TableCell className="font-medium">Grade {grade.grade}</TableCell>
                      <TableCell>{grade.students}</TableCell>
                      <TableCell>
                        <span className="text-destructive font-medium">{grade.atRiskPercent}%</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-success font-medium">{grade.stablePercent}%</span>
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm">View</Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle>Teacher Analytics</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Teacher</TableHead>
                  <TableHead>Class Size</TableHead>
                  <TableHead>Benchmarks</TableHead>
                  <TableHead>Class Risk %</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No teacher data yet.
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Tracked Students & AI Strategy */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle>Tracked Students (At-Risk)</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Student</TableHead>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.filter(s => s.isHighNeed).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No at-risk students flagged.
                    </TableCell>
                  </TableRow>
                ) : (
                  students.filter(s => s.isHighNeed).map(student => (
                    <TableRow key={student.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium">{student.studentNumber}</TableCell>
                      <TableCell>{student.homeroom || '-'}</TableCell>
                      <TableCell>
                        <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">Manual flag</span>
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm">View</Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm border-l-4 border-l-primary">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Strategy (Peel/ON)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Select value={selectedProgram} onValueChange={setSelectedProgram}>
                <SelectTrigger className="flex-1 focus:ring-primary">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fi">French Immersion</SelectItem>
                  <SelectItem value="english">English Program</SelectItem>
                  <SelectItem value="all">All Programs</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleAnalyze} disabled={isAnalyzing}>
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Analyze
                  </>
                )}
              </Button>
            </div>
            
            {aiRecommendations ? (
              <div className="border border-primary/20 rounded-lg p-4 bg-primary/5">
                <h4 className="font-medium mb-2 text-primary">AI Recommendations</h4>
                <div className="text-sm whitespace-pre-wrap">{aiRecommendations}</div>
              </div>
            ) : (
              <div className="border border-border/50 rounded-lg p-4 bg-muted/20">
                <p className="text-muted-foreground text-sm">
                  Click "Analyze" to generate AI-powered recommendations based on your school data.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
