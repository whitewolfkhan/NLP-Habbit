import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

interface ParsedHabit {
  activity: string;
  category: string | null;
  quantity: number | null;
  unit: string | null;
  mood: string | null;
  sentiment: string;
  notes: string | null;
  tags: string[];
  type?: string; // positive habit, negative habit/behavior, neutral
  trigger?: string | null; // what caused or influenced this
  context?: string | null; // additional context
}

// POST /api/habits/parse - Parse free-text habit entry using NLP
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Text is required' },
        { status: 400 }
      );
    }

    const parsed = await parseHabitText(text);

    return NextResponse.json({
      success: true,
      data: {
        rawText: text,
        ...parsed,
      },
    });
  } catch (error) {
    console.error('Error parsing habit:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to parse habit text' },
      { status: 500 }
    );
  }
}

async function parseHabitText(text: string): Promise<ParsedHabit> {
  try {
    const zai = await ZAI.create();

    const systemPrompt = `You are an expert NLP assistant specializing in habit tracking and behavioral analysis. Your job is to extract structured, meaningful data from casual, free-text journal entries.

CRITICAL: You must handle ALL types of entries, including:
- POSITIVE habits (exercise, reading, meditation, healthy eating)
- NEGATIVE behaviors (procrastination, skipping responsibilities, bad habits, conflicts)
- NEUTRAL observations (weather, daily activities, observations)
- COMPLEX situations (interpersonal conflicts, emotional events, consequences)

ANALYSIS FRAMEWORK:

1. **Activity** (required): What actually happened?
   - For POSITIVE: the good habit performed (run, read, meditate, eat healthy)
   - For NEGATIVE: the negative behavior (skip school, procrastinate, argue, oversleep)
   - Be specific but concise (2-3 words max)
   - Examples: "skip school", "argue with mom", "procrastinate homework", "run 5km", "eat salad"

2. **Type**: Classify the behavior
   - "positive habit" - constructive, healthy, goal-oriented
   - "negative behavior" - detrimental, avoidant, harmful
   - "neutral activity" - neither good nor bad
   - "emotional event" - mood-focused situation

3. **Category**: Broad classification
   - exercise, nutrition, sleep, mindfulness, productivity, education
   - relationships, family, work, health, finance, personal_growth
   - social, entertainment, self_care, habits (for general behaviors)

4. **Mood**: Emotional state (detect from context)
   - Positive: happy, proud, accomplished, energized, calm, grateful
   - Negative: stressed, guilty, anxious, sad, angry, frustrated, ashamed
   - Neutral: neutral, indifferent, tired
   - Consider the FULL context, not just keywords

5. **Sentiment**: Overall tone
   - "positive" - entry reflects good feelings or progress
   - "negative" - entry reflects distress, conflict, or setbacks
   - "neutral" - entry is factual or mixed

6. **Trigger** (important for negative behaviors): What caused/influenced this?
   - External: "mom angry", "work deadline", "friend pressure"
   - Internal: "felt lazy", "lack of motivation", "tired"
   - Situational: "missed alarm", "bad weather", "sick"

7. **Quantity/Unit**: If measurable
   - Numbers mentioned: duration, distance, count, etc.
   - Only if explicitly stated or strongly implied

8. **Tags**: Contextual markers
   - Time: morning, evening, today, yesterday, weekend
   - Location: home, school, work, gym, outdoor
   - Social: solo, family, friends, group
   - Status: planned, unplanned, recurring

EXAMPLES OF COMPLEX ENTRIES:

Input: "mom mastiffs on me, because I don't go to school"
Analysis: User didn't go to school, mom is angry/mad at them
Output:
{
  "activity": "skip school",
  "type": "negative behavior",
  "category": "education",
  "mood": "guilty",
  "sentiment": "negative",
  "trigger": "mom angry",
  "notes": "Mother is upset/mad because user skipped school",
  "tags": ["family conflict", "school", "today"]
}

Input: "procrastinated all day, feel like a failure"
Output:
{
  "activity": "procrastinate",
  "type": "negative behavior",
  "category": "productivity",
  "mood": "ashamed",
  "sentiment": "negative",
  "trigger": "lack of motivation",
  "notes": "Procrastinated throughout the day, feeling self-critical"
}

Input: "ate a whole pizza alone while binge watching, feel disgusting"
Output:
{
  "activity": "binge eat",
  "type": "negative behavior",
  "category": "nutrition",
  "mood": "disgusted",
  "sentiment": "negative",
  "trigger": "emotional eating",
  "quantity": 1,
  "unit": "pizza",
  "tags": ["alone", "emotional eating", "evening"]
}

Input: "stayed up until 3am doom scrolling again"
Output:
{
  "activity": "doom scroll",
  "type": "negative behavior",
  "category": "sleep",
  "mood": "regretful",
  "sentiment": "negative",
  "trigger": "insomnia",
  "quantity": 3,
  "unit": "hours past bedtime",
  "tags": ["night", "phone", "recurring"]
}

Input: "had a panic attack before my presentation"
Output:
{
  "activity": "panic attack",
  "type": "emotional event",
  "category": "mental health",
  "mood": "anxious",
  "sentiment": "negative",
  "trigger": "presentation stress",
  "tags": ["work", "stress", "morning"]
}

Input: "finally cleaned my room after 2 weeks, feels good"
Output:
{
  "activity": "clean room",
  "type": "positive habit",
  "category": "personal growth",
  "mood": "accomplished",
  "sentiment": "positive",
  "trigger": "motivation",
  "tags": ["home", "productivity"]
}

RESPOND WITH ONLY VALID JSON. No markdown, no explanation, just the JSON object.`;

    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: systemPrompt },
        { role: 'user', content: `Analyze this habit/behavior entry: "${text}"` },
      ],
      thinking: { type: 'disabled' },
    });

    const response = completion.choices[0]?.message?.content;

    if (!response) {
      throw new Error('No response from AI');
    }

    // Parse the JSON response
    let parsed: ParsedHabit;
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (e) {
      console.error('JSON parse error:', e);
      // Fallback to enhanced simple parsing
      parsed = enhancedFallbackParse(text);
    }

    // Ensure all required fields exist with intelligent defaults
    return {
      activity: parsed.activity || 'unspecified activity',
      category: parsed.category || inferCategoryFromActivity(parsed.activity || text),
      quantity: typeof parsed.quantity === 'number' ? parsed.quantity : null,
      unit: parsed.unit || null,
      mood: parsed.mood || inferMoodFromText(text),
      sentiment: parsed.sentiment || inferSentimentFromText(text),
      notes: parsed.notes || null,
      tags: Array.isArray(parsed.tags) ? parsed.tags : extractTags(text),
      type: parsed.type || 'neutral activity',
      trigger: parsed.trigger || null,
      context: parsed.context || null,
    };
  } catch (error) {
    console.error('NLP parsing error, using fallback:', error);
    return enhancedFallbackParse(text);
  }
}

