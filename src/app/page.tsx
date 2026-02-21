'use client';

import { useState, useEffect, useMemo } from 'react';
import { format, subDays, startOfWeek, startOfMonth, endOfWeek, endOfMonth } from 'date-fns';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts';
import {
  Activity,
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  Filter,
  Flame,
  Info,
  Loader2,
  Plus,
  RefreshCw,
  Target,
  TrendingUp,
  X,
  Sparkles,
  Trophy,
  Mic,
  Grid3X3,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { ChartContainer, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

// Custom components
import { VoiceInput } from '@/components/habits/voice-input';
import { InsightsPanel } from '@/components/habits/insights-panel';
import { GamificationDisplay } from '@/components/habits/gamification-display';
import { SentimentHeatmap } from '@/components/habits/sentiment-heatmap';
import { HabitStacking } from '@/components/habits/habit-stacking';

// Types
interface ParsedHabit {
  activity: string;
  category: string | null;
  quantity: number | null;
  unit: string | null;
  mood: string | null;
  sentiment: string;
  notes: string | null;
  tags: string[];
  type?: string; // positive habit, negative behavior, neutral activity, emotional event
  trigger?: string | null;
  context?: string | null;
}

interface HabitEntry {
  id: string;
  rawText: string;
  activity: string;
  type: string | null;
  category: string | null;
  quantity: number | null;
  unit: string | null;
  mood: string | null;
  sentiment: string | null;
  trigger: string | null;
  notes: string | null;
  tags: string | null;
  date: string;
}

interface Goal {
  id: string;
  title: string;
  activity: string;
  targetValue: number;
  currentValue: number;
  unit: string | null;
  period: string;
  isActive: boolean;
}

interface Stats {
  summary: {
    totalEntries: number;
    totalDistance: number;
    totalDuration: number;
    avgQuantity: number;
    mostFrequentActivity: string;
    mostFrequentCategory: string;
    moodDistribution: Record<string, number>;
    sentimentDistribution: Record<string, number>;
    activityBreakdown: Record<string, number>;
    categoryBreakdown: Record<string, number>;
  };
  trends: Array<{
    date: string;
    count: number;
    totalQuantity: number;
    activities: Record<string, number>;
    avgMood: number;
  }>;
  streaks: {
    current: number;
    longest: number;
    totalDays: number;
  };
}

const MOOD_COLORS: Record<string, string> = {
  happy: '#22c55e',
  great: '#22c55e',
  energized: '#84cc16',
  good: '#a3e635',
  relaxed: '#14b8a6',
  neutral: '#6b7280',
  tired: '#f59e0b',
  stressed: '#f97316',
  sad: '#ef4444',
  bad: '#dc2626',
};

const CATEGORY_COLORS: Record<string, string> = {
  exercise: '#f97316',
  nutrition: '#22c55e',
  mindfulness: '#8b5cf6',
  productivity: '#3b82f6',
  sleep: '#6366f1',
  hydration: '#06b6d4',
  wellness: '#ec4899',
};

const SENTIMENT_COLORS: Record<string, string> = {
  positive: '#22c55e',
  neutral: '#6b7280',
  negative: '#ef4444',
};

export default function HabitTracker() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Form state
  const [habitText, setHabitText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedHabit | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
  // Data state
  const [habits, setHabits] = useState<HabitEntry[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filter state
  const [filterActivity, setFilterActivity] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterMood, setFilterMood] = useState<string>('');
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  
  // Goal modal state
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [newGoal, setNewGoal] = useState({
    title: '',
    activity: '',
    targetValue: '',
    unit: '',
    period: 'monthly',
  });

  // Voice input handler
  const handleVoiceTranscript = (text: string) => {
    setHabitText(text);
    // Auto-trigger parsing after voice input
    setTimeout(() => {
      parseHabitText();
    }, 500);
  };

  // Fetch data on mount
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [habitsRes, goalsRes, statsRes] = await Promise.all([
        fetch('/api/habits?limit=100'),
        fetch('/api/goals'),
        fetch('/api/habits/stats'),
      ]);

      if (habitsRes.ok) {
        const habitsData = await habitsRes.json();
        setHabits(habitsData.data || []);
      }

      if (goalsRes.ok) {
        const goalsData = await goalsRes.json();
        setGoals(goalsData.data || []);
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData.data);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load data. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Parse habit text
  const parseHabitText = async () => {
    if (!habitText.trim()) return;
    
    setIsParsing(true);
    try {
      const res = await fetch('/api/habits/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: habitText }),
      });

      if (res.ok) {
        const data = await res.json();
        setParsedData(data.data);
      } else {
        toast({
          title: 'Parse Error',
          description: 'Could not parse your habit. Please try again.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Parse error:', error);
      toast({
        title: 'Error',
        description: 'Failed to parse habit text.',
        variant: 'destructive',
      });
    } finally {
      setIsParsing(false);
    }
  };

  // Save habit
  const saveHabit = async () => {
    if (!parsedData) return;

    try {
      const res = await fetch('/api/habits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText: habitText,
          ...parsedData,
          date: selectedDate.toISOString(),
        }),
      });

      if (res.ok) {
        toast({
          title: 'Success!',
          description: 'Habit logged successfully.',
        });
        setHabitText('');
        setParsedData(null);
        fetchData();
      } else {
        toast({
          title: 'Error',
          description: 'Failed to save habit.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: 'Error',
        description: 'Failed to save habit.',
        variant: 'destructive',
      });
    }
  };

  // Create goal
  const createGoal = async () => {
    if (!newGoal.title || !newGoal.activity || !newGoal.targetValue) return;

    try {
      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newGoal),
      });

      if (res.ok) {
        toast({
          title: 'Goal Created',
          description: 'Your goal has been set successfully.',
        });
        setIsGoalModalOpen(false);
        setNewGoal({ title: '', activity: '', targetValue: '', unit: '', period: 'monthly' });
        fetchData();
      }
    } catch (error) {
      console.error('Goal error:', error);
      toast({
        title: 'Error',
        description: 'Failed to create goal.',
        variant: 'destructive',
      });
    }
  };

  // Export CSV
  const exportCSV = async () => {
    const params = new URLSearchParams();
    if (filterActivity) params.set('activity', filterActivity);
    if (filterCategory) params.set('category', filterCategory);
    if (dateRange.from) params.set('startDate', dateRange.from.toISOString());
    if (dateRange.to) params.set('endDate', dateRange.to.toISOString());

    window.location.href = `/api/habits/export?${params.toString()}`;
  };

  // Filtered habits
  const filteredHabits = useMemo(() => {
    return habits.filter((habit) => {
      if (filterActivity && !habit.activity.toLowerCase().includes(filterActivity.toLowerCase())) return false;
      if (filterCategory && habit.category !== filterCategory) return false;
      if (filterMood && habit.mood !== filterMood) return false;
      if (dateRange.from && new Date(habit.date) < dateRange.from) return false;
      if (dateRange.to && new Date(habit.date) > dateRange.to) return false;
      return true;
    });
  }, [habits, filterActivity, filterCategory, filterMood, dateRange]);

  // Chart data
  const trendChartData = useMemo(() => {
    if (!stats?.trends) return [];
    return stats.trends.slice(-14).map((trend) => ({
      date: format(new Date(trend.date), 'MMM dd'),
      count: trend.count,
      quantity: Math.round(trend.totalQuantity * 10) / 10,
      mood: Math.round(trend.avgMood * 10) / 10,
    }));
  }, [stats?.trends]);

  const activityChartData = useMemo(() => {
    if (!stats?.summary.activityBreakdown) return [];
    return Object.entries(stats.summary.activityBreakdown)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [stats?.summary.activityBreakdown]);

  const moodChartData = useMemo(() => {
    if (!stats?.summary.moodDistribution) return [];
    return Object.entries(stats.summary.moodDistribution).map(([name, value]) => ({
      name,
      value,
      fill: MOOD_COLORS[name] || '#6b7280',
    }));
  }, [stats?.summary.moodDistribution]);

  const sentimentChartData = useMemo(() => {
    if (!stats?.summary.sentimentDistribution) return [];
    return Object.entries(stats.summary.sentimentDistribution).map(([name, value]) => ({
      name,
      value,
      fill: SENTIMENT_COLORS[name] || '#6b7280',
    }));
  }, [stats?.summary.sentimentDistribution]);

  const chartConfig: ChartConfig = {
    count: { label: 'Entries', color: '#f97316' },
    quantity: { label: 'Quantity', color: '#3b82f6' },
    mood: { label: 'Mood Score', color: '#22c55e' },
  };

  const quickFilters = [
    { label: 'Today', from: new Date(), to: new Date() },
    { label: 'This Week', from: startOfWeek(new Date()), to: endOfWeek(new Date()) },
    { label: 'This Month', from: startOfMonth(new Date()), to: endOfMonth(new Date()) },
    { label: 'Last 7 Days', from: subDays(new Date(), 7), to: new Date() },
    { label: 'Last 30 Days', from: subDays(new Date(), 30), to: new Date() },
  ];

  const uniqueActivities = [...new Set(habits.map((h) => h.activity).filter(Boolean))];
  const uniqueCategories = [...new Set(habits.map((h) => h.category).filter(Boolean))];
  const uniqueMoods = [...new Set(habits.map((h) => h.mood).filter(Boolean))];

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading your habit data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="bg-gradient-to-br from-orange-500 to-amber-500 p-2 rounded-lg">
                <Activity className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold">NLP Habit Tracker</h1>
                <p className="text-xs text-muted-foreground hidden sm:block">AI-Powered Habit Analytics</p>
              </div>
            </div>
            <nav className="flex items-center gap-2">
              <Button
                variant={activeTab === 'dashboard' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('dashboard')}
              >
                Dashboard
              </Button>
              <Button
                variant={activeTab === 'about' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('about')}
              >
                About
              </Button>
              <Button variant="outline" size="sm" onClick={fetchData}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-6">
        {activeTab === 'about' ? (
          <AboutPage />
        ) : (
          <div className="space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Entries</CardDescription>
                  <CardTitle className="text-2xl">{stats?.summary.totalEntries || 0}</CardTitle>
                </CardHeader>
                <CardContent className="pb-3">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Activity className="h-4 w-4 mr-1" />
                    habits tracked
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Current Streak</CardDescription>
                  <CardTitle className="text-2xl">{stats?.streaks.current || 0}</CardTitle>
                </CardHeader>
                <CardContent className="pb-3">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Flame className="h-4 w-4 mr-1 text-orange-500" />
                    days in a row
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Distance</CardDescription>
                  <CardTitle className="text-2xl">{Math.round(stats?.summary.totalDistance || 0)} km</CardTitle>
                </CardHeader>
                <CardContent className="pb-3">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <TrendingUp className="h-4 w-4 mr-1 text-green-500" />
                    logged
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Duration</CardDescription>
                  <CardTitle className="text-2xl">{Math.round(stats?.summary.totalDuration || 0)} min</CardTitle>
                </CardHeader>
                <CardContent className="pb-3">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Clock className="h-4 w-4 mr-1 text-blue-500" />
                    active time
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Main Input Section */}
            <Card className="border-2 border-dashed border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Log a New Habit
                </CardTitle>
                <CardDescription>
                  Type naturally like &quot;ran 5km today, felt great&quot; and AI will extract the details
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Textarea
                        placeholder="e.g., Meditated for 20 minutes this morning, feeling calm and focused..."
                        value={habitText}
                        onChange={(e) => setHabitText(e.target.value)}
                        className="flex-1 min-h-[60px] resize-none"
                      />
                      <div className="flex sm:flex-col gap-2">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="flex-1 sm:flex-none justify-start">
                              <Calendar className="h-4 w-4 mr-2" />
                              {format(selectedDate, 'MMM dd')}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent
                              mode="single"
                              selected={selectedDate}
                              onSelect={(date) => date && setSelectedDate(date)}
                            />
                          </PopoverContent>
                        </Popover>
                        <Button onClick={parseHabitText} disabled={isParsing || !habitText.trim()} className="flex-1 sm:flex-none">
                          {isParsing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Activity className="h-4 w-4 mr-2" />
                              Parse
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                    {/* Voice Input */}
                    <VoiceInput onTranscript={handleVoiceTranscript} />
                  </div>

                  {/* Parsed Result Preview */}
                  {parsedData && (
                    <div className="bg-background rounded-lg border p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-sm flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          Parsed Result
                        </h4>
                        <Button size="sm" onClick={saveHabit}>
                          <Plus className="h-4 w-4 mr-2" />
                          Save Entry
                        </Button>
                      </div>
                      
                      {/* Type Badge */}
                      {parsedData.type && (
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={
                              parsedData.type.includes('positive') ? 'default' : 
                              parsedData.type.includes('negative') ? 'destructive' : 'secondary'
                            }
                            className="text-xs"
                          >
                            {parsedData.type}
                          </Badge>
                          <Badge 
                            variant="outline"
                            style={{ 
                              borderColor: SENTIMENT_COLORS[parsedData.sentiment] || '#6b7280', 
                              color: SENTIMENT_COLORS[parsedData.sentiment] || '#6b7280' 
                            }}
                          >
                            {parsedData.sentiment} sentiment
                          </Badge>
                        </div>
                      )}
                      
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                        <div>
                          <span className="text-muted-foreground block text-xs mb-1">Activity:</span>
                          <Badge 
                            variant={parsedData.type?.includes('negative') ? 'destructive' : 'secondary'}
                          >
                            {parsedData.activity}
                          </Badge>
                        </div>
                        {parsedData.category && (
                          <div>
                            <span className="text-muted-foreground block text-xs mb-1">Category:</span>
                            <Badge variant="outline">
                              {parsedData.category}
                            </Badge>
                          </div>
                        )}
                        {parsedData.quantity !== null && (
                          <div>
                            <span className="text-muted-foreground block text-xs mb-1">Quantity:</span>
                            <Badge variant="outline">
                              {parsedData.quantity} {parsedData.unit || ''}
                            </Badge>
                          </div>
                        )}
                        {parsedData.mood && (
                          <div>
                            <span className="text-muted-foreground block text-xs mb-1">Mood:</span>
                            <Badge
                              variant="outline"
                              style={{ borderColor: MOOD_COLORS[parsedData.mood], color: MOOD_COLORS[parsedData.mood] }}
                            >
                              {parsedData.mood}
                            </Badge>
                          </div>
                        )}
                      </div>
                      
                      {/* Trigger */}
                      {parsedData.trigger && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">Trigger: </span>
                          <span className="font-medium">{parsedData.trigger}</span>
                        </div>
                      )}
                      
                      {/* Notes */}
                      {parsedData.notes && (
                        <div className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                          {parsedData.notes}
                        </div>
                      )}
                      
                      {/* Tags */}
                      {parsedData.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {parsedData.tags.map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Filters Section */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Filters & Pivot
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={exportCSV}>
                      <Download className="h-4 w-4 mr-1" />
                      Export CSV
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setFilterActivity('');
                        setFilterCategory('');
                        setFilterMood('');
                        setDateRange({ from: undefined, to: undefined });
                      }}
                    >
                      Clear All
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Quick Filters */}
                  <div className="flex flex-wrap gap-2">
                    {quickFilters.map((filter) => (
                      <Button
                        key={filter.label}
                        variant="outline"
                        size="sm"
                        onClick={() => setDateRange({ from: filter.from, to: filter.to })}
                        className={
                          dateRange.from?.getTime() === filter.from.getTime() &&
                          dateRange.to?.getTime() === filter.to.getTime()
                            ? 'bg-primary text-primary-foreground'
                            : ''
                        }
                      >
                        {filter.label}
                      </Button>
                    ))}
                  </div>

                  {/* Dropdown Filters */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <Select value={filterActivity || 'all'} onValueChange={(v) => setFilterActivity(v === 'all' ? '' : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Activities" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Activities</SelectItem>
                        {uniqueActivities.map((activity) => (
                          <SelectItem key={activity} value={activity}>
                            {activity}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={filterCategory || 'all'} onValueChange={(v) => setFilterCategory(v === 'all' ? '' : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Categories" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {uniqueCategories.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={filterMood || 'all'} onValueChange={(v) => setFilterMood(v === 'all' ? '' : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Moods" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Moods</SelectItem>
                        {uniqueMoods.map((mood) => (
                          <SelectItem key={mood} value={mood}>
                            {mood}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline">
                          <Calendar className="h-4 w-4 mr-2" />
                          {dateRange.from ? (
                            dateRange.to ? (
                              <>
                                {format(dateRange.from, 'MMM dd')} - {format(dateRange.to, 'MMM dd')}
                              </>
                            ) : (
                              format(dateRange.from, 'MMM dd')
                            )
                          ) : (
                            'Custom Range'
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="range"
                          selected={{
                            from: dateRange.from,
                            to: dateRange.to,
                          }}
                          onSelect={(range) => setDateRange({ from: range?.from, to: range?.to })}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Charts Section */}
            <Tabs defaultValue="trends" className="space-y-4">
              <TabsList>
                <TabsTrigger value="trends">Trends</TabsTrigger>
                <TabsTrigger value="activities">Activities</TabsTrigger>
                <TabsTrigger value="mood">Mood</TabsTrigger>
              </TabsList>

              <TabsContent value="trends" className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Daily Entries Trend</CardTitle>
                      <CardDescription>Habits logged per day over the last 2 weeks</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ChartContainer config={chartConfig} className="h-[250px]">
                        <LineChart data={trendChartData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="date" className="text-xs" />
                          <YAxis className="text-xs" />
                          <Tooltip content={<ChartTooltipContent />} />
                          <Line
                            type="monotone"
                            dataKey="count"
                            stroke="#f97316"
                            strokeWidth={2}
                            dot={{ fill: '#f97316' }}
                          />
                        </LineChart>
                      </ChartContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Quantity Trend</CardTitle>
                      <CardDescription>Total quantities logged over time</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ChartContainer config={chartConfig} className="h-[250px]">
                        <BarChart data={trendChartData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="date" className="text-xs" />
                          <YAxis className="text-xs" />
                          <Tooltip content={<ChartTooltipContent />} />
                          <Bar dataKey="quantity" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ChartContainer>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="activities" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Activity Breakdown</CardTitle>
                    <CardDescription>Most frequent activities</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer config={chartConfig} className="h-[300px]">
                      <BarChart data={activityChartData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" className="text-xs" />
                        <YAxis dataKey="name" type="category" width={80} className="text-xs" />
                        <Tooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                          {activityChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={Object.values(CATEGORY_COLORS)[index % Object.values(CATEGORY_COLORS).length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ChartContainer>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="mood" className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Mood Distribution</CardTitle>
                      <CardDescription>How you&apos;ve been feeling</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ChartContainer config={chartConfig} className="h-[250px]">
                        <PieChart>
                          <Pie
                            data={moodChartData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          >
                            {moodChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ChartContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Sentiment Overview</CardTitle>
                      <CardDescription>Overall emotional trend</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ChartContainer config={chartConfig} className="h-[250px]">
                        <PieChart>
                          <Pie
                            data={sentimentChartData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          >
                            {sentimentChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ChartContainer>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>

            {/* Goals Section */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Goals
                    </CardTitle>
                    <CardDescription>Track your progress towards monthly targets</CardDescription>
                  </div>
                  <Dialog open={isGoalModalOpen} onOpenChange={setIsGoalModalOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="h-4 w-4 mr-1" />
                        Add Goal
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create New Goal</DialogTitle>
                        <DialogDescription>Set a target for your habit tracking</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 pt-4">
                        <Input
                          placeholder="Goal title (e.g., Run 50km per month)"
                          value={newGoal.title}
                          onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
                        />
                        <Input
                          placeholder="Activity (e.g., run, swim, read)"
                          value={newGoal.activity}
                          onChange={(e) => setNewGoal({ ...newGoal, activity: e.target.value })}
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <Input
                            type="number"
                            placeholder="Target value"
                            value={newGoal.targetValue}
                            onChange={(e) => setNewGoal({ ...newGoal, targetValue: e.target.value })}
                          />
                          <Input
                            placeholder="Unit (km, hours, etc.)"
                            value={newGoal.unit}
                            onChange={(e) => setNewGoal({ ...newGoal, unit: e.target.value })}
                          />
                        </div>
                        <Select value={newGoal.period} onValueChange={(v) => setNewGoal({ ...newGoal, period: v })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button className="w-full" onClick={createGoal}>
                          Create Goal
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {goals.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Target className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No goals set yet. Add your first goal to start tracking!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {goals.map((goal) => {
                      const progress = Math.min((goal.currentValue / goal.targetValue) * 100, 100);
                      const isComplete = progress >= 100;
                      return (
                        <Card key={goal.id} className={isComplete ? 'border-green-500 bg-green-50 dark:bg-green-950' : ''}>
                          <CardContent className="pt-4">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <h4 className="font-medium">{goal.title}</h4>
                                <p className="text-sm text-muted-foreground">
                                  {goal.currentValue.toFixed(1)} / {goal.targetValue} {goal.unit || ''}
                                </p>
                              </div>
                              {isComplete && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                            </div>
                            <Progress value={progress} className="h-2" />
                            <p className="text-xs text-muted-foreground mt-2 capitalize">{goal.period}</p>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* AI Insights & Gamification Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <InsightsPanel className="lg:col-span-2" />
              <GamificationDisplay />
            </div>

            {/* Sentiment Heatmap & Habit Stacking */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SentimentHeatmap />
              <HabitStacking />
            </div>

            {/* Recent Entries */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent Entries</CardTitle>
                <CardDescription>
                  Showing {filteredHabits.length} of {habits.length} entries
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  {filteredHabits.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No entries found. Try adjusting your filters or log a new habit!</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredHabits.map((habit) => {
                        const isNegative = habit.type?.includes('negative');
                        const isEmotional = habit.type?.includes('emotional');
                        const barColor = isNegative ? '#ef4444' : isEmotional ? '#8b5cf6' : CATEGORY_COLORS[habit.category || 'wellness'] || '#6b7280';
                        
                        return (
                          <div
                            key={habit.id}
                            className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
                              isNegative ? 'bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900' :
                              isEmotional ? 'bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900' :
                              'bg-muted/50 hover:bg-muted'
                            }`}
                          >
                            <div
                              className="w-2 h-full min-h-[40px] rounded-full flex-shrink-0"
                              style={{ backgroundColor: barColor }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                {/* Type Badge */}
                                {habit.type && (
                                  <Badge 
                                    variant={
                                      habit.type.includes('positive') ? 'default' : 
                                      habit.type.includes('negative') ? 'destructive' : 
                                      'secondary'
                                    }
                                    className="text-xs"
                                  >
                                    {habit.type}
                                  </Badge>
                                )}
                                <Badge 
                                  variant={isNegative ? 'destructive' : 'secondary'}
                                >
                                  {habit.activity}
                                </Badge>
                                {habit.category && <Badge variant="outline">{habit.category}</Badge>}
                                {habit.quantity !== null && (
                                  <Badge variant="outline">
                                    {habit.quantity} {habit.unit || ''}
                                  </Badge>
                                )}
                                {habit.mood && (
                                  <Badge
                                    variant="outline"
                                    style={{ borderColor: MOOD_COLORS[habit.mood], color: MOOD_COLORS[habit.mood] }}
                                  >
                                    {habit.mood}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">{habit.rawText}</p>
                              {/* Trigger */}
                              {habit.trigger && (
                                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                                  <span className="font-medium">Trigger:</span> {habit.trigger}
                                </p>
                              )}
                              {/* Notes */}
                              {habit.notes && (
                                <p className="text-xs text-muted-foreground mt-1 italic">
                                  {habit.notes}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground mt-1">
                                {format(new Date(habit.date), 'MMM dd, yyyy • h:mm a')}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-background border-t py-4 mt-auto">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>NLP Habit Tracker — AI-Powered Habit Analytics</p>
        </div>
      </footer>
    </div>
  );
}

// About Page Component
function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">About NLP Habit Tracker</CardTitle>
          <CardDescription>Transform casual habit logs into actionable insights</CardDescription>
        </CardHeader>
        <CardContent className="prose prose-sm dark:prose-invert max-w-none">
          <p>
            The NLP Habit Tracker is a full-stack application that uses Natural Language Processing to transform your
            casual, free-text habit entries into structured, analyzable data. Perfect for anyone who wants to track
            habits without the friction of filling out complex forms.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">How to Use</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                1
              </div>
              <div>
                <h3 className="font-medium">Log Your Habits Naturally</h3>
                <p className="text-muted-foreground text-sm">
                  Type your habit entries in plain English. The AI handles both positive AND negative behaviors:
                </p>
                <div className="mt-2 space-y-2">
                  <div>
                    <span className="text-xs font-semibold text-green-600 dark:text-green-400">POSITIVE:</span>
                    <div className="mt-1">
                      <Badge variant="outline" className="mr-2">ran 5km today, felt great</Badge>
                      <Badge variant="outline" className="mr-2">meditated for 20 minutes</Badge>
                      <Badge variant="outline" className="mr-2">read 30 pages</Badge>
                    </div>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-red-600 dark:text-red-400">NEGATIVE:</span>
                    <div className="mt-1">
                      <Badge variant="outline" className="mr-2 border-red-300">skip school, mom mad at me</Badge>
                      <Badge variant="outline" className="mr-2 border-red-300">procrastinated all day</Badge>
                      <Badge variant="outline" className="mr-2 border-red-300">stayed up until 3am</Badge>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                2
              </div>
              <div>
                <h3 className="font-medium">AI Understands Context</h3>
                <p className="text-muted-foreground text-sm">
                  The AI extracts rich context from your entries:
                </p>
                <ul className="mt-2 text-sm text-muted-foreground list-disc list-inside space-y-1">
                  <li><strong>Activity:</strong> What actually happened (skip school, run, argue)</li>
                  <li><strong>Type:</strong> positive habit, negative behavior, emotional event</li>
                  <li><strong>Category:</strong> education, exercise, relationships, mental health</li>
                  <li><strong>Mood:</strong> How you felt (guilty, stressed, proud, happy)</li>
                  <li><strong>Trigger:</strong> What caused it (mom angry, deadline, tired)</li>
                  <li><strong>Sentiment:</strong> Overall emotional tone</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                3
              </div>
              <div>
                <h3 className="font-medium">Review & Save</h3>
                <p className="text-muted-foreground text-sm">
                  Check the parsed results and click &quot;Save Entry&quot; to store your habit. You can also select a different
                  date if you&apos;re logging a past habit.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                4
              </div>
              <div>
                <h3 className="font-medium">Analyze Your Trends</h3>
                <p className="text-muted-foreground text-sm">
                  Use the tabs to explore:
                </p>
                <ul className="mt-2 text-sm text-muted-foreground list-disc list-inside space-y-1">
                  <li><strong>Trends:</strong> Line and bar charts showing your activity over time</li>
                  <li><strong>Activities:</strong> Breakdown of your most frequent habits</li>
                  <li><strong>Mood:</strong> Distribution of your emotional states</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                5
              </div>
              <div>
                <h3 className="font-medium">Set Goals & Track Progress</h3>
                <p className="text-muted-foreground text-sm">
                  Create monthly targets like &quot;Run 50km&quot; or &quot;Meditate 10 hours&quot;. The tracker automatically updates your
                  progress as you log related activities.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                6
              </div>
              <div>
                <h3 className="font-medium">Filter & Export</h3>
                <p className="text-muted-foreground text-sm">
                  Use the pivot-style filters to narrow down by activity, category, mood, or date range. Export your
                  data to CSV for deeper analysis in Excel or other tools.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Example Entries</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-green-600 dark:text-green-400 mb-2">Positive Habits</h4>
              <div className="space-y-2">
                {[
                  { input: 'Ran 5km this morning, felt energized', output: { activity: 'run', type: 'positive habit', quantity: 5, unit: 'km', mood: 'energized', category: 'exercise' } },
                  { input: 'Meditated for 15 minutes, feeling calm', output: { activity: 'meditate', type: 'positive habit', quantity: 15, unit: 'minutes', mood: 'calm', category: 'mindfulness' } },
                  { input: 'Finally cleaned my room after 2 weeks', output: { activity: 'clean room', type: 'positive habit', mood: 'accomplished', category: 'personal growth' } },
                ].map((example, i) => (
                  <div key={i} className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900">
                    <p className="font-medium text-sm">&quot;{example.input}&quot;</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      <Badge variant="default">{example.output.type}</Badge>
                      <Badge variant="secondary">{example.output.activity}</Badge>
                      {example.output.category && <Badge variant="outline">{example.output.category}</Badge>}
                      {example.output.quantity && (
                        <Badge variant="outline">{example.output.quantity} {example.output.unit}</Badge>
                      )}
                      {example.output.mood && <Badge variant="outline">{example.output.mood}</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div>
              <h4 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2">Negative Behaviors</h4>
              <div className="space-y-2">
                {[
                  { input: 'Mom mad at me because I skipped school', output: { activity: 'skip school', type: 'negative behavior', mood: 'guilty', category: 'education', trigger: 'mom angry' } },
                  { input: 'Procrastinated all day, feel like a failure', output: { activity: 'procrastinate', type: 'negative behavior', mood: 'ashamed', category: 'productivity', trigger: 'lack of motivation' } },
                  { input: 'Stayed up until 3am doom scrolling again', output: { activity: 'doom scroll', type: 'negative behavior', mood: 'regretful', category: 'sleep', trigger: 'insomnia' } },
                  { input: 'Had a panic attack before my presentation', output: { activity: 'panic attack', type: 'emotional event', mood: 'anxious', category: 'mental health', trigger: 'presentation stress' } },
                ].map((example, i) => (
                  <div key={i} className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900">
                    <p className="font-medium text-sm">&quot;{example.input}&quot;</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      <Badge variant="destructive">{example.output.type}</Badge>
                      <Badge variant="destructive">{example.output.activity}</Badge>
                      {example.output.category && <Badge variant="outline">{example.output.category}</Badge>}
                      {example.output.mood && <Badge variant="outline">{example.output.mood}</Badge>}
                      {example.output.trigger && <Badge variant="outline" className="text-amber-600">trigger: {example.output.trigger}</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tips for Better Results</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
              <span>Be honest - log both positive AND negative behaviors for accurate self-awareness</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
              <span>Include context about what triggered or influenced the behavior</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
              <span>Mention your mood or feelings for richer emotional tracking</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
              <span>Add time context (morning, evening, today, yesterday)</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
              <span>The AI understands typos and informal language - just write naturally</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Privacy Note</AlertTitle>
        <AlertDescription>
          Your habit data is stored locally and processed securely. The AI parsing uses secure API calls to extract
          structured information from your entries.
        </AlertDescription>
      </Alert>
    </div>
  );
}
