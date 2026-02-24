# 🎯 NLP Habit Tracker

> Transform your casual journal entries into actionable insights with AI-powered habit tracking.

Ever wanted to track your habits without filling out boring forms? Just type naturally like *"ran 5km today, felt amazing"* and let AI do the heavy lifting. This app understands what you mean, extracts the details, and turns your words into beautiful charts and insights.

---

## ✨ What Makes This Special

### 🗣️ Natural Language Input
No more dropdowns and forms. Just write like you're talking to a friend:
- *"Meditated for 20 minutes this morning, feeling calm"*
- *"Skipped gym again, feeling guilty about it"*
- *"Read 30 pages before bed, super tired now"*

The AI understands context, mood, and even negative behaviors!

### 🎮 Gamification That Actually Motivates
Earn points, unlock badges, and level up as you build better habits:
- 🔥 Keep your streak alive
- 🏆 Earn badges like "Week Warrior" and "Habit Master"
- 📈 Watch your progress bar grow

### 🧠 AI-Powered Insights
Get personalized recommendations based on YOUR patterns:
- *"You tend to skip workouts on Fridays. Try scheduling them earlier!"*
- *"Your mood is best on Sundays. Use that energy!"*

### 📊 Beautiful Visualizations
- Mood heatmaps showing your emotional patterns
- Activity trends over time
- Category breakdowns

### 🔗 Habit Stacking Suggestions
The app learns which habits you often do together and suggests ways to "stack" them for better consistency.

### 🎤 Voice Input
Too lazy to type? Just speak your habit entry!

---
## Screenshots
<img width="1366" height="724" alt="Screenshot (255)" src="https://github.com/user-attachments/assets/797a0a6d-3ecf-4cfe-8175-cca1efb99444" />
<img width="1366" height="724" alt="Screenshot (256)" src="https://github.com/user-attachments/assets/7c2c3e3d-a6cc-4bc2-905e-b5e1674167ff" />
<img width="1366" height="724" alt="Screenshot (257)" src="https://github.com/user-attachments/assets/a7d5e471-b966-4f48-ba54-641ce5bae09c" />



## 🚀 Getting Started

### What You'll Need
- **Node.js** (version 18 or higher) OR **Bun** (recommended)
- A modern web browser

### Installation

```bash
# Clone or download this project
cd my-project

# Install dependencies
bun install

# Set up the database
bun run db:generate
bun run db:push

# Start the development server
bun run dev
```

Now open your browser and go to `http://localhost:3000` 🎉

---

## 💡 How to Use

### Logging Your First Habit

1. **Type naturally** in the text box:
   ```
   Ran 5km this morning, felt energized and proud!
   ```

2. **Click "Parse"** to let AI extract:
   - ✅ Activity: `run`
   - ✅ Type: `positive habit`
   - ✅ Quantity: `5 km`
   - ✅ Mood: `energized`
   - ✅ Sentiment: `positive`

3. **Click "Save Entry"** and you're done!

### Tracking Negative Behaviors

This isn't just about celebrating wins. It's about honesty:

```
Procrastinated all day, feel like a failure
```

The AI recognizes this as a negative behavior, extracts the trigger, and helps you understand your patterns. Because growth starts with awareness.

### Setting Goals

1. Click **"Add Goal"** in the Goals section
2. Set your target: *"Run 50 km per month"*
3. Watch your progress bar fill up automatically as you log related activities

### Exploring Your Data

- **Trends Tab**: See how your habits change over time
- **Activities Tab**: Discover your most frequent habits
- **Mood Tab**: Understand your emotional patterns

### Using Filters

Want to see just your exercise habits? Or only entries from last week? Use the filter bar to drill down into your data.

### Exporting Your Data

Click **"Export CSV"** to download your data and analyze it in Excel or Google Sheets.

---

## 🎮 Understanding the Gamification

### Points System
| Action | Points |
|--------|--------|
| Log a positive habit | +10 |
| Log a negative behavior | -5 |
| Daily streak bonus | +5 per day |
| Complete a goal | +50 |

### Levels
Progress from 🌱 **Beginner** to 🌟 **Transcendent** as you accumulate points.

### Badges
Unlock achievements like:
- 🎯 **First Step** - Log your first habit
- 🔥 **Week Warrior** - 7-day streak
- 💯 **100 Club** - Log 100 habits
- 🎪 **Triple Threat** - Log 3 different categories

---

## 🛠️ Tech Stack

Built with modern tools for a smooth experience:

- **Next.js 16** - React framework with App Router
- **TypeScript** - Type-safe code
- **Prisma** - Database ORM
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - Beautiful components
- **Recharts** - Data visualization
- **AI SDK** - Natural language processing

---

## 📁 Project Structure

```
my-project/
├── prisma/
│   └── schema.prisma      # Database models
├── src/
│   ├── app/
│   │   ├── api/           # Backend API routes
│   │   ├── page.tsx       # Main dashboard
│   │   └── layout.tsx     # App layout
│   ├── components/
│   │   ├── habits/        # Habit-specific components
│   │   └── ui/            # Reusable UI components
│   └── lib/
│       └── db.ts          # Database client
└── package.json
```

---

## 🙏 Tips for Success

1. **Be honest** - Log both wins and setbacks
2. **Be specific** - Include quantities, times, and feelings
3. **Be consistent** - Try to log every day
4. **Review weekly** - Check your insights and adjust

---

## 🤝 Contributing

Found a bug? Have an idea? Contributions are welcome!

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

---

## 📄 License

MIT License - use it however you'd like!

---

## 💬 Questions?

Open an issue or start a discussion. I'd love to hear from you!

---

<p align="center">
  <strong>Start tracking smarter, not harder. 🚀</strong>
</p>