// Enhanced fallback parser for when AI is unavailable
function enhancedFallbackParse(text: string): ParsedHabit {
  const lowerText = text.toLowerCase();
  
  // Comprehensive behavior patterns
  const behaviorPatterns: Array<{
    patterns: string[];
    activity: string;
    type: string;
    category: string;
    moodHint?: string;
    sentiment: string;
  }> = [
    // Negative behaviors - School/Work
    { patterns: ['skip school', 'skipped school', "don't go to school", 'miss school', 'missed school'], activity: 'skip school', type: 'negative behavior', category: 'education', moodHint: 'guilty', sentiment: 'negative' },
    { patterns: ['skip work', 'skipped work', 'miss work', 'missed work', "didn't go to work"], activity: 'skip work', type: 'negative behavior', category: 'work', moodHint: 'guilty', sentiment: 'negative' },
    { patterns: ['skip class', 'skipped class', 'miss class'], activity: 'skip class', type: 'negative behavior', category: 'education', moodHint: 'guilty', sentiment: 'negative' },
    
    // Negative behaviors - Procrastination
    { patterns: ['procrastinate', 'procrastinated', 'putting off', 'avoiding work', "didn't do"], activity: 'procrastinate', type: 'negative behavior', category: 'productivity', moodHint: 'frustrated', sentiment: 'negative' },
    
    // Negative behaviors - Sleep issues
    { patterns: ['stayed up', 'stay up', 'up all night', "couldn't sleep", 'insomnia'], activity: 'sleep late', type: 'negative behavior', category: 'sleep', moodHint: 'tired', sentiment: 'negative' },
    { patterns: ['oversleep', 'overslept', 'slept in', 'slept through'], activity: 'oversleep', type: 'negative behavior', category: 'sleep', moodHint: 'groggy', sentiment: 'negative' },
    { patterns: ['doom scroll', 'doom scrolling', 'scrolling all night'], activity: 'doom scroll', type: 'negative behavior', category: 'habits', moodHint: 'regretful', sentiment: 'negative' },
    
    // Negative behaviors - Eating
    { patterns: ['binge eat', 'binge eating', 'overeat', 'ate too much', 'stuff myself'], activity: 'binge eat', type: 'negative behavior', category: 'nutrition', moodHint: 'disgusted', sentiment: 'negative' },
    { patterns: ['skip meal', 'skipped meal', "didn't eat", 'forgot to eat'], activity: 'skip meal', type: 'negative behavior', category: 'nutrition', moodHint: 'tired', sentiment: 'negative' },
    
    // Negative behaviors - Social/Relationships
    { patterns: ['argue', 'argument', 'argued with', 'fight with', 'fought with'], activity: 'argue', type: 'negative behavior', category: 'relationships', moodHint: 'angry', sentiment: 'negative' },
    { patterns: ['ghost', 'ghosted', 'ignore', 'ignored'], activity: 'ignore someone', type: 'negative behavior', category: 'relationships', moodHint: 'guilty', sentiment: 'negative' },
    { patterns: ['yell', 'yelled', 'shout', 'shouted', 'scream', 'screamed'], activity: 'yell', type: 'negative behavior', category: 'relationships', moodHint: 'angry', sentiment: 'negative' },
    
    // Negative behaviors - Habits
    { patterns: ['smoke', 'smoked', 'had a cigarette', 'vape'], activity: 'smoke', type: 'negative behavior', category: 'health', moodHint: 'guilty', sentiment: 'negative' },
    { patterns: ['drink too much', 'got drunk', 'binge drink', 'hungover'], activity: 'drink alcohol', type: 'negative behavior', category: 'health', moodHint: 'regretful', sentiment: 'negative' },
    
    // Emotional events
    { patterns: ['panic attack', 'anxiety attack', 'panic'], activity: 'panic attack', type: 'emotional event', category: 'mental health', moodHint: 'anxious', sentiment: 'negative' },
    { patterns: ['cry', 'cried', 'crying', 'breakdown'], activity: 'cry', type: 'emotional event', category: 'mental health', moodHint: 'sad', sentiment: 'negative' },
    { patterns: ['depressed', 'depression', 'hopeless'], activity: 'feel depressed', type: 'emotional event', category: 'mental health', moodHint: 'sad', sentiment: 'negative' },
    
    // Conflicts
    { patterns: ['mom mad', 'mom angry', 'mom yelled', 'mother angry', 'mastiffs on me', 'parent angry', 'parents mad'], activity: 'family conflict', type: 'negative behavior', category: 'family', moodHint: 'stressed', sentiment: 'negative' },
    { patterns: ['dad mad', 'dad angry', 'father angry', 'father mad'], activity: 'family conflict', type: 'negative behavior', category: 'family', moodHint: 'stressed', sentiment: 'negative' },
    { patterns: ['grounded', 'in trouble', 'got in trouble'], activity: 'get in trouble', type: 'emotional event', category: 'family', moodHint: 'stressed', sentiment: 'negative' },
    
    // Positive activities - Exercise
    { patterns: ['ran', 'run', 'running', 'jog', 'jogging'], activity: 'run', type: 'positive habit', category: 'exercise', sentiment: 'positive' },
    { patterns: ['walk', 'walking', 'walked'], activity: 'walk', type: 'positive habit', category: 'exercise', sentiment: 'positive' },
    { patterns: ['swim', 'swam', 'swimming'], activity: 'swim', type: 'positive habit', category: 'exercise', sentiment: 'positive' },
    { patterns: ['gym', 'workout', 'work out', 'exercised', 'lift weights'], activity: 'workout', type: 'positive habit', category: 'exercise', sentiment: 'positive' },
    { patterns: ['yoga', 'stretching', 'stretched'], activity: 'yoga', type: 'positive habit', category: 'mindfulness', sentiment: 'positive' },
    
    // Positive activities - Mindfulness
    { patterns: ['meditat', 'mindful', 'meditation'], activity: 'meditate', type: 'positive habit', category: 'mindfulness', sentiment: 'positive' },
    { patterns: ['journal', 'wrote in journal', 'journaling'], activity: 'journal', type: 'positive habit', category: 'self care', sentiment: 'positive' },
    
    // Positive activities - Productivity
    { patterns: ['read', 'reading', 'studied', 'study'], activity: 'read', type: 'positive habit', category: 'productivity', sentiment: 'positive' },
    { patterns: ['finish', 'finished', 'completed', 'complete'], activity: 'complete task', type: 'positive habit', category: 'productivity', sentiment: 'positive' },
    { patterns: ['clean', 'cleaned', 'tidy', 'organized'], activity: 'clean', type: 'positive habit', category: 'personal growth', sentiment: 'positive' },
    
    // Positive activities - Health
    { patterns: ['sleep', 'slept', 'nap', 'napped'], activity: 'sleep', type: 'positive habit', category: 'sleep', sentiment: 'neutral' },
    { patterns: ['water', 'drank water', 'hydration', 'hydrated'], activity: 'drink water', type: 'positive habit', category: 'hydration', sentiment: 'positive' },
    { patterns: ['eat', 'ate', 'food', 'meal', 'salad', 'lunch', 'dinner', 'breakfast'], activity: 'eat', type: 'positive habit', category: 'nutrition', sentiment: 'neutral' },
  ];

  let detectedActivity = 'unspecified activity';
  let detectedType = 'neutral activity';
  let detectedCategory = 'habits';
  let detectedMood: string | undefined;
  let detectedSentiment = 'neutral';
  let detectedTrigger: string | null = null;

  // Try to match behavior patterns
  for (const pattern of behaviorPatterns) {
    if (pattern.patterns.some(p => lowerText.includes(p))) {
      detectedActivity = pattern.activity;
      detectedType = pattern.type;
      detectedCategory = pattern.category;
      detectedMood = pattern.moodHint;
      detectedSentiment = pattern.sentiment;
      break;
    }
  }

  // Detect triggers from text
  const triggerPatterns = [
    { patterns: ['mom', 'mother', 'mom angry', 'mom mad', 'mastiffs on me'], trigger: 'mom upset' },
    { patterns: ['dad', 'father'], trigger: 'dad upset' },
    { patterns: ['because', 'cause', 'since'], trigger: 'stated reason' },
    { patterns: ['deadline', 'due'], trigger: 'deadline pressure' },
    { patterns: ['tired', 'exhausted', 'no energy'], trigger: 'fatigue' },
    { patterns: ['stressed', 'anxious', 'worried'], trigger: 'stress' },
    { patterns: ['bored', 'boring'], trigger: 'boredom' },
  ];

  for (const tp of triggerPatterns) {
    if (tp.patterns.some(p => lowerText.includes(p))) {
      detectedTrigger = tp.trigger;
      break;
    }
  }

  // Extract quantity and unit
  const quantityRegex = /(\d+(?:\.\d+)?)\s*(km|mi|miles|minutes?|mins?|hours?|hrs?|pages?|glasses?|times?|reps?|sets?|cups?|days?|weeks?)/i;
  const match = lowerText.match(quantityRegex);
  
  let quantity: number | null = null;
  let unit: string | null = null;
  
  if (match) {
    quantity = parseFloat(match[1]);
    unit = match[2].toLowerCase();
    if (unit === 'min' || unit === 'mins') unit = 'minutes';
    if (unit === 'hr' || unit === 'hrs') unit = 'hours';
    if (unit === 'mi') unit = 'miles';
  }

  // Detect mood if not already set
  if (!detectedMood) {
    detectedMood = inferMoodFromText(text);
  }

  // Detect sentiment if not already set
  if (detectedSentiment === 'neutral') {
    detectedSentiment = inferSentimentFromText(text);
  }

  // Extract tags
  const tags = extractTags(text);

  return {
    activity: detectedActivity,
    category: detectedCategory,
    quantity,
    unit,
    mood: detectedMood || null,
    sentiment: detectedSentiment,
    notes: detectedTrigger ? `Trigger: ${detectedTrigger}` : null,
    tags,
    type: detectedType,
    trigger: detectedTrigger,
  };
}

function inferCategoryFromActivity(activity: string): string {
  const lower = activity.toLowerCase();
  if (lower.includes('run') || lower.includes('gym') || lower.includes('workout') || lower.includes('swim')) return 'exercise';
  if (lower.includes('eat') || lower.includes('food')) return 'nutrition';
  if (lower.includes('sleep') || lower.includes('nap')) return 'sleep';
  if (lower.includes('meditat') || lower.includes('yoga')) return 'mindfulness';
  if (lower.includes('read') || lower.includes('study')) return 'education';
  if (lower.includes('argue') || lower.includes('conflict')) return 'relationships';
  if (lower.includes('skip') || lower.includes('procrastinate')) return 'productivity';
  if (lower.includes('school') || lower.includes('class')) return 'education';
  if (lower.includes('work')) return 'work';
  if (lower.includes('cry') || lower.includes('panic') || lower.includes('anxiety')) return 'mental health';
  return 'habits';
}

function inferMoodFromText(text: string): string {
  const lower = text.toLowerCase();
  
  const moodPatterns: Array<{ moods: string[]; patterns: string[] }> = [
    { moods: ['happy', 'great', 'amazing'], patterns: ['happy', 'great', 'amazing', 'wonderful', 'fantastic', 'awesome', 'excited', 'joy'] },
    { moods: ['proud', 'accomplished'], patterns: ['proud', 'accomplished', 'achieved', 'success', 'finally', 'finished'] },
    { moods: ['calm', 'relaxed'], patterns: ['calm', 'relaxed', 'peaceful', 'serene', 'chill', 'zen'] },
    { moods: ['energized', 'motivated'], patterns: ['energized', 'energetic', 'motivated', 'pumped', 'ready'] },
    { moods: ['guilty', 'ashamed'], patterns: ['guilty', 'ashamed', 'shouldn\'t', 'bad about', 'regret', 'mastiffs on me', 'mad at me', 'angry at me'] },
    { moods: ['stressed', 'anxious'], patterns: ['stressed', 'anxious', 'worried', 'overwhelmed', 'nervous', 'pressure'] },
    { moods: ['sad', 'depressed'], patterns: ['sad', 'depressed', 'down', 'hopeless', 'crying', 'cry', 'tears'] },
    { moods: ['angry', 'frustrated'], patterns: ['angry', 'frustrated', 'mad', 'furious', 'annoyed', 'irritated'] },
    { moods: ['tired', 'exhausted'], patterns: ['tired', 'exhausted', 'drained', 'sleepy', 'fatigue'] },
    { moods: ['disgusted', 'disappointed'], patterns: ['disgusting', 'disgusted', 'disappointed', 'failure', 'gross'] },
  ];

  for (const mp of moodPatterns) {
    if (mp.patterns.some(p => lower.includes(p))) {
      return mp.moods[0];
    }
  }
  
  return 'neutral';
}

function inferSentimentFromText(text: string): string {
  const lower = text.toLowerCase();
  
  // Positive indicators
  const positiveWords = ['happy', 'great', 'good', 'amazing', 'wonderful', 'proud', 'accomplished', 'excited', 'love', 'enjoy', 'finally', 'success', 'achieved', 'feel good', 'feels good'];
  const negativeWords = ['bad', 'sad', 'angry', 'mad', 'stressed', 'anxious', 'worried', 'guilty', 'ashamed', 'fail', 'failure', 'disgusting', 'hate', 'terrible', 'awful', 'horrible', 'mastiffs on me', 'conflict', 'argue', 'skip', 'procrastinate', 'panic', 'cry'];
  
  const positiveCount = positiveWords.filter(w => lower.includes(w)).length;
  const negativeCount = negativeWords.filter(w => lower.includes(w)).length;
  
  if (negativeCount > positiveCount) return 'negative';
  if (positiveCount > negativeCount) return 'positive';
  return 'neutral';
}

function extractTags(text: string): string[] {
  const lower = text.toLowerCase();
  const tags: string[] = [];
  
  // Time tags
  if (lower.includes('morning')) tags.push('morning');
  if (lower.includes('afternoon')) tags.push('afternoon');
  if (lower.includes('evening') || lower.includes('night')) tags.push('evening');
  if (lower.includes('today')) tags.push('today');
  if (lower.includes('yesterday')) tags.push('yesterday');
  if (lower.includes('weekend')) tags.push('weekend');
  
  // Location tags
  if (lower.includes('home')) tags.push('home');
  if (lower.includes('school')) tags.push('school');
  if (lower.includes('work')) tags.push('work');
  if (lower.includes('gym')) tags.push('gym');
  if (lower.includes('outdoor') || lower.includes('outside')) tags.push('outdoor');
  
  // Social tags
  if (lower.includes('alone') || lower.includes('by myself')) tags.push('alone');
  if (lower.includes('family') || lower.includes('mom') || lower.includes('dad')) tags.push('family');
  if (lower.includes('friend')) tags.push('friends');
  if (lower.includes('group')) tags.push('group');
  
  // Context tags
  if (lower.includes('recurring') || lower.includes('again') || lower.includes('still')) tags.push('recurring');
  if (lower.includes('first time') || lower.includes('finally')) tags.push('milestone');
  
  return tags;
}
