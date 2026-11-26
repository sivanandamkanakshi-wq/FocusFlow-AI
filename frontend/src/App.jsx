import { useCallback, useEffect, useRef, useState } from 'react'
import { Bar, Doughnut, Line } from 'react-chartjs-2'
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js'
import {
  BrowserRouter,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'
import './App.css'

const API_BASE_URL = 'http://localhost:5000'

async function refreshCsrfToken() {
  const response = await fetch(`${API_BASE_URL}/api/auth/csrf`, {
    credentials: 'include',
  })
  const result = await response.json()
  if (!response.ok || !result.csrf_token) {
    throw new Error('Unable to initialize secure authentication.')
  }
  return result.csrf_token
}

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, LineElement, PointElement, Tooltip)

const navigationItems = [
  { label: 'Overview', path: '/', icon: 'overview' },
  { label: 'My Tasks', path: '/tasks', icon: 'tasks' },
  { label: 'Focus Timer', path: '/focus', icon: 'timer' },
  { label: 'DSA Progress', path: '/dsa', icon: 'code' },
  { label: 'Career Goals', path: '/career', icon: 'goals' },
  { label: 'Analytics', path: '/analytics', icon: 'analytics' },
  { label: 'AI Assistant', path: '/assistant', icon: 'assistant' },
  { label: 'Settings', path: '/settings', icon: 'settings' },
]

const pageDescriptions = {
  '/': 'A little progress, one focused day at a time.',
  '/tasks': 'Keep track of the things you choose to work on.',
  '/focus': 'A quiet space for focused work.',
  '/dsa': 'Track the coding problems you solve.',
  '/career': 'Keep your longer-term direction in view.',
  '/analytics': 'A clear picture of activity you have recorded.',
  '/assistant': 'Thoughtful guidance, without taking actions for you.',
  '/settings': 'Preferences for your FocusFlow workspace.',
}

function Icon({ name, size = 20 }) {
  const sharedProps = {
    'aria-hidden': true,
    fill: 'none',
    height: size,
    stroke: 'currentColor',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 1.8,
    viewBox: '0 0 24 24',
    width: size,
  }

  const icons = {
    overview: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></>,
    tasks: <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="m8 12 2.5 2.5L16.5 9" /></>,
    timer: <><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 1.5M9 2h6M12 2v3" /></>,
    code: <><path d="m8 8-4 4 4 4m8-8 4 4-4 4m-2-10-4 12" /></>,
    goals: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
    analytics: <><path d="M4 19V5m0 14h16" /><path d="m7 15 4-4 3 2 5-6" /></>,
    assistant: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" /><path d="m19 15 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z" /></>,
    search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" /><path d="M10 21h4" /></>,
    logout: <><path d="M10 4H4v16h6M14 8l4 4-4 4M18 12H8" /></>,
    chevron: <path d="m7 10 5 5 5-5" />,
    settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.5.9l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.5-.9l-1.7.6-1.4-2.4L7.7 15a8 8 0 0 1 0-1.8l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.5-.9l.3-1.8H14l.3 1.8a8 8 0 0 1 1.5.9l1.7-.6 1.4 2.4-1.4 1.1a8 8 0 0 1-.1 1.8Z" /></>,
    focus: <><path d="M12 3v2m0 14v2M5 5l1.4 1.4m11.2 11.2L19 19M3 12h2m14 0h2M5 19l1.4-1.4M17.6 6.4 19 5" /><circle cx="12" cy="12" r="5" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    close: <><path d="m18 6-12 12M6 6l12 12" /></>,
    calendar: <><rect x="3.5" y="5" width="17" height="16" rx="2" /><path d="M7.5 3v4m9-4v4M3.5 10h17" /></>,
    sparkle: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" /><path d="m19 15 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z" /></>,
  }

  return <svg {...sharedProps}>{icons[name]}</svg>
}

function getLocalDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getWeekActivity(tasks, referenceDate = new Date()) {
  const monday = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
  )
  const daysSinceMonday = (monday.getDay() + 6) % 7
  monday.setDate(monday.getDate() - daysSinceMonday)

  const dates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday)
    date.setDate(monday.getDate() + index)
    return date
  })
  const countsByDate = new Map(
    dates.map((date) => [getLocalDateKey(date), 0]),
  )

  tasks.forEach((task) => {
    if (task.completedAt) {
      const key = getLocalDateKey(task.completedAt)
      if (countsByDate.has(key)) {
        countsByDate.set(key, countsByDate.get(key) + 1)
      }
    }

  })

  return {
    labels: dates.map((date) =>
      new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date),
    ),
    values: dates.map((date) => countsByDate.get(getLocalDateKey(date))),
  }
}

function ActivityChart({ tasks }) {
  const activity = getWeekActivity(tasks)
  const hasActivity = activity.values.some((value) => value > 0)
  const data = {
    labels: activity.labels,
    datasets: [{
      label: 'Tasks completed',
      data: activity.values,
      borderColor: '#16B8FF',
      backgroundColor: (context) => {
        const chart = context.chart
        const { ctx, chartArea } = chart
        if (!chartArea) return 'rgba(22, 184, 255, 0.12)'
        const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
        gradient.addColorStop(0, 'rgba(22, 184, 255, 0.30)')
        gradient.addColorStop(0.75, 'rgba(23, 105, 255, 0.10)')
        gradient.addColorStop(1, 'rgba(23, 105, 255, 0)')
        return gradient
      },
      fill: true,
      pointBackgroundColor: '#16B8FF',
      pointBorderColor: '#dff5ff',
      pointBorderWidth: 2,
      pointRadius: 4.5,
      pointHoverRadius: 7,
      tension: 0.38,
      borderWidth: 3.5,
    }],
  }
  const options = {
    maintainAspectRatio: false,
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#121D36',
        borderColor: 'rgba(22, 184, 255, 0.38)',
        borderWidth: 1,
        titleColor: '#f7f8ff',
        bodyColor: '#C6D7FF',
        displayColors: false,
        titleFont: { family: 'Inter, sans-serif', size: 11, weight: 700 },
        bodyFont: { family: 'Inter, sans-serif', size: 11, weight: 600 },
        padding: 12,
        cornerRadius: 10,
        callbacks: {
          label: (context) => `${context.parsed.y} task${context.parsed.y === 1 ? '' : 's'} completed`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { color: '#7d849f', font: { size: 10 } },
      },
      y: {
        beginAtZero: true,
        suggestedMax: Math.max(3, ...activity.values),
        border: { display: false },
        grid: { color: 'rgba(139, 144, 178, 0.09)', borderDash: [4, 5] },
        ticks: {
          color: '#717995',
          precision: 0,
          stepSize: 1,
          font: { size: 9 },
        },
      },
    },
  }

  return (
    <article className="panel activity-panel">
      <div className="panel-heading">
        <div>
          <div className="section-kicker">YOUR CONSISTENCY</div>
          <h2>Weekly activity</h2>
        </div>
        <span className="chart-legend"><span aria-hidden="true"></span>Tasks completed</span>
      </div>
      {hasActivity ? (
        <div className="activity-chart">
          <Line aria-label="Tasks completed by day this week" data={data} options={options} />
        </div>
      ) : (
        <div className="activity-empty" role="status">
          <span className="empty-chart-icon"><Icon name="analytics" size={21} /></span>
          <span>No activity recorded yet</span>
          <span className="chart-empty-subtitle">Completed tasks will appear here.</span>
        </div>
      )}
    </article>
  )
}

function TaskPanel({ tasks, onAddTask, onToggleTask, onDeleteTask, userId, apiError }) {
  const [isAddingTask, setIsAddingTask] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [formError, setFormError] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (isAddingTask) {
      inputRef.current?.focus()
    }
  }, [isAddingTask])

  function openTaskForm() {
    setFormError('')
    setIsAddingTask(true)
  }

  function cancelTaskForm() {
    setFormError('')
    setNewTaskTitle('')
    setIsAddingTask(false)
  }

  function handleSubmit(event) {
    event.preventDefault()
    const title = newTaskTitle.trim()
    if (!title) {
      setFormError('Enter a task title before adding it.')
      inputRef.current?.focus()
      return
    }

    if (!userId) {
      setFormError('Sign in before creating a task.')
      return
    }

    Promise.resolve(onAddTask(title)).then((created) => {
      if (!created) return
      setFormError('')
      setNewTaskTitle('')
      setIsAddingTask(false)
    })
  }

  return (
    <article className="panel tasks-panel">
      <div className="panel-heading">
        <div>
          <div className="section-kicker">MAKE IT HAPPEN</div>
          <h2>My tasks</h2>
        </div>
        <button
          aria-label="Add a task"
          className="icon-button"
          onClick={openTaskForm}
          type="button"
        >
          <Icon name="plus" size={19} />
        </button>
      </div>

      {isAddingTask && (
        <form className="task-form" onSubmit={handleSubmit}>
          <label className="visually-hidden" htmlFor="new-task">Task title</label>
          <input
            autoComplete="off"
            id="new-task"
            maxLength={120}
            onChange={(event) => {
              setNewTaskTitle(event.target.value)
              setFormError('')
            }}
            placeholder="What would you like to do?"
            ref={inputRef}
            value={newTaskTitle}
          />
          <button className="form-add-button" type="submit">Add task</button>
          <button
            aria-label="Cancel adding task"
            className="form-cancel-button"
            onClick={cancelTaskForm}
            type="button"
          >
            <Icon name="close" size={18} />
          </button>
          {formError && <p className="form-error" role="alert">{formError}</p>}
        </form>
      )}
      {apiError && <p className="api-error" role="alert">{apiError}</p>}

      {tasks.length === 0 ? (
        <div className="tasks-empty">
          <span className="empty-task-icon"><Icon name="check" size={22} /></span>
          <h3>A fresh start</h3>
          <p>Your task list is ready when you are.</p>
          {!isAddingTask && (
            <button className="text-action" onClick={openTaskForm} type="button">
              <Icon name="plus" size={16} />
              Add your first task
            </button>
          )}
        </div>
      ) : (
        <ul className="task-list">
          {tasks.map((task) => (
            <li className={`task-item${task.completed ? ' completed' : ''}`} key={task.id}>
              <button
                aria-checked={task.completed}
                aria-label={`${task.completed ? 'Mark incomplete' : 'Complete'}: ${task.title}`}
                className="task-checkbox"
                onClick={() => onToggleTask(task.id)}
                role="checkbox"
                type="button"
              >
                {task.completed && <Icon name="check" size={14} />}
              </button>
              <span className="task-title">{task.title}</span>
              <span className={`priority-badge ${task.priority || 'medium'}`}>{task.priority || 'medium'}</span>
              <button
                aria-label={`Delete ${task.title}`}
                className="task-delete-button"
                onClick={() => onDeleteTask(task.id)}
                type="button"
              >
                <Icon name="close" size={15} />
              </button>
            </li>
          ))}
          <li className="add-task-row">
            <button className="text-action add-another" onClick={openTaskForm} type="button">
              <Icon name="plus" size={16} />
              Add another task
            </button>
          </li>
        </ul>
      )}
      <p className="session-note">Tasks are stored in SQLite for your authenticated account.</p>
    </article>
  )
}

function MetricCard({ icon, label, value, unit, period, color, footnote }) {
  return (
    <article className="metric-card">
      <div className="metric-topline">
        <span className={`metric-icon ${color}`}><Icon name={icon} size={19} /></span>
        <span className="metric-period">{period}</span>
      </div>
      <p className="metric-label">{label}</p>
      <div className="metric-value">{value}{unit && <span> {unit}</span>}</div>
      <p className="metric-footnote">{footnote}</p>
    </article>
  )
}

function InsightsPanel() {
  return (
    <article className="panel insights-panel">
      <div className="insights-heading">
        <span className="insights-icon"><Icon name="sparkle" size={19} /></span>
        <div>
          <div className="section-kicker">A GENTLE NUDGE</div>
          <h2>AI insights</h2>
        </div>
        <span className="suggestions-badge">Suggestions only</span>
      </div>
      <div className="insights-empty">
        <p>Personalized insights will be available when FocusFlow can use your recorded activity.</p>
        <span>No AI service is connected. Nothing is created, edited, or completed automatically.</span>
      </div>
    </article>
  )
}

function TaskCompletionGauge({ tasks }) {
  const completed = tasks.filter((task) => task.completed).length
  const total = tasks.length
  const percentage = total === 0 ? 0 : Math.round((completed / total) * 100)

  return (
    <article className="panel completion-panel">
      <div className="panel-heading">
        <div>
          <div className="section-kicker">THIS WORKSPACE</div>
          <h2>Task completion</h2>
        </div>
        <span className="period-chip">All tasks</span>
      </div>
      <div className="completion-gauge">
        <svg aria-label={`${percentage}% of tasks completed`} role="img" viewBox="0 0 220 125">
          <defs>
            <linearGradient id="completionGaugeGradient" x1="20" x2="200" y1="110" y2="110">
              <stop offset="0%" stopColor="#1769FF" />
              <stop offset="100%" stopColor="#16B8FF" />
            </linearGradient>
          </defs>
          <path className="gauge-track" d="M20 110 A90 90 0 0 1 200 110" fill="none" pathLength="100" />
          <path
            className="gauge-progress"
            d="M20 110 A90 90 0 0 1 200 110"
            fill="none"
            pathLength="100"
            strokeDasharray={`${percentage} 100`}
          />
        </svg>
        <div className="gauge-value">
          <strong>{percentage}<span>%</span></strong>
          <span>Completed</span>
        </div>
      </div>
      <div className="completion-counts">
        <div><span className="completion-dot completed-dot" /><span>Completed</span><strong>{completed}</strong></div>
        <div><span className="completion-dot pending-dot" /><span>Pending</span><strong>{total - completed}</strong></div>
      </div>
    </article>
  )
}

function UpcomingTasks({ tasks }) {
  const todayKey = getLocalDateKey(new Date())
  const upcoming = tasks
    .filter((task) => !task.completed && task.due_date && task.due_date >= todayKey)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 5)

  return (
    <article className="panel upcoming-panel">
      <div className="panel-heading">
        <div>
          <div className="section-kicker">PLAN AHEAD</div>
          <h2>Upcoming tasks</h2>
        </div>
        <NavLink className="panel-link" to="/tasks">View all</NavLink>
      </div>
      {upcoming.length === 0 ? (
        <div className="upcoming-empty">
          <span><Icon name="calendar" size={20} /></span>
          <strong>No upcoming tasks</strong>
          <p>Tasks with a future due date will appear here.</p>
        </div>
      ) : (
        <div className="upcoming-list">
          {upcoming.map((task) => (
            <div className="upcoming-row" key={task.id}>
              <span className={`upcoming-accent ${task.priority || 'medium'}`} />
              <div>
                <strong>{task.title}</strong>
                <span>Due {task.due_date}</span>
              </div>
              <span className={`priority-badge ${task.priority || 'medium'}`}>{task.priority || 'medium'}</span>
            </div>
          ))}
        </div>
      )}
    </article>
  )
}

function FocusStreak({ records }) {
  const streak = Number(records?.focusStats?.current_streak || 0)
  return (
    <article className="panel streak-panel">
      <div className="panel-heading">
        <div>
          <div className="section-kicker">CONSISTENCY</div>
          <h2>Focus streak</h2>
        </div>
        <span className="streak-icon"><Icon name="focus" size={19} /></span>
      </div>
      <div className="streak-value">
        <strong>{streak}</strong>
        <span>days</span>
      </div>
      <p>{streak === 0 ? 'No focus sessions recorded yet.' : 'Based on genuine recorded focus activity.'}</p>
      <div className="streak-days" aria-label="Focus streak days">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => (
          <span className={index < 0 ? 'active' : ''} key={`${day}-${index}`}>{day}</span>
        ))}
      </div>
    </article>
  )
}

function OverviewPage({ tasks, records }) {
  const completedTasks = tasks.filter((task) => task.completed).length
  const focusMinutes = Number(records?.focusStats?.today_focus_minutes || 0)
  const completionPercentage = tasks.length === 0
    ? 0
    : Math.round((completedTasks / tasks.length) * 100)
  const completedToday = tasks.filter((task) => {
    if (!task.completedAt || !(task.completedAt instanceof Date)) return false
    return getLocalDateKey(task.completedAt) === getLocalDateKey(new Date())
  }).length

  return (
    <>
      <section className="metrics-grid" aria-label="Progress summary">
        <MetricCard
          color="blue"
          footnote={completedToday === 0 ? 'No tasks completed today' : 'Completed since midnight'}
          icon="focus"
          label="Today's Focus"
          period="TODAY"
          unit={completedToday === 1 ? 'task' : 'tasks'}
          value={completedToday}
        />
        <MetricCard
          color="purple"
          footnote={tasks.length === 0 ? 'No tasks recorded yet' : 'Based on your task completion'}
          icon="tasks"
          label="Productivity Score"
          period="ALL TASKS"
          unit="%"
          value={completionPercentage}
        />
        <MetricCard
          color="teal"
          footnote={focusMinutes === 0 ? 'No focus time recorded' : 'Recorded focus sessions'}
          icon="timer"
          label="Focus Time"
          period="TODAY"
          unit="min"
          value={focusMinutes}
        />
      </section>

      <section className="dashboard-grid" aria-label="Your dashboard">
        <ActivityChart tasks={tasks} />
        <TaskCompletionGauge tasks={tasks} />
      </section>
      <section className="dashboard-bottom-grid" aria-label="Tasks and streak">
        <UpcomingTasks tasks={tasks} />
        <FocusStreak records={records} />
        <InsightsPanel />
      </section>
    </>
  )
}

function FocusTimerPage({ user }) {
  const [mode, setMode] = useState('pomodoro')
  const [sessionType, setSessionType] = useState('focus')
  const [customFocus, setCustomFocus] = useState(50)
  const [customShort, setCustomShort] = useState(10)
  const [customLong, setCustomLong] = useState(20)
  const [activeSession, setActiveSession] = useState(null)
  const [timerStatus, setTimerStatus] = useState('idle')
  const [remainingSeconds, setRemainingSeconds] = useState(25 * 60)
  const targetRef = useRef(null)
  const intervalRef = useRef(null)
  const completingRef = useRef(false)
  const [stats, setStats] = useState({
    total_completed_sessions: 0,
    total_focus_minutes: 0,
    longest_streak: 0,
    current_streak: 0,
    average_session_minutes: 0,
    today_sessions: 0,
    today_focus_minutes: 0,
    weekly: [],
    goals: { daily_minutes: 60, daily_sessions: 4 },
  })
  const [focusError, setFocusError] = useState('')
  const [goalMinutes, setGoalMinutes] = useState(60)
  const [goalSessions, setGoalSessions] = useState(4)

  const timezoneOffset = -new Date().getTimezoneOffset()

  function modeDuration(nextMode = mode, nextType = sessionType) {
    if (nextType === 'short_break') return mode === 'custom' ? customShort : 5
    if (nextType === 'long_break') return mode === 'custom' ? customLong : 15
    if (nextMode === 'pomodoro') return 25
    if (nextMode === 'long_focus') return 90
    return customFocus
  }

  async function loadFocusData() {
    try {
      const [statsResponse, sessionsResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/api/focus/stats?timezone_offset_minutes=${timezoneOffset}`, { credentials: 'include' }),
        fetch(`${API_BASE_URL}/api/focus/sessions`, { credentials: 'include' }),
      ])
      const statsResult = await statsResponse.json()
      const sessionsResult = await sessionsResponse.json()
      if (statsResponse.ok) {
        setStats(statsResult.data)
        setGoalMinutes(statsResult.data.goals.daily_minutes)
        setGoalSessions(statsResult.data.goals.daily_sessions)
        window.dispatchEvent(new Event('focus-data-updated'))
      }
      if (sessionsResponse.ok) {
        const active = sessionsResult.data.find((item) => item.status === 'active' || item.status === 'paused')
        if (active) {
          setActiveSession(active)
          setMode(active.mode)
          setSessionType(active.session_type)
          const startedAt = Date.parse(active.started_at)
          const pausedAt = active.status === 'paused' && active.paused_at
            ? Date.parse(active.paused_at)
            : Date.now()
          const elapsedSeconds = Math.max(
            0,
            Math.floor((pausedAt - startedAt) / 1000) - Number(active.accumulated_paused_seconds || 0),
          )
          const remaining = Math.max(0, active.duration_minutes * 60 - elapsedSeconds)
          setRemainingSeconds(remaining)
          setTimerStatus(active.status === 'paused' ? 'paused' : 'active')
          if (active.status === 'active') targetRef.current = Date.now() + remaining * 1000
        }
      }
    } catch {
      setFocusError('Unable to load focus data.')
    }
  }

  useEffect(() => {
    loadFocusData()
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current)
    }
    // Timer lifecycle calls are intentionally tied to mount and timer state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (timerStatus !== 'active') return undefined
    if (!targetRef.current) targetRef.current = Date.now() + remainingSeconds * 1000
    intervalRef.current = window.setInterval(() => {
      const nextRemaining = Math.max(0, Math.ceil((targetRef.current - Date.now()) / 1000))
      setRemainingSeconds(nextRemaining)
      if (nextRemaining === 0 && !completingRef.current && activeSession) {
        completingRef.current = true
        window.clearInterval(intervalRef.current)
        intervalRef.current = null
        completeSession(activeSession)
      }
    }, 250)
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    // The interval is recreated only when timer state or the session changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerStatus, activeSession])

  function chooseMode(nextMode) {
    if (activeSession) return
    setMode(nextMode)
    setSessionType('focus')
    setRemainingSeconds(modeDuration(nextMode, 'focus') * 60)
    setTimerStatus('idle')
  }

  function chooseCustomType(nextType) {
    if (activeSession) return
    setSessionType(nextType)
    setRemainingSeconds(modeDuration(mode, nextType) * 60)
    setTimerStatus('idle')
  }

  async function apiSessionAction(action, sessionId = activeSession?.id, body = {}) {
    const activeCsrfToken = await refreshCsrfToken()
    const response = await fetch(`${API_BASE_URL}/api/focus/sessions/${sessionId}/${action}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': activeCsrfToken },
      body: JSON.stringify(body),
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.message || `Unable to ${action} session.`)
    return result.data
  }

  async function startSession() {
    if (activeSession || timerStatus !== 'idle') return
    const duration = modeDuration()
    if (mode === 'custom') {
      if (customFocus < 1 || customFocus > 180 || customShort < 1 || customShort > 60 || customLong < 1 || customLong > 60) {
        setFocusError('Custom durations must be 1–180 minutes for focus and 1–60 minutes for breaks.')
        return
      }
    }
    try {
      const activeCsrfToken = await refreshCsrfToken()
      const response = await fetch(`${API_BASE_URL}/api/focus/sessions/start`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': activeCsrfToken },
        body: JSON.stringify({ mode, session_type: sessionType, duration_minutes: duration }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Unable to start the timer.')
      setFocusError('')
      setActiveSession(result.data)
      setRemainingSeconds(duration * 60)
      targetRef.current = Date.now() + duration * 60 * 1000
      completingRef.current = false
      setTimerStatus('active')
    } catch (error) {
      setFocusError(error.message)
    }
  }

  async function pauseSession() {
    try {
      const result = await apiSessionAction('pause')
      if (intervalRef.current) window.clearInterval(intervalRef.current)
      intervalRef.current = null
      targetRef.current = null
      setActiveSession(result)
      setTimerStatus('paused')
    } catch (error) {
      setFocusError(error.message)
    }
  }

  async function resumeSession() {
    try {
      const result = await apiSessionAction('resume')
      targetRef.current = Date.now() + remainingSeconds * 1000
      setActiveSession(result)
      setTimerStatus('active')
    } catch (error) {
      setFocusError(error.message)
    }
  }

  async function resetSession() {
    if (!activeSession) {
      setRemainingSeconds(modeDuration() * 60)
      setTimerStatus('idle')
      return
    }
    try {
      await apiSessionAction('abandon')
      if (intervalRef.current) window.clearInterval(intervalRef.current)
      intervalRef.current = null
      targetRef.current = null
      setActiveSession(null)
      setRemainingSeconds(modeDuration() * 60)
      setTimerStatus('idle')
      completingRef.current = false
      await loadFocusData()
    } catch (error) {
      setFocusError(error.message)
    }
  }

  async function skipSession() {
    await resetSession()
  }

  async function completeSession(session = activeSession) {
    if (!session) return
    try {
      await apiSessionAction('complete', session.id, { completed_at: new Date().toISOString() })
      setActiveSession(null)
      setRemainingSeconds(modeDuration() * 60)
      setTimerStatus('idle')
      targetRef.current = null
      completingRef.current = false
      await loadFocusData()
    } catch (error) {
      completingRef.current = false
      setFocusError(error.message)
    }
  }

  async function saveGoals() {
    try {
      const activeCsrfToken = await refreshCsrfToken()
      const response = await fetch(`${API_BASE_URL}/api/focus/goals`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': activeCsrfToken },
        body: JSON.stringify({ daily_minutes: Number(goalMinutes), daily_sessions: Number(goalSessions) }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Unable to save goals.')
      setStats((current) => ({ ...current, goals: result.data }))
      setFocusError('')
      await loadFocusData()
    } catch (error) {
      setFocusError(error.message)
    }
  }

  const displayMinutes = String(Math.floor(remainingSeconds / 60)).padStart(2, '0')
  const displaySeconds = String(remainingSeconds % 60).padStart(2, '0')
  const totalSeconds = modeDuration() * 60
  const progress = totalSeconds ? Math.max(0, Math.min(100, ((totalSeconds - remainingSeconds) / totalSeconds) * 100)) : 0
  const hasWeeklyActivity = stats.weekly.some((day) => day.minutes > 0)
  const weeklyData = {
    labels: stats.weekly.map((day) => new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(new Date(`${day.date}T12:00:00`))),
    datasets: [{
      label: 'Focus minutes',
      data: stats.weekly.map((day) => day.minutes),
      backgroundColor: 'rgba(23,105,255,.76)',
      hoverBackgroundColor: '#16B8FF',
      borderRadius: 7,
      borderSkipped: false,
    }],
  }
  const weeklyOptions = {
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        displayColors: false,
        backgroundColor: '#121D36',
        borderColor: 'rgba(22,184,255,.35)',
        borderWidth: 1,
        callbacks: { label: (context) => `${context.parsed.y} focus minutes` },
      },
    },
    scales: {
      x: { grid: { display: false }, border: { display: false }, ticks: { color: '#8493B1', font: { family: 'Inter', size: 9, weight: 700 } } },
      y: { beginAtZero: true, suggestedMax: 60, precision: 0, border: { display: false }, grid: { color: 'rgba(78,136,221,.10)' }, ticks: { color: '#7181A1', font: { family: 'Inter', size: 9 } } },
    },
  }

  const minutesGoalPercent = Math.min(100, stats.goals.daily_minutes ? (stats.today_focus_minutes / stats.goals.daily_minutes) * 100 : 0)
  const sessionsGoalPercent = Math.min(100, stats.goals.daily_sessions ? (stats.today_sessions / stats.goals.daily_sessions) * 100 : 0)

  return (
    <section className="focus-page">
      <div className="focus-layout">
        <aside className="focus-profile-column">
          <article className="panel focus-profile-card">
            <span className="focus-avatar">{(user?.name || user?.email || 'F').charAt(0).toUpperCase()}</span>
            <strong>{user?.name || 'FocusFlow user'}</strong>
            <span className="focus-profile-status"><span />{activeSession ? 'Currently focusing' : 'Ready to focus'}</span>
          </article>
          <article className="panel focus-stat-card">
            <span className="focus-stat-icon blue"><Icon name="check" size={18} /></span>
            <div><strong>{stats.total_completed_sessions}</strong><span>Completed sessions</span></div>
          </article>
          <article className="panel focus-stat-card">
            <span className="focus-stat-icon cyan"><Icon name="timer" size={18} /></span>
            <div><strong>{stats.total_focus_minutes}</strong><span>Total focus minutes</span></div>
          </article>
          <article className="panel focus-stat-card">
            <span className="focus-stat-icon purple"><Icon name="analytics" size={18} /></span>
            <div><strong>{stats.longest_streak}</strong><span>Longest streak</span></div>
          </article>
          <article className="panel focus-stat-card">
            <span className="focus-stat-icon blue"><Icon name="focus" size={18} /></span>
            <div><strong>{stats.average_session_minutes}</strong><span>Average minutes</span></div>
          </article>
        </aside>

        <main className="focus-center-column">
          <article className="panel focus-timer-card">
            <div className="focus-mode-tabs" aria-label="Focus timer mode">
              <button className={mode === 'pomodoro' ? 'active' : ''} onClick={() => chooseMode('pomodoro')} type="button">Pomodoro</button>
              <button className={mode === 'long_focus' ? 'active' : ''} onClick={() => chooseMode('long_focus')} type="button">90-Minute Focus</button>
              <button className={mode === 'custom' ? 'active' : ''} onClick={() => chooseMode('custom')} type="button">Custom</button>
            </div>
            {mode === 'custom' && (
              <div className="custom-duration-grid">
                <label>Focus<input max="180" min="1" type="number" value={customFocus} onChange={(event) => { const value = Math.max(1, Math.min(180, Number(event.target.value))); setCustomFocus(value); if (!activeSession && sessionType === 'focus') setRemainingSeconds(value * 60) }} /></label>
                <label>Short break<input max="60" min="1" type="number" value={customShort} onChange={(event) => setCustomShort(Math.max(1, Math.min(60, Number(event.target.value))))} /></label>
                <label>Long break<input max="60" min="1" type="number" value={customLong} onChange={(event) => setCustomLong(Math.max(1, Math.min(60, Number(event.target.value))))} /></label>
              </div>
            )}
            <div className="focus-session-tabs">
              <button className={sessionType === 'focus' || sessionType === 'custom_focus' ? 'active' : ''} onClick={() => chooseCustomType(mode === 'custom' ? 'custom_focus' : 'focus')} type="button">Focus</button>
              <button className={sessionType === 'short_break' ? 'active' : ''} onClick={() => chooseCustomType('short_break')} type="button">Short break</button>
              <button className={sessionType === 'long_break' ? 'active' : ''} onClick={() => chooseCustomType('long_break')} type="button">Long break</button>
            </div>
            <div className="timer-ring" style={{ '--timer-progress': `${progress * 3.6}deg` }}>
              <div>
                <span>{timerStatus === 'idle' ? 'Ready' : timerStatus === 'paused' ? 'Paused' : sessionType.includes('break') ? 'Break' : 'Focus'}</span>
                <strong>{displayMinutes}<b>:</b>{displaySeconds}</strong>
                <small>Session {stats.today_sessions ? stats.today_sessions + 1 : 1}</small>
              </div>
            </div>
            {focusError && <p className="focus-error" role="alert">{focusError}</p>}
            <div className="timer-controls">
              {timerStatus === 'idle' && <button className="timer-primary" onClick={startSession} type="button">Start</button>}
              {timerStatus === 'active' && <button className="timer-secondary" onClick={pauseSession} type="button">Pause</button>}
              {timerStatus === 'paused' && <button className="timer-primary" onClick={resumeSession} type="button">Resume</button>}
              {(timerStatus === 'active' || timerStatus === 'paused') && <button className="timer-secondary" onClick={resetSession} type="button">Reset</button>}
              {(timerStatus === 'active' || timerStatus === 'paused') && <button className="timer-secondary" onClick={skipSession} type="button">Skip</button>}
            </div>
          </article>
        </main>

        <aside className="focus-insights-column">
          <article className="panel weekly-focus-card">
            <div className="panel-heading"><div><div className="section-kicker">LAST 7 DAYS</div><h2>Weekly focus</h2></div></div>
            {hasWeeklyActivity ? (
              <div className="weekly-focus-chart"><Bar data={weeklyData} options={weeklyOptions} /></div>
            ) : (
              <div className="weekly-focus-empty"><Icon name="analytics" size={22} /><strong>No focus activity yet</strong><span>Completed focus time will appear here.</span></div>
            )}
          </article>
          <article className="panel daily-stats-card">
            <div className="panel-heading"><div><div className="section-kicker">TODAY</div><h2>Daily statistics</h2></div></div>
            <div className="daily-stat-grid">
              <div><strong>{stats.today_sessions}</strong><span>Sessions</span></div>
              <div><strong>{stats.today_focus_minutes}</strong><span>Minutes</span></div>
            </div>
          </article>
          <article className="panel daily-goals-card">
            <div className="panel-heading"><div><div className="section-kicker">PERSONAL TARGETS</div><h2>Daily goals</h2></div></div>
            <div className="goal-row">
              <div><span>Focus minutes</span><strong>{stats.today_focus_minutes} / {stats.goals.daily_minutes}</strong></div>
              <div className="goal-track"><span style={{ width: `${minutesGoalPercent}%` }} /></div>
            </div>
            <div className="goal-row">
              <div><span>Completed sessions</span><strong>{stats.today_sessions} / {stats.goals.daily_sessions}</strong></div>
              <div className="goal-track"><span style={{ width: `${sessionsGoalPercent}%` }} /></div>
            </div>
            <div className="goal-inputs">
              <label>Minutes<input max="1440" min="5" type="number" value={goalMinutes} onChange={(event) => setGoalMinutes(Number(event.target.value))} /></label>
              <label>Sessions<input max="100" min="1" type="number" value={goalSessions} onChange={(event) => setGoalSessions(Number(event.target.value))} /></label>
              <button onClick={saveGoals} type="button">Save goals</button>
            </div>
          </article>
        </aside>
      </div>
    </section>
  )
}

function CareerGoalsPage({ userId }) {
  const emptySummary = {
    total_goals: 0,
    active_goals: 0,
    completed_goals: 0,
    total_skills: 0,
    completed_skills: 0,
    overall_skill_progress: 0,
  }
  const [goals, setGoals] = useState([])
  const [summary, setSummary] = useState(emptySummary)
  const [goalFormOpen, setGoalFormOpen] = useState(false)
  const [editingGoal, setEditingGoal] = useState(null)
  const [skillGoal, setSkillGoal] = useState(null)
  const [editingSkill, setEditingSkill] = useState(null)
  const [goalForm, setGoalForm] = useState({ title: '', description: '', target_date: '', status: 'active' })
  const [skillForm, setSkillForm] = useState({ skill_name: '', progress: 0, notes: '' })
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const loadCareer = useCallback(async () => {
    if (!userId) return
    try {
      const [goalsResponse, summaryResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/api/career/goals`, { credentials: 'include' }),
        fetch(`${API_BASE_URL}/api/career/summary`, { credentials: 'include' }),
      ])
      const [goalsResult, summaryResult] = await Promise.all([goalsResponse.json(), summaryResponse.json()])
      if (!goalsResponse.ok || !summaryResponse.ok) {
        throw new Error(goalsResult.message || summaryResult.message || 'Unable to load career goals.')
      }
      setGoals(goalsResult.data)
      setSummary(summaryResult.data)
      setError('')
    } catch (loadError) {
      setError(loadError.message)
    }
  }, [userId])

  useEffect(() => { loadCareer() }, [loadCareer])

  const mutation = useCallback(async (url, options, successMessage) => {
    setSubmitting(true)
    setError('')
    try {
      const csrfToken = await refreshCsrfToken()
      const response = await fetch(url, {
        ...options,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken, ...(options.headers || {}) },
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'The career update could not be completed.')
      await loadCareer()
      setMessage(successMessage)
      return result
    } catch (mutationError) {
      setError(mutationError.message)
      return null
    } finally {
      setSubmitting(false)
    }
  }, [loadCareer])

  const openGoalForm = (goal = null) => {
    setEditingGoal(goal)
    setGoalForm(goal ? {
      title: goal.title,
      description: goal.description || '',
      target_date: goal.target_date || '',
      status: goal.status,
    } : { title: '', description: '', target_date: '', status: 'active' })
    setGoalFormOpen(true)
    setError('')
  }

  const submitGoal = async (event) => {
    event.preventDefault()
    const payload = {
      title: goalForm.title,
      description: goalForm.description || null,
      target_date: goalForm.target_date || null,
      status: goalForm.status,
    }
    const result = editingGoal
      ? await mutation(`${API_BASE_URL}/api/career/goals/${editingGoal.id}`, { method: 'PUT', body: JSON.stringify(payload) }, 'Career goal updated.')
      : await mutation(`${API_BASE_URL}/api/career/goals`, { method: 'POST', body: JSON.stringify(payload) }, 'Career goal created.')
    if (result) {
      setGoalFormOpen(false)
      setEditingGoal(null)
    }
  }

  const deleteGoal = async (goal) => {
    if (!window.confirm(`Delete "${goal.title}" and all of its skills?`)) return
    await mutation(`${API_BASE_URL}/api/career/goals/${goal.id}`, { method: 'DELETE' }, 'Career goal deleted.')
  }

  const openSkillForm = (goal, skill = null) => {
    setSkillGoal(goal)
    setEditingSkill(skill)
    setSkillForm(skill ? {
      skill_name: skill.skill_name,
      progress: skill.progress,
      notes: skill.notes || '',
    } : { skill_name: '', progress: 0, notes: '' })
    setError('')
  }

  const submitSkill = async (event) => {
    event.preventDefault()
    const payload = {
      skill_name: skillForm.skill_name,
      progress: Number(skillForm.progress),
      notes: skillForm.notes || null,
    }
    const url = editingSkill
      ? `${API_BASE_URL}/api/career/goals/${skillGoal.id}/skills/${editingSkill.id}`
      : `${API_BASE_URL}/api/career/goals/${skillGoal.id}/skills`
    const result = await mutation(url, { method: editingSkill ? 'PUT' : 'POST', body: JSON.stringify(payload) }, editingSkill ? 'Skill updated.' : 'Skill added.')
    if (result) {
      setSkillGoal(null)
      setEditingSkill(null)
    }
  }

  const deleteSkill = async (goal, skill) => {
    if (!window.confirm(`Delete the "${skill.skill_name}" skill?`)) return
    await mutation(`${API_BASE_URL}/api/career/goals/${goal.id}/skills/${skill.id}`, { method: 'DELETE' }, 'Skill deleted.')
  }

  const toggleGoalStatus = async (goal) => {
    const status = goal.status === 'active' ? 'completed' : 'active'
    await mutation(`${API_BASE_URL}/api/career/goals/${goal.id}`, { method: 'PUT', body: JSON.stringify({ status }) }, `Goal marked ${status}.`)
  }

  return (
    <section className="career-page">
      <div className="career-heading-row">
        <div>
          <p className="section-kicker">Long-term direction</p>
          <h1>Career Goals</h1>
        </div>
        <button className="career-primary-button" onClick={() => openGoalForm()} type="button"><Icon name="plus" size={17} />Create goal</button>
      </div>

      {(message || error) && (
        <div className={error ? 'career-alert career-alert-error' : 'career-alert'} role={error ? 'alert' : 'status'}>
          {error || message}
        </div>
      )}

      <div className="career-summary-grid">
        {[
          ['Total goals', summary.total_goals],
          ['Active goals', summary.active_goals],
          ['Completed goals', summary.completed_goals],
          ['Total skills', summary.total_skills],
          ['Overall progress', `${summary.overall_skill_progress}%`],
        ].map(([label, value]) => (
          <article className="career-summary-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>

      {goals.length === 0 ? (
        <div className="career-empty">
          <span className="career-empty-icon"><Icon name="goals" size={28} /></span>
          <h2>No career goals yet</h2>
          <p>Create a goal and add the skills you want to develop.</p>
          <button className="career-primary-button" onClick={() => openGoalForm()} type="button"><Icon name="plus" size={17} />Create your first goal</button>
        </div>
      ) : (
        <div className="career-goals-list">
          {goals.map((goal) => (
            <article className="career-goal-card" key={goal.id}>
              <div className="career-goal-header">
                <div>
                  <span className={`career-status career-status-${goal.status}`}>{goal.status}</span>
                  <h2>{goal.title}</h2>
                  {goal.description && <p>{goal.description}</p>}
                </div>
                <div className="career-goal-actions">
                  <button onClick={() => toggleGoalStatus(goal)} type="button">{goal.status === 'active' ? 'Mark completed' : 'Mark active'}</button>
                  <button onClick={() => openGoalForm(goal)} type="button">Edit</button>
                  <button className="career-danger-text" onClick={() => deleteGoal(goal)} type="button">Delete</button>
                </div>
              </div>
              <div className="career-goal-meta">
                <span><Icon name="calendar" size={15} />{goal.target_date || 'No target date'}</span>
                <span>{goal.skill_count} skill{goal.skill_count === 1 ? '' : 's'}</span>
                <span>{goal.completed_skills} completed</span>
                <span>{goal.remaining_skills} remaining</span>
              </div>
              <div className="career-progress-row">
                <div className="career-progress-track"><span style={{ width: `${goal.progress}%` }} /></div>
                <strong>{goal.progress}%</strong>
              </div>
              <div className="career-skills-heading">
                <h3>Skills</h3>
                <button onClick={() => openSkillForm(goal)} type="button"><Icon name="plus" size={15} />Add skill</button>
              </div>
              {goal.skills.length === 0 ? (
                <div className="career-no-skills">No skills added yet. Add the first skill for this goal.</div>
              ) : (
                <div className="career-skills-list">
                  {goal.skills.map((skill) => (
                    <div className={skill.progress === 100 ? 'career-skill career-skill-complete' : 'career-skill'} key={skill.id}>
                      <div className="career-skill-copy">
                        <strong>{skill.skill_name}</strong>
                        {skill.notes && <p>{skill.notes}</p>}
                      </div>
                      <div className="career-skill-progress">
                        <div className="career-progress-track"><span style={{ width: `${skill.progress}%` }} /></div>
                        <b>{skill.progress}%</b>
                      </div>
                      <div className="career-skill-actions">
                        <button onClick={() => openSkillForm(goal, skill)} type="button">Edit</button>
                        <button className="career-danger-text" onClick={() => deleteSkill(goal, skill)} type="button">Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {goalFormOpen && (
        <div className="career-modal-backdrop" role="presentation">
          <div className="career-modal" role="dialog" aria-modal="true" aria-labelledby="career-goal-form-title">
            <div className="career-modal-header">
              <h2 id="career-goal-form-title">{editingGoal ? 'Edit career goal' : 'Create career goal'}</h2>
              <button aria-label="Close" onClick={() => setGoalFormOpen(false)} type="button"><Icon name="close" size={18} /></button>
            </div>
            <form onSubmit={submitGoal}>
              <label><span>Goal title <b>*</b></span><input maxLength={160} required value={goalForm.title} onChange={(event) => setGoalForm((current) => ({ ...current, title: event.target.value }))} placeholder="e.g. Become a senior engineer" /></label>
              <label><span>Description</span><textarea maxLength={2000} value={goalForm.description} onChange={(event) => setGoalForm((current) => ({ ...current, description: event.target.value }))} placeholder="Describe the outcome you want..." /></label>
              <div className="career-form-grid">
                <label><span>Target date</span><input type="date" value={goalForm.target_date} onChange={(event) => setGoalForm((current) => ({ ...current, target_date: event.target.value }))} /></label>
                <label><span>Status</span><select value={goalForm.status} onChange={(event) => setGoalForm((current) => ({ ...current, status: event.target.value }))}><option value="active">Active</option><option value="completed">Completed</option></select></label>
              </div>
              <div className="career-modal-actions"><button onClick={() => setGoalFormOpen(false)} type="button">Cancel</button><button className="career-primary-button" disabled={submitting} type="submit">{submitting ? 'Saving...' : (editingGoal ? 'Save changes' : 'Create goal')}</button></div>
            </form>
          </div>
        </div>
      )}

      {skillGoal && (
        <div className="career-modal-backdrop" role="presentation">
          <div className="career-modal" role="dialog" aria-modal="true" aria-labelledby="career-skill-form-title">
            <div className="career-modal-header">
              <h2 id="career-skill-form-title">{editingSkill ? 'Edit skill' : 'Add skill'}</h2>
              <button aria-label="Close" onClick={() => setSkillGoal(null)} type="button"><Icon name="close" size={18} /></button>
            </div>
            <form onSubmit={submitSkill}>
              <label><span>Skill name <b>*</b></span><input maxLength={160} required value={skillForm.skill_name} onChange={(event) => setSkillForm((current) => ({ ...current, skill_name: event.target.value }))} placeholder="e.g. System design" /></label>
              <label><span>Progress: {skillForm.progress}%</span><input className="career-range" max="100" min="0" step="1" type="range" value={skillForm.progress} onChange={(event) => setSkillForm((current) => ({ ...current, progress: Number(event.target.value) }))} /></label>
              <label><span>Notes</span><textarea maxLength={2000} value={skillForm.notes} onChange={(event) => setSkillForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Optional notes about this skill..." /></label>
              <div className="career-modal-actions"><button onClick={() => setSkillGoal(null)} type="button">Cancel</button><button className="career-primary-button" disabled={submitting} type="submit">{submitting ? 'Saving...' : (editingSkill ? 'Save changes' : 'Add skill')}</button></div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}

function DSAPage({ userId }) {
  const topics = ['Arrays', 'Strings', 'Math', 'Sorting', 'Searching', 'Binary Search', 'Hashing', 'Two Pointers', 'Sliding Window', 'Recursion', 'Dynamic Programming', 'Other']
  const emptySummary = {
    total_solved: 0,
    easy_solved: 0,
    medium_solved: 0,
    hard_solved: 0,
    topic_counts: Object.fromEntries(topics.map((topic) => [topic, 0])),
    current_streak: 0,
    longest_streak: 0,
  }
  const [problems, setProblems] = useState([])
  const [summary, setSummary] = useState(emptySummary)
  const [analytics, setAnalytics] = useState({
    difficulty_counts: { Easy: 0, Medium: 0, Hard: 0 },
    topic_counts: Object.fromEntries(topics.map((topic) => [topic, 0])),
    weekly: [],
    monthly: [],
  })
  const [search, setSearch] = useState('')
  const [difficultyFilter, setDifficultyFilter] = useState('All')
  const [topicFilter, setTopicFilter] = useState('All')
  const [sortNewest, setSortNewest] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    problem_name: '',
    problem_url: '',
    difficulty: 'Easy',
    topic: 'Arrays',
    completion_date: getLocalDateKey(new Date()),
    notes: '',
  })

  const loadDSA = useCallback(async () => {
    if (!userId) return
    const timezoneOffset = -new Date().getTimezoneOffset()
    try {
      const [problemResponse, summaryResponse, analyticsResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/api/dsa/problems`, { credentials: 'include' }),
        fetch(`${API_BASE_URL}/api/dsa/summary?timezone_offset_minutes=${timezoneOffset}`, { credentials: 'include' }),
        fetch(`${API_BASE_URL}/api/dsa/analytics?timezone_offset_minutes=${timezoneOffset}`, { credentials: 'include' }),
      ])
      const [problemResult, summaryResult, analyticsResult] = await Promise.all([
        problemResponse.json(),
        summaryResponse.json(),
        analyticsResponse.json(),
      ])
      if (!problemResponse.ok || !summaryResponse.ok || !analyticsResponse.ok) {
        throw new Error(problemResult.message || summaryResult.message || analyticsResult.message || 'Unable to load DSA progress.')
      }
      setProblems(problemResult.data)
      setSummary(summaryResult.data)
      setAnalytics(analyticsResult.data)
      setError('')
    } catch (loadError) {
      setError(loadError.message || 'Unable to load DSA progress.')
    }
  }, [userId])

  useEffect(() => {
    loadDSA()
  }, [loadDSA])

  function openCreate() {
    setEditingId(null)
    setForm({
      problem_name: '',
      problem_url: '',
      difficulty: 'Easy',
      topic: 'Arrays',
      completion_date: getLocalDateKey(new Date()),
      notes: '',
    })
    setMessage('')
    setError('')
    setFormOpen(true)
  }

  function openEdit(problem) {
    setEditingId(problem.id)
    setForm({
      problem_name: problem.problem_name,
      problem_url: problem.problem_url,
      difficulty: problem.difficulty,
      topic: problem.topic,
      completion_date: problem.completion_date,
      notes: problem.notes || '',
    })
    setMessage('')
    setError('')
    setFormOpen(true)
  }

  async function submitProblem(event) {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setMessage('')
    setError('')
    try {
      const wasEditing = editingId !== null
      const csrf = await refreshCsrfToken()
      const payload = {
        problem_name: form.problem_name.trim(),
        problem_url: form.problem_url.trim(),
        difficulty: form.difficulty,
        topic: form.topic,
        completion_date: form.completion_date,
        notes: form.notes.trim() || null,
      }
      const response = await fetch(
        editingId ? `${API_BASE_URL}/api/dsa/problems/${editingId}` : `${API_BASE_URL}/api/dsa/problems`,
        {
          method: editingId ? 'PUT' : 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrf,
          },
          body: JSON.stringify(payload),
        },
      )
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Unable to save the DSA problem.')
      setFormOpen(false)
      setEditingId(null)
      setMessage(result.duplicate ? 'This problem is already recorded.' : wasEditing ? 'Problem updated.' : 'Problem recorded.')
      await loadDSA()
    } catch (saveError) {
      setError(saveError.message || 'Unable to save the DSA problem.')
    } finally {
      setSubmitting(false)
    }
  }

  async function deleteProblem(problem) {
    if (!window.confirm(`Delete "${problem.problem_name}"? This cannot be undone.`)) return
    setError('')
    setMessage('')
    try {
      const csrf = await refreshCsrfToken()
      const response = await fetch(`${API_BASE_URL}/api/dsa/problems/${problem.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'X-CSRF-Token': csrf },
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Unable to delete the DSA problem.')
      setMessage('Problem deleted.')
      await loadDSA()
    } catch (deleteError) {
      setError(deleteError.message || 'Unable to delete the DSA problem.')
    }
  }

  const filteredProblems = problems
    .filter((problem) =>
      problem.problem_name.toLowerCase().includes(search.toLowerCase()) &&
      (difficultyFilter === 'All' || problem.difficulty === difficultyFilter) &&
      (topicFilter === 'All' || problem.topic === topicFilter),
    )
    .sort((a, b) => {
      const comparison = a.completion_date.localeCompare(b.completion_date)
      return sortNewest ? -comparison : comparison
    })

  const hasDifficultyActivity = Object.values(analytics.difficulty_counts).some((value) => value > 0)
  const doughnutData = {
    labels: ['Easy', 'Medium', 'Hard'],
    datasets: [{
      data: ['Easy', 'Medium', 'Hard'].map((difficulty) => analytics.difficulty_counts[difficulty] || 0),
      backgroundColor: ['#35BE55', '#FF9F43', '#FF5C7A'],
      borderColor: '#121D36',
      borderWidth: 5,
      hoverOffset: 7,
    }],
  }
  const topicLabels = topics.filter((topic) => summary.topic_counts[topic] > 0)
  const topicData = {
    labels: topicLabels,
    datasets: [{
      label: 'Solved',
      data: topicLabels.map((topic) => summary.topic_counts[topic] || 0),
      backgroundColor: '#1769FF',
      borderColor: '#16B8FF',
      borderRadius: 7,
      borderWidth: 1,
    }],
  }
  const weeklyData = {
    labels: (analytics.weekly || []).map((item) => new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(new Date(`${item.date}T12:00:00`))),
    datasets: [{
      label: 'Problems solved',
      data: (analytics.weekly || []).map((item) => item.count),
      backgroundColor: '#1769FF',
      borderColor: '#16B8FF',
      borderRadius: 8,
    }],
  }
  const monthlyData = {
    labels: (analytics.monthly || []).map((item) => new Intl.DateTimeFormat(undefined, { month: 'short', year: '2-digit' }).format(new Date(`${item.month}-01T12:00:00`))),
    datasets: [{
      label: 'Problems solved',
      data: (analytics.monthly || []).map((item) => item.count),
      borderColor: '#16B8FF',
      backgroundColor: 'rgba(22,184,255,.12)',
      fill: true,
      tension: 0.35,
      pointRadius: 4,
    }],
  }
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { backgroundColor: '#121D36', borderColor: 'rgba(22,184,255,.35)', borderWidth: 1 } },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#99A3C2', font: { family: 'Inter, sans-serif', weight: 700 } } },
      y: { beginAtZero: true, grid: { color: 'rgba(167,178,218,.08)' }, ticks: { color: '#99A3C2', precision: 0 } },
    },
  }

  return (
    <section className="dsa-page">
      <div className="page-section-heading">
        <div>
          <div className="section-kicker">CODING JOURNEY</div>
          <h2>DSA Progress</h2>
        </div>
        <button className="gradient-button new-task-button" onClick={openCreate} type="button">
          <Icon name="plus" size={16} /> Add problem
        </button>
      </div>
      {!userId && <div className="api-setup-note" role="status">Sign in before recording solved problems.</div>}
      {error && <p className="api-error" role="alert">{error}</p>}
      {message && <p className="success-message" role="status">{message}</p>}

      <div className="dsa-stats-grid">
        {[
          ['Total Solved', summary.total_solved, 'code', 'total'],
          ['Easy Solved', summary.easy_solved, 'check', 'easy'],
          ['Medium Solved', summary.medium_solved, 'focus', 'medium'],
          ['Hard Solved', summary.hard_solved, 'sparkle', 'hard'],
        ].map(([label, value, icon, tone]) => (
          <article className={`dsa-stat-card ${tone}`} key={label}>
            <span className="dsa-stat-icon"><Icon name={icon} size={18} /></span>
            <div><strong>{value}</strong><span>{label}</span></div>
          </article>
        ))}
      </div>

      <div className="dsa-streak-row">
        <article className="panel"><span>Current streak</span><strong>{summary.current_streak}</strong><small>consecutive calendar days</small></article>
        <article className="panel"><span>Longest streak</span><strong>{summary.longest_streak}</strong><small>consecutive calendar days</small></article>
        <article className="panel dsa-streak-rule"><span>Streak rule</span><p>Multiple problems on one date count once. The current streak ends today or yesterday if today has no entry.</p></article>
      </div>

      <div className="dsa-analytics-grid">
        <article className="panel dsa-chart-card">
          <div className="panel-heading"><div><div className="section-kicker">BY DIFFICULTY</div><h2>Distribution</h2></div></div>
          {hasDifficultyActivity ? <div className="dsa-doughnut"><Doughnut data={doughnutData} options={{ responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: { position: 'bottom', labels: { color: '#AEB7D3', usePointStyle: true, padding: 14 } } } }} /></div> : <div className="dsa-empty-chart"><Icon name="analytics" size={22} /><strong>No solved problems yet</strong><span>Your difficulty distribution will appear here.</span></div>}
        </article>
        <article className="panel dsa-chart-card">
          <div className="panel-heading"><div><div className="section-kicker">BY TOPIC</div><h2>Topic progress</h2></div></div>
          {topicLabels.length ? <div className="dsa-bar-chart"><Bar data={topicData} options={chartOptions} /></div> : <div className="dsa-empty-chart"><Icon name="code" size={22} /><strong>No topic activity yet</strong><span>Record problems to build topic totals.</span></div>}
        </article>
      </div>

      <div className="dsa-topic-grid">
        {topics.map((topic) => {
          const count = summary.topic_counts[topic] || 0
          const highestTopicCount = Math.max(1, ...Object.values(summary.topic_counts || {}))
          const relativeWidth = count ? Math.max(6, (count / highestTopicCount) * 100) : 0
          return <article className="dsa-topic-card" key={topic}><div><strong>{topic}</strong><span>{count} solved</span></div><div className="dsa-topic-track"><span style={{ width: `${relativeWidth}%` }} /></div></article>
        })}
      </div>

      <div className="dsa-activity-grid">
        <article className="panel dsa-chart-card"><div className="panel-heading"><div><div className="section-kicker">LAST 7 DAYS</div><h2>Weekly activity</h2></div></div><div className="dsa-bar-chart"><Bar data={weeklyData} options={chartOptions} /></div></article>
        <article className="panel dsa-chart-card"><div className="panel-heading"><div><div className="section-kicker">LAST 6 MONTHS</div><h2>Monthly activity</h2></div></div><div className="dsa-bar-chart"><Line data={monthlyData} options={chartOptions} /></div></article>
      </div>

      {formOpen && (
        <form className="task-management-form dsa-form" onSubmit={submitProblem}>
          <div className="task-management-form-heading">
            <div><div className="section-kicker">{editingId ? 'UPDATE RECORD' : 'ADD SOLVED PROBLEM'}</div><h2>{editingId ? 'Edit problem' : 'Record a problem'}</h2></div>
            <button aria-label="Close DSA form" className="form-cancel-button" onClick={() => setFormOpen(false)} type="button"><Icon name="close" size={18} /></button>
          </div>
          <div className="dsa-form-grid">
            <label><span>Problem name <b>*</b></span><input autoFocus maxLength={200} required value={form.problem_name} onChange={(event) => setForm((current) => ({ ...current, problem_name: event.target.value }))} placeholder="e.g. Two Sum" /></label>
            <label><span>LeetCode URL <b>*</b></span><input maxLength={2048} required type="url" value={form.problem_url} onChange={(event) => setForm((current) => ({ ...current, problem_url: event.target.value }))} placeholder="https://leetcode.com/problems/two-sum/" /></label>
            <label><span>Difficulty</span><select value={form.difficulty} onChange={(event) => setForm((current) => ({ ...current, difficulty: event.target.value }))}><option>Easy</option><option>Medium</option><option>Hard</option></select></label>
            <label><span>Topic</span><select value={form.topic} onChange={(event) => setForm((current) => ({ ...current, topic: event.target.value }))}>{topics.map((topic) => <option key={topic}>{topic}</option>)}</select></label>
            <label><span>Completion date <b>*</b></span><input required type="date" max={getLocalDateKey(new Date())} value={form.completion_date} onChange={(event) => setForm((current) => ({ ...current, completion_date: event.target.value }))} /></label>
            <label className="dsa-notes"><span>Notes</span><textarea maxLength={2000} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Approach, pattern, or reminder..." /></label>
          </div>
          <div className="dsa-form-actions"><button className="form-cancel-button" onClick={() => setFormOpen(false)} type="button">Cancel</button><button className="gradient-button" disabled={submitting} type="submit">{submitting ? 'Saving...' : editingId ? 'Save changes' : 'Record problem'}</button></div>
        </form>
      )}

      <div className="dsa-history panel">
        <div className="panel-heading dsa-history-heading"><div><div className="section-kicker">YOUR RECORDS</div><h2>Problem history</h2></div><button className="dsa-sort-button" onClick={() => setSortNewest((current) => !current)} type="button">{sortNewest ? 'Newest first' : 'Oldest first'}</button></div>
        <div className="dsa-toolbar">
          <label className="dsa-search"><Icon name="search" size={16} /><span className="visually-hidden">Search DSA problems</span><input placeholder="Search problems..." value={search} onChange={(event) => setSearch(event.target.value)} /></label>
          <select value={difficultyFilter} onChange={(event) => setDifficultyFilter(event.target.value)}><option>All</option><option>Easy</option><option>Medium</option><option>Hard</option></select>
          <select value={topicFilter} onChange={(event) => setTopicFilter(event.target.value)}><option>All</option>{topics.map((topic) => <option key={topic}>{topic}</option>)}</select>
        </div>
        {filteredProblems.length ? (
          <div className="dsa-table-wrap"><table className="dsa-table"><thead><tr><th>Problem name</th><th>Difficulty</th><th>Topic</th><th>Completion date</th><th>LeetCode link</th><th>Actions</th></tr></thead><tbody>{filteredProblems.map((problem) => <tr key={problem.id}><td><strong>{problem.problem_name}</strong>{problem.notes && <span className="dsa-note-preview">{problem.notes}</span>}</td><td><span className={`difficulty-badge ${problem.difficulty.toLowerCase()}`}>{problem.difficulty}</span></td><td>{problem.topic}</td><td>{problem.completion_date}</td><td><a className="dsa-link" href={problem.problem_url} target="_blank" rel="noreferrer">Open</a></td><td><div className="dsa-actions"><button className="edit-button" onClick={() => openEdit(problem)} type="button">Edit</button><button className="delete-button" onClick={() => deleteProblem(problem)} type="button">Delete</button></div></td></tr>)}</tbody></table></div>
        ) : <div className="dsa-empty-state"><Icon name="code" size={26} /><strong>{problems.length ? 'No matching problems' : 'No problems recorded yet'}</strong><span>{problems.length ? 'Try changing your search or filters.' : 'Add your first solved LeetCode problem.'}</span></div>}
      </div>
    </section>
  )
}

function EmptyFeaturePage({ icon, title, description, detail }) {
  return (
    <section className="feature-page">
      <div className="feature-icon"><Icon name={icon} size={25} /></div>
      <div className="section-kicker">NOT TRACKED YET</div>
      <h2>{title}</h2>
      <p>{description}</p>
      <div className="feature-note">{detail}</div>
    </section>
  )
}

function TasksPage({ tasks, onAddTask, onUpdateTask, onToggleTask, onDeleteTask, userId, apiError }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState(null)
  const [formValues, setFormValues] = useState({
    title: '',
    description: '',
    due_date: '',
    priority: 'medium',
  })
  const [formError, setFormError] = useState('')

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch = task.title.toLowerCase().includes(search.toLowerCase())
    const matchesFilter =
      filter === 'all' ||
      (filter === 'completed' && task.completed) ||
      (filter === 'pending' && !task.completed)
    return matchesSearch && matchesFilter
  })

  function openCreateForm() {
    setEditingTaskId(null)
    setFormValues({ title: '', description: '', due_date: '', priority: 'medium' })
    setFormError('')
    setIsFormOpen(true)
  }

  function openEditForm(task) {
    setEditingTaskId(task.id)
    setFormValues({
      title: task.title,
      description: task.description || '',
      due_date: task.due_date || '',
      priority: task.priority || 'medium',
    })
    setFormError('')
    setIsFormOpen(true)
  }

  function closeForm() {
    setEditingTaskId(null)
    setFormValues({ title: '', description: '', due_date: '', priority: 'medium' })
    setFormError('')
    setIsFormOpen(false)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!userId) {
      setFormError('Sign in before creating a task.')
      return
    }
    const title = formValues.title.trim()
    if (!title) {
      setFormError('Task title is required.')
      return
    }

    const payload = {
      title,
      description: formValues.description.trim() || null,
      due_date: formValues.due_date || null,
      priority: formValues.priority,
    }

    const saved = editingTaskId
      ? await onUpdateTask(editingTaskId, payload)
      : await onAddTask(payload)
    if (saved) {
      closeForm()
    }
  }

  function requestDelete(task) {
    if (window.confirm(`Delete "${task.title}"? This action cannot be undone.`)) {
      onDeleteTask(task.id)
    }
  }

  return (
    <section className="tasks-page">
      <div className="page-section-heading">
        <div>
          <div className="section-kicker">YOUR LIST</div>
          <h2>Tasks</h2>
        </div>
        <button className="gradient-button new-task-button" onClick={openCreateForm} type="button">
          <Icon name="plus" size={16} />
          New task
        </button>
      </div>
      <div className="task-toolbar">
        <label className="task-search">
          <span className="visually-hidden">Search tasks</span>
          <input
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search tasks..."
            value={search}
          />
        </label>
        <div className="task-filters" aria-label="Filter tasks">
          {['all', 'pending', 'completed'].map((item) => (
            <button
              className={filter === item ? 'active' : ''}
              key={item}
              onClick={() => setFilter(item)}
              type="button"
            >
              {item[0].toUpperCase() + item.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {!userId && (
        <div className="api-setup-note" role="status">
          Sign in before managing saved tasks.
        </div>
      )}
      {apiError && <p className="api-error task-api-error" role="alert">{apiError}</p>}
      {formError && <p className="api-error task-form-error" role="alert">{formError}</p>}

      {isFormOpen && (
        <form className="task-management-form" onSubmit={handleSubmit}>
          <div className="task-management-form-heading">
            <div>
              <div className="section-kicker">{editingTaskId ? 'UPDATE DETAILS' : 'PLAN SOMETHING'}</div>
              <h2>{editingTaskId ? 'Edit task' : 'Create a task'}</h2>
            </div>
            <button aria-label="Close task form" className="form-cancel-button" onClick={closeForm} type="button">
              <Icon name="close" size={18} />
            </button>
          </div>

          <label>
            <span>Task title <b>*</b></span>
            <input
              autoFocus
              maxLength={120}
              onChange={(event) => setFormValues((current) => ({ ...current, title: event.target.value }))}
              placeholder="What needs to be done?"
              required
              value={formValues.title}
            />
          </label>

          <label>
            <span>Description</span>
            <textarea
              maxLength={2000}
              onChange={(event) => setFormValues((current) => ({ ...current, description: event.target.value }))}
              placeholder="Add helpful details..."
              rows={4}
              value={formValues.description}
            />
          </label>

          <div className="task-form-row">
            <label>
              <span>Due date</span>
              <input
                onChange={(event) => setFormValues((current) => ({ ...current, due_date: event.target.value }))}
                type="date"
                value={formValues.due_date}
              />
            </label>
            <label>
              <span>Priority</span>
              <select
                onChange={(event) => setFormValues((current) => ({ ...current, priority: event.target.value }))}
                value={formValues.priority}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
          </div>

          <div className="task-form-actions">
            <button className="secondary-button" onClick={closeForm} type="button">Cancel</button>
            <button className="gradient-button" type="submit">
              {editingTaskId ? 'Save changes' : 'Create task'}
            </button>
          </div>
        </form>
      )}

      {filteredTasks.length ? (
        <div className="task-card-grid">
          {filteredTasks.map((task) => (
            <article className={`task-card${task.completed ? ' completed' : ''}`} key={task.id}>
              <div className="task-card-topline">
                <span className={`priority-badge ${task.priority || 'medium'}`}>
                  {task.priority || 'medium'} priority
                </span>
                <span className={`status-badge ${task.completed ? 'completed' : 'pending'}`}>
                  {task.completed ? 'Completed' : 'Pending'}
                </span>
              </div>
              <h3>{task.title}</h3>
              <p className="task-card-description">{task.description || 'No description added.'}</p>
              <div className="task-card-date">
                <Icon name="calendar" size={15} />
                <span>{task.due_date ? `Due ${task.due_date}` : 'No due date'}</span>
              </div>
              <div className="task-card-actions">
                <button
                  className={`complete-button${task.completed ? ' completed' : ''}`}
                  onClick={() => onToggleTask(task.id)}
                  type="button"
                >
                  <Icon name="check" size={15} />
                  {task.completed ? 'Mark pending' : 'Mark complete'}
                </button>
                <button className="edit-button" onClick={() => openEditForm(task)} type="button">
                  Edit
                </button>
                <button className="delete-button" onClick={() => requestDelete(task)} type="button">
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="panel filtered-empty">
          <span className="empty-task-icon"><Icon name="check" size={22} /></span>
          <h3>{tasks.length ? 'No matching tasks' : 'A fresh start'}</h3>
          <p>{tasks.length ? 'Try another search or filter.' : 'Your saved task list is ready when you are.'}</p>
          {!tasks.length && userId && (
            <button className="text-action" onClick={openCreateForm} type="button">
              <Icon name="plus" size={16} />
              Create your first task
            </button>
          )}
        </div>
      )}
    </section>
  )
}

function SettingsPage({ user, onLogout }) {
  return (
    <section className="settings-grid">
      <article className="panel settings-card">
        <div className="settings-card-heading">
          <span className="metric-icon purple"><Icon name="settings" size={19} /></span>
          <div>
            <div className="section-kicker">ACCOUNT SECURITY</div>
            <h2>Signed-in account</h2>
          </div>
        </div>
        <p className="settings-description">
          Your tasks are protected by your secure FocusFlow session.
        </p>
        <div className="account-summary">
          <strong>{user?.name}</strong>
          <span>{user?.email}</span>
        </div>
        <button className="gradient-button" onClick={onLogout} type="button">Log out</button>
        {!user?.has_google && (
          <button
            className="settings-google-button"
            onClick={() => window.location.assign(`${API_BASE_URL}/api/auth/google`)}
            type="button"
          >
            <GoogleIcon />
            Link Google account
          </button>
        )}
      </article>
    </section>
  )
}

function AssistantPage() {
  const suggestedQuestions = [
    'How can I improve my productivity?',
    'Which DSA topics should I practice next?',
    'Help me plan my study time.',
    'How am I progressing toward my career goals?',
    'Explain my recent activity.',
  ]
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hi! I can help you plan your work, understand your progress, and suggest what to focus on next. I can only make suggestions; you will always make changes on your FocusFlow pages yourself.',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState(null)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/ai/status`, { credentials: 'include' })
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.message || 'Unable to check AI availability.')
        setStatus(result.data)
      })
      .catch((statusError) => setError(statusError.message))
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, loading])

  const sendMessage = async (question) => {
    const message = (question ?? input).trim()
    if (!message || loading) return
    setInput('')
    setError('')
    setMessages((current) => [...current, { role: 'user', content: message }])
    setLoading(true)
    try {
      const csrfToken = await refreshCsrfToken()
      const response = await fetch(`${API_BASE_URL}/api/ai/chat`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({ message }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Unable to reach the AI assistant.')
      setMessages((current) => [
        ...current,
        { role: 'assistant', content: result.data.response },
      ])
    } catch (sendError) {
      setError(sendError.message)
      setMessages((current) => [
        ...current,
        { role: 'assistant', content: 'I could not complete that request. Please try again.' },
      ])
    } finally {
      setLoading(false)
    }
  }

  const clearConversation = () => {
    setMessages([{
      role: 'assistant',
      content: 'Conversation cleared. I am ready to help using your current FocusFlow activity.',
    }])
    setError('')
  }

  return (
    <section className="assistant-page">
      <div className="assistant-heading-row">
        <div>
          <div className="section-kicker">FOCUSFLOW GUIDE</div>
          <h1>AI Assistant</h1>
        </div>
        <button className="assistant-clear-button" type="button" onClick={clearConversation}>
          Clear conversation
        </button>
      </div>

      {status && !status.available && (
        <div className="assistant-unavailable" role="status">
          Groq is not configured yet. Set GROQ_API_KEY on the backend to enable the assistant.
        </div>
      )}
      {error && <p className="assistant-error" role="alert">{error}</p>}

      <div className="assistant-chat-panel">
        <div className="assistant-messages" aria-live="polite">
          {messages.map((message, index) => (
            <div className={`assistant-message-row ${message.role}`} key={`${message.role}-${index}`}>
              {message.role === 'assistant' && (
                <div className="assistant-avatar"><Icon name="assistant" size={17} /></div>
              )}
              <div className="assistant-message">{message.content}</div>
            </div>
          ))}
          {loading && (
            <div className="assistant-message-row assistant">
              <div className="assistant-avatar"><Icon name="assistant" size={17} /></div>
              <div className="assistant-message assistant-loading"><span /><span /><span /></div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="assistant-suggestions">
          {suggestedQuestions.map((question) => (
            <button
              disabled={loading || status?.available === false}
              key={question}
              onClick={() => sendMessage(question)}
              type="button"
            >
              {question}
            </button>
          ))}
        </div>

        <form
          className="assistant-compose"
          onSubmit={(event) => {
            event.preventDefault()
            sendMessage()
          }}
        >
          <input
            aria-label="Message the AI assistant"
            disabled={loading || status?.available === false}
            maxLength={2000}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask about tasks, focus, DSA, career goals, or analytics..."
            value={input}
          />
          <button disabled={loading || !input.trim() || status?.available === false} type="submit">
            <Icon name="assistant" size={18} />
            <span>Send</span>
          </button>
        </form>
      </div>
    </section>
  )
}


function AnalyticsPage() {
  const emptySummary = {
    total_tasks: 0, completed_tasks: 0, pending_tasks: 0, overdue_tasks: 0,
    total_completed_focus_sessions: 0, total_focus_minutes: 0,
    total_dsa_problems_solved: 0, total_career_goals: 0, active_career_goals: 0,
    completed_career_goals: 0, total_skills: 0, overall_skill_progress: 0,
  }
  const [period, setPeriod] = useState('weekly')
  const [summary, setSummary] = useState(emptySummary)
  const [activity, setActivity] = useState(null)
  const [dsaSummary, setDsaSummary] = useState({
    easy_solved: 0, medium_solved: 0, hard_solved: 0, topic_counts: {},
  })
  const [careerSummary, setCareerSummary] = useState({
    total_goals: 0, active_goals: 0, completed_goals: 0,
    total_skills: 0, completed_skills: 0, overall_skill_progress: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadAnalytics = useCallback(async (selectedPeriod) => {
    setLoading(true)
    setActivity(null)
    setError('')
    const timezoneOffset = -new Date().getTimezoneOffset()
    try {
      const [summaryResponse, activityResponse, dsaResponse, careerResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/api/analytics/summary?timezone_offset_minutes=${timezoneOffset}`, { credentials: 'include' }),
        fetch(`${API_BASE_URL}/api/analytics/activity?period=${selectedPeriod}&timezone_offset_minutes=${timezoneOffset}`, { credentials: 'include' }),
        fetch(`${API_BASE_URL}/api/dsa/summary?timezone_offset_minutes=${timezoneOffset}`, { credentials: 'include' }),
        fetch(`${API_BASE_URL}/api/career/summary`, { credentials: 'include' }),
      ])
      const [summaryResult, activityResult, dsaResult, careerResult] = await Promise.all([
        summaryResponse.json(), activityResponse.json(), dsaResponse.json(), careerResponse.json(),
      ])
      if (!summaryResponse.ok || !activityResponse.ok || !dsaResponse.ok || !careerResponse.ok) {
        throw new Error(summaryResult.message || activityResult.message || dsaResult.message || careerResult.message || 'Unable to load analytics.')
      }
      setSummary(summaryResult.data)
      setActivity(activityResult.data)
      setDsaSummary(dsaResult.data)
      setCareerSummary(careerResult.data)
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAnalytics(period) }, [period, loadAnalytics])

  const formatLabels = (labels) => labels.map((label) => {
    if (period === 'monthly') {
      return new Intl.DateTimeFormat(undefined, { month: 'short', year: '2-digit' }).format(new Date(`${label}-01T12:00:00`))
    }
    if (period === 'daily') {
      return 'Today'
    }
    return new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(new Date(`${label}T12:00:00`))
  })

  const labels = activity ? formatLabels(activity.labels) : []
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: '#AEB7D3', usePointStyle: true, padding: 12 } },
      tooltip: { backgroundColor: '#111A33', titleColor: '#F1F4FF', bodyColor: '#B8C0DA', borderColor: 'rgba(22,184,255,.18)', borderWidth: 1 },
    },
    scales: {
      x: { ticks: { color: '#7F89A7' }, grid: { color: 'rgba(167,178,218,.06)' } },
      y: { beginAtZero: true, ticks: { color: '#7F89A7', precision: 0 }, grid: { color: 'rgba(167,178,218,.06)' } },
    },
  }
  const taskChart = {
    labels,
    datasets: [
      { label: 'Created', data: activity?.tasks.created || [], borderColor: '#7D8CA8', backgroundColor: 'rgba(125,140,168,.12)', tension: .35, fill: true },
      { label: 'Completed', data: activity?.tasks.completed || [], borderColor: '#16B8FF', backgroundColor: 'rgba(22,184,255,.16)', tension: .35, fill: true },
    ],
  }
  const focusChart = {
    labels,
    datasets: [{ label: 'Focus minutes', data: activity?.focus.minutes || [], borderRadius: 6, backgroundColor: 'rgba(23,105,255,.72)' }],
  }
  const dsaChart = {
    labels,
    datasets: [{ label: 'Problems solved', data: activity?.dsa.completed || [], borderColor: '#39D8C8', backgroundColor: 'rgba(57,216,200,.12)', tension: .35, fill: true }],
  }
  const difficultyChart = {
    labels: ['Easy', 'Medium', 'Hard'],
    datasets: [{
      data: [dsaSummary.easy_solved || 0, dsaSummary.medium_solved || 0, dsaSummary.hard_solved || 0],
      backgroundColor: ['#42C98A', '#F2A65A', '#F06F89'],
      borderColor: '#111A33',
      borderWidth: 4,
    }],
  }
  const hasActivity = (values) => (values || []).some((value) => value > 0)
  const topicEntries = Object.entries(dsaSummary.topic_counts || {}).filter(([, value]) => value > 0)

  return (
    <section className="analytics-page">
      <div className="analytics-heading-row">
        <div><div className="section-kicker">YOUR PROGRESS</div><h1>Analytics Dashboard</h1></div>
        <div className="analytics-filter" aria-label="Analytics date range">
          {['daily', 'weekly', 'monthly'].map((item) => (
            <button className={period === item ? 'active' : ''} key={item} onClick={() => setPeriod(item)} type="button">
              {item[0].toUpperCase() + item.slice(1)}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="api-error" role="alert">{error}</p>}
      {loading && !activity && <div className="analytics-loading" role="status">Loading analytics...</div>}

      <div className="analytics-overview-grid">
        {[
          ['Total Tasks', summary.total_tasks, 'tasks', 'blue'],
          ['Completed Tasks', summary.completed_tasks, 'check', 'teal'],
          ['Focus Time', `${summary.total_focus_minutes} min`, 'timer', 'purple'],
          ['DSA Solved', summary.total_dsa_problems_solved, 'code', 'cyan'],
          ['Career Goals', summary.total_career_goals, 'goals', 'blue'],
        ].map(([label, value, icon, tone]) => (
          <article className="analytics-overview-card" key={label}>
            <span className={`metric-icon ${tone}`}><Icon name={icon} size={18} /></span>
            <div><strong>{value}</strong><span>{label}</span></div>
          </article>
        ))}
      </div>

      <div className="analytics-grid">
        <article className="panel analytics-chart-card">
          <div className="panel-heading"><div><div className="section-kicker">TASK ACTIVITY</div><h2>Task completion</h2></div></div>
          <div className="analytics-substats"><span>Total <strong>{summary.total_tasks}</strong></span><span>Completed <strong>{summary.completed_tasks}</strong></span><span>Pending <strong>{summary.pending_tasks}</strong></span><span>Overdue <strong>{summary.overdue_tasks}</strong></span></div>
          {hasActivity(activity?.tasks.completed) || hasActivity(activity?.tasks.created) ? <div className="analytics-chart"><Line data={taskChart} options={chartOptions} /></div> : <div className="analytics-empty"><Icon name="tasks" size={22} /><strong>No task activity</strong><span>Created and completed tasks will appear here.</span></div>}
        </article>
        <article className="panel analytics-chart-card">
          <div className="panel-heading"><div><div className="section-kicker">FOCUS ACTIVITY</div><h2>Completed focus time</h2></div></div>
          <div className="analytics-substats"><span>Sessions <strong>{summary.total_completed_focus_sessions}</strong></span><span>Minutes <strong>{summary.total_focus_minutes}</strong></span><span>Average <strong>{summary.total_completed_focus_sessions ? Math.round(summary.total_focus_minutes / summary.total_completed_focus_sessions) : 0} min</strong></span></div>
          {hasActivity(activity?.focus.minutes) || hasActivity(activity?.focus.sessions) ? <div className="analytics-chart"><Bar data={focusChart} options={chartOptions} /></div> : <div className="analytics-empty"><Icon name="timer" size={22} /><strong>No completed focus sessions</strong><span>Completed focus time will appear here.</span></div>}
        </article>
      </div>

      <div className="analytics-grid">
        <article className="panel analytics-chart-card">
          <div className="panel-heading"><div><div className="section-kicker">DSA PROGRESS</div><h2>Solved problems</h2></div></div>
          <div className="analytics-dsa-layout">
            <div className="analytics-doughnut">
              {(dsaSummary.easy_solved + dsaSummary.medium_solved + dsaSummary.hard_solved) > 0
                ? <Doughnut data={difficultyChart} options={{ responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: { position: 'bottom', labels: { color: '#AEB7D3', usePointStyle: true, padding: 10 } } } }} />
                : <div className="analytics-empty"><Icon name="code" size={22} /><strong>No DSA problems</strong><span>Difficulty totals are zero.</span></div>}
            </div>
            <div className="analytics-topic-list">
              {topicEntries.length ? topicEntries.map(([topic, count]) => <div key={topic}><span>{topic}</span><strong>{count}</strong></div>) : <div className="analytics-empty"><span>No topic progress recorded.</span></div>}
            </div>
          </div>
        </article>
        <article className="panel analytics-chart-card">
          <div className="panel-heading"><div><div className="section-kicker">CAREER PROGRESS</div><h2>Goals and skills</h2></div></div>
          <div className="analytics-substats"><span>Goals <strong>{careerSummary.total_goals}</strong></span><span>Active <strong>{careerSummary.active_goals}</strong></span><span>Completed <strong>{careerSummary.completed_goals}</strong></span><span>Skills <strong>{careerSummary.total_skills}</strong></span></div>
          <div className="analytics-career-progress"><div><span>Overall skill progress</span><strong>{careerSummary.overall_skill_progress}%</strong></div><div className="analytics-progress-track"><span style={{ width: `${careerSummary.overall_skill_progress}%` }} /></div></div>
          {careerSummary.total_goals ? <div className="analytics-chart"><Bar data={{ labels: ['Goals', 'Active', 'Completed'], datasets: [{ label: 'Count', data: [careerSummary.total_goals, careerSummary.active_goals, careerSummary.completed_goals], backgroundColor: ['#1769FF', '#16B8FF', '#42C98A'], borderRadius: 6 }] }} options={chartOptions} /></div> : <div className="analytics-empty"><Icon name="goals" size={22} /><strong>No career goals</strong><span>Career progress starts when you add goals.</span></div>}
        </article>
      </div>

      <article className="panel analytics-chart-card analytics-dsa-activity">
        <div className="panel-heading"><div><div className="section-kicker">DSA ACTIVITY</div><h2>Solved over time</h2></div></div>
        {hasActivity(activity?.dsa.completed) ? <div className="analytics-chart"><Line data={dsaChart} options={chartOptions} /></div> : <div className="analytics-empty"><Icon name="code" size={22} /><strong>No DSA activity</strong><span>Problems solved in this range will appear here.</span></div>}
      </article>
    </section>
  )
}

function AppLayout({ user, onLogout }) {
  const [tasks, setTasks] = useState([])
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [apiError, setApiError] = useState('')
  const userId = user?.id || null
  const [records, setRecords] = useState({
    focusSessions: [],
    focusStats: null,
    solvedProblems: [],
    careerGoals: [],
  })
  const location = useLocation()
  const activePage = navigationItems.find((item) => item.path === location.pathname)
  const activePath = activePage ? activePage.path : '/'
  const pageTitle = activePage?.label ?? 'Overview'

  useEffect(() => {
    let cancelled = false
    async function loadTasks() {
      setApiError('')
      try {
        const response = await fetch(`${API_BASE_URL}/api/tasks`, {
          credentials: 'include',
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.message || 'Unable to load tasks.')
        if (!cancelled) {
          setTasks(result.data.map((task) => ({
            ...task,
            completed: task.status === 'completed',
            completedAt: task.completed_at ? new Date(task.completed_at) : null,
          })))
        }
      } catch (error) {
        if (!cancelled) {
          setTasks([])
          setApiError(error.message || 'Unable to connect to the Flask API.')
        }
      }
    }

    loadTasks()
    async function loadFocusRecords() {
      try {
        const timezoneOffset = -new Date().getTimezoneOffset()
        const [sessionsResponse, statsResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/api/focus/sessions`, { credentials: 'include' }),
          fetch(`${API_BASE_URL}/api/focus/stats?timezone_offset_minutes=${timezoneOffset}`, { credentials: 'include' }),
        ])
        const sessionsResult = await sessionsResponse.json()
        const statsResult = await statsResponse.json()
        if (!cancelled && sessionsResponse.ok && statsResponse.ok) {
          setRecords({
            focusSessions: sessionsResult.data.filter((item) => item.status === 'completed'),
            focusStats: statsResult.data,
            solvedProblems: [],
            careerGoals: [],
          })
        }
      } catch {
        if (!cancelled) setRecords((current) => ({ ...current, focusStats: null }))
      }
    }
    loadFocusRecords()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    async function refreshFocusRecords() {
      try {
        const timezoneOffset = -new Date().getTimezoneOffset()
        const [sessionsResponse, statsResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/api/focus/sessions`, { credentials: 'include' }),
          fetch(`${API_BASE_URL}/api/focus/stats?timezone_offset_minutes=${timezoneOffset}`, { credentials: 'include' }),
        ])
        const sessionsResult = await sessionsResponse.json()
        const statsResult = await statsResponse.json()
        if (sessionsResponse.ok && statsResponse.ok) {
          setRecords({
            focusSessions: sessionsResult.data.filter((item) => item.status === 'completed'),
            focusStats: statsResult.data,
            solvedProblems: [],
            careerGoals: [],
          })
        }
      } catch {
        // Keep the existing dashboard state when the refresh request fails.
      }
    }
    window.addEventListener('focus-data-updated', refreshFocusRecords)
    return () => window.removeEventListener('focus-data-updated', refreshFocusRecords)
  }, [])

  async function addTask(taskDetails) {
    setApiError('')
    try {
      const activeCsrfToken = await refreshCsrfToken()
      const payload = typeof taskDetails === 'string'
        ? { title: taskDetails, description: '', due_date: null, priority: 'medium' }
        : taskDetails
      const response = await fetch(`${API_BASE_URL}/api/tasks`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': activeCsrfToken,
        },
        body: JSON.stringify({
          title: payload.title,
          description: payload.description || '',
          due_date: payload.due_date || null,
          priority: payload.priority || 'medium',
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Unable to create the task.')
      setTasks((currentTasks) => [
        {
          ...result.data,
          completed: result.data.status === 'completed',
          completedAt: null,
        },
        ...currentTasks,
      ])
      return true
    } catch (error) {
      setApiError(error.message || 'Unable to connect to the Flask API.')
      return false
    }
  }

  async function toggleTask(taskId) {
    const task = tasks.find((item) => item.id === taskId)
    if (!task) return
    const status = task.completed ? 'pending' : 'completed'
    setApiError('')
    try {
      const activeCsrfToken = await refreshCsrfToken()
      const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': activeCsrfToken,
        },
        body: JSON.stringify({ status }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Unable to update the task.')
      setTasks((currentTasks) =>
        currentTasks.map((item) =>
          item.id === taskId
            ? {
                ...result.data,
                completed: result.data.status === 'completed',
                completedAt: result.data.completed_at ? new Date(result.data.completed_at) : null,
              }
            : item,
        ),
      )
    } catch (error) {
      setApiError(error.message || 'Unable to connect to the Flask API.')
    }
  }

  async function updateTask(taskId, taskDetails) {
    setApiError('')
    try {
      const activeCsrfToken = await refreshCsrfToken()
      const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': activeCsrfToken,
        },
        body: JSON.stringify({
          ...taskDetails,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Unable to update the task.')
      setTasks((currentTasks) =>
        currentTasks.map((item) =>
          item.id === taskId
            ? {
                ...result.data,
                completed: result.data.status === 'completed',
              completedAt: result.data.completed_at ? new Date(result.data.completed_at) : null,
              }
            : item,
        ),
      )
      return true
    } catch (error) {
      setApiError(error.message || 'Unable to connect to the Flask API.')
      return false
    }
  }

  async function deleteTask(taskId) {
    setApiError('')
    try {
      const activeCsrfToken = await refreshCsrfToken()
      const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'X-CSRF-Token': activeCsrfToken },
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Unable to delete the task.')
      setTasks((currentTasks) => currentTasks.filter((item) => item.id !== taskId))
    } catch (error) {
      setApiError(error.message || 'Unable to connect to the Flask API.')
    }
  }

  return (
    <div className={`app-shell${isSidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
      <aside className="sidebar" aria-label="Main sidebar">
        <NavLink
          aria-label="FocusFlow AI overview"
          className="brand"
          to="/"
          title={isSidebarCollapsed ? 'FocusFlow AI' : undefined}
        >
          <span className="brand-mark" aria-hidden="true">
            <Icon name="focus" size={22} />
          </span>
          <span className="brand-name">focusflow</span>
          <span className="brand-ai">AI</span>
        </NavLink>

        <div className="sidebar-label">WORKSPACE</div>
        <nav className="sidebar-nav" aria-label="Main navigation">
          {navigationItems.map((item) => (
            <NavLink
              aria-label={isSidebarCollapsed ? item.label : undefined}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              end={item.path === '/'}
              key={item.path}
              title={isSidebarCollapsed ? item.label : undefined}
              to={item.path}
            >
              <Icon name={item.icon} size={19} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-footer-icon"><Icon name="sparkle" size={18} /></div>
          <p>Small steps add up.</p>
          <span>Your space, your pace.</span>
        </div>
        <div className="sidebar-profile">
          <span className="profile-avatar">{(user?.name || user?.email || 'F').charAt(0).toUpperCase()}</span>
          <div className="profile-copy">
            <strong>{user?.name || 'FocusFlow user'}</strong>
            <span>{user?.email || 'Signed in'}</span>
          </div>
          <button aria-label="Log out" className="sidebar-logout" onClick={onLogout} type="button">
            <Icon name="logout" size={18} />
          </button>
        </div>
        <button
          aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-pressed={isSidebarCollapsed}
          className="sidebar-toggle"
          onClick={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
          type="button"
        >
          <span aria-hidden="true">{isSidebarCollapsed ? '›' : '‹'}</span>
          <span className="sidebar-toggle-label">{isSidebarCollapsed ? 'Expand' : 'Collapse sidebar'}</span>
        </button>
      </aside>

      <main className="main-content">
        <header className="page-header">
          <div>
            <div className="eyebrow">YOUR PERSONAL WORKSPACE</div>
            <h1>{pageTitle}</h1>
            <p className="header-subtitle">{pageDescriptions[activePath]}</p>
          </div>
          <div className="topbar-actions">
            <label className="global-search">
              <span className="visually-hidden">Search FocusFlow</span>
              <Icon name="search" size={18} />
              <input placeholder="Search workspace" type="search" />
            </label>
            <button aria-label="Notifications" className="notification-button" type="button">
              <Icon name="bell" size={18} />
              <span aria-hidden="true" />
            </button>
            <div className="topbar-profile">
              <button
                aria-expanded={isProfileOpen}
                className="profile-trigger"
                onClick={() => setIsProfileOpen((open) => !open)}
                type="button"
              >
                <span className="profile-avatar">{(user?.name || user?.email || 'F').charAt(0).toUpperCase()}</span>
                <span className="profile-trigger-copy">
                  <strong>{user?.name || 'FocusFlow user'}</strong>
                  <span>Workspace member</span>
                </span>
                <Icon name="chevron" size={16} />
              </button>
              {isProfileOpen && (
                <div className="profile-dropdown">
                  <NavLink onClick={() => setIsProfileOpen(false)} to="/settings">Account settings</NavLink>
                  <button onClick={onLogout} type="button">Log out</button>
                </div>
              )}
            </div>
          </div>
        </header>

        <Routes>
          <Route
            element={
              <OverviewPage
                onAddTask={addTask}
                onToggleTask={toggleTask}
                records={records}
                tasks={tasks}
                apiError={apiError}
                onDeleteTask={deleteTask}
                userId={userId}
              />
            }
            path="/"
          />
          <Route
            element={
              <TasksPage
                apiError={apiError}
                onAddTask={addTask}
                onDeleteTask={deleteTask}
                onToggleTask={toggleTask}
                onUpdateTask={updateTask}
                tasks={tasks}
                userId={userId}
              />
            }
            path="/tasks"
          />
          <Route
            element={
              <FocusTimerPage user={user} />
            }
            path="/focus"
          />
          <Route
            element={
              <DSAPage userId={userId} />
            }
            path="/dsa"
          />
          <Route
            element={
              <CareerGoalsPage userId={userId} />
            }
            path="/career"
          />
          <Route element={<AnalyticsPage tasks={tasks} />} path="/analytics" />
          <Route
            element={<AssistantPage />}
            path="/assistant"
          />
          <Route
            element={<SettingsPage user={user} onLogout={onLogout} />}
            path="/settings"
          />
          <Route element={<Navigate replace to="/" />} path="*" />
        </Routes>
      </main>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" className="google-g" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.06H12v3.9h5.38a4.6 4.6 0 0 1-2 3.02v2.53h3.24c1.9-1.75 3-4.33 3-7.39z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.63-2.38l-3.24-2.53c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.61A10 10 0 0 0 12 22z" />
      <path fill="#FBBC05" d="M6.39 13.92A6 6 0 0 1 6.07 12c0-.67.12-1.32.32-1.92V7.47H3.04A10 10 0 0 0 2 12c0 1.63.39 3.18 1.04 4.53l3.35-2.61z" />
      <path fill="#EA4335" d="M12 5.95c1.47 0 2.79.51 3.82 1.5l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.96 5.47l3.35 2.61C7.18 7.71 9.39 5.95 12 5.95z" />
    </svg>
  )
}

function PasswordStrength({ password }) {
  const score = [
    password.length >= 8,
    /[A-Z]/.test(password) && /[a-z]/.test(password),
    /\d/.test(password),
    /[!@#$%^&*()_=+-]/.test(password),
  ].filter(Boolean).length
  const labels = ['Too weak', 'Fair', 'Good', 'Strong']

  return password ? (
    <div className="password-strength" aria-live="polite">
      <div className="strength-bars">
        {[1, 2, 3, 4].map((level) => (
          <span className={level <= score ? `active score-${score}` : ''} key={level} />
        ))}
      </div>
      <span>{labels[Math.max(0, score - 1)]}</span>
    </div>
  ) : null
}

function AuthScreen({ mode, onAuthenticated }) {
  const location = useLocation()
  const isRegister = mode === 'register'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const authError = params.get('error')
    const messages = {
      account_exists: 'This email already belongs to a FocusFlow account. Sign in and link Google from Settings.',
      email_conflict: 'Google could not be safely linked because the email belongs to another account.',
      server_error: 'The account could not be created due to a server error.',
    }
    if (authError && messages[authError]) setError(messages[authError])
  }, [location.search])

  async function submit(event) {
    event.preventDefault()
    setError('')

    if (isRegister && password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    try {
      const activeCsrfToken = await refreshCsrfToken()
      const response = await fetch(`${API_BASE_URL}/api/auth/${isRegister ? 'register' : 'login'}`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': activeCsrfToken,
        },
        body: JSON.stringify(
          isRegister
            ? { name, email, password, confirmPassword }
            : { email, password, remember },
        ),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Unable to continue.')
      if (isRegister) {
        setSuccess(true)
      } else {
        onAuthenticated(result.data)
      }
    } catch (requestError) {
      setError(requestError.message || 'Unable to connect to the server.')
    } finally {
      setSubmitting(false)
    }
  }

  function continueWithGoogle() {
    window.location.assign(`${API_BASE_URL}/api/auth/google`)
  }

  if (success) {
    return (
      <main className="auth-page">
        <div className="auth-orb auth-orb-one" />
        <div className="auth-orb auth-orb-two" />
        <section className="auth-card auth-success-card" aria-live="polite">
          <div className="auth-brand">
            <span className="brand-mark"><Icon name="focus" size={24} /></span>
            <span>FocusFlow</span><b>AI</b>
          </div>
          <div className="success-check"><Icon name="check" size={28} /></div>
          <div className="auth-heading">
            <span className="auth-kicker">ACCOUNT READY</span>
            <h1>Your focus space is ready.</h1>
            <p>Your account was created successfully. Sign in to enter your workspace.</p>
          </div>
          <button className="auth-primary" onClick={() => { window.location.assign('/login') }} type="button">
            Continue to login
          </button>
        </section>
      </main>
    )
  }

  return (
    <main className="auth-page">
      <div className="auth-orb auth-orb-one" />
      <div className="auth-orb auth-orb-two" />
      <div className="auth-particles" aria-hidden="true">
        <span /><span /><span /><span /><span /><span />
      </div>
      <section className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark"><Icon name="focus" size={24} /></span>
          <span>FocusFlow</span><b>AI</b>
        </div>
        <div className="auth-heading">
          <span className="auth-kicker">{isRegister ? 'BEGIN YOUR JOURNEY' : 'ENTER YOUR FOCUS SPACE'}</span>
          <h1>{isRegister ? 'Create your account' : 'Welcome back'}</h1>
          <p>{isRegister ? 'Build a calmer, more focused productivity routine.' : 'Your progress and priorities are waiting.'}</p>
        </div>

        {error && <div className="auth-error" role="alert">{error}</div>}

        <form className="auth-form" onSubmit={submit}>
          {isRegister && (
            <label>
              <span>Full name</span>
              <input autoComplete="name" onChange={(event) => setName(event.target.value)} placeholder="Enter your name" required value={name} />
            </label>
          )}
          <label>
            <span>Email address</span>
            <input autoComplete="email" inputMode="email" onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required type="email" value={email} />
          </label>
          <label>
            <span>Password</span>
            <div className="password-input">
              <input
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                minLength={isRegister ? 8 : undefined}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={isRegister ? 'Create a strong password' : 'Enter your password'}
                required
                type={showPassword ? 'text' : 'password'}
                value={password}
              />
              <button
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((visible) => !visible)}
                type="button"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </label>
          {isRegister && (
            <>
              <PasswordStrength password={password} />
              <label>
                <span>Confirm password</span>
                <div className="password-input">
                  <input
                    autoComplete="new-password"
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Repeat your password"
                    required
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                  />
                </div>
              </label>
            </>
          )}
          {!isRegister && (
            <div className="auth-options">
              <label className="remember-check">
                <input checked={remember} onChange={(event) => setRemember(event.target.checked)} type="checkbox" />
                <span>Remember me</span>
              </label>
              <NavLink className="forgot-link" to="/forgot-password">Forgot password?</NavLink>
            </div>
          )}
          <button className="auth-primary" disabled={submitting} type="submit">
            <span>{submitting ? 'Please wait...' : (isRegister ? 'Create account' : 'Login')}</span>
          </button>
        </form>

        <div className="auth-divider"><span>OR CONTINUE WITH</span></div>
        <button className="google-button" onClick={continueWithGoogle} type="button">
          <GoogleIcon />
          {isRegister ? 'Sign up with Google' : 'Sign in with Google'}
        </button>
        <p className="auth-switch">
          {isRegister ? 'Already have an account?' : 'New to FocusFlow AI?'}
          {' '}
          <NavLink to={isRegister ? '/login' : '/register'}>{isRegister ? 'Login' : 'Create account'}</NavLink>
        </p>
      </section>
    </main>
  )
}

function ForgotPasswordScreen() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    setSubmitting(true)
    try {
      const activeCsrfToken = await refreshCsrfToken()
      const response = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': activeCsrfToken,
        },
        body: JSON.stringify({ email }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Unable to send the reset link.')
      setMessage(result.message)
    } catch (requestError) {
      setError(requestError.message || 'Unable to connect to the server.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-orb auth-orb-one" />
      <div className="auth-orb auth-orb-two" />
      <section className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark"><Icon name="focus" size={24} /></span>
          <span>FocusFlow</span><b>AI</b>
        </div>
        <div className="auth-heading">
          <span className="auth-kicker">ACCOUNT RECOVERY</span>
          <h1>Forgot your password?</h1>
          <p>Enter your email and we will send a secure reset link if an account exists.</p>
        </div>
        {error && <div className="auth-error" role="alert">{error}</div>}
        {message && <div className="auth-message" role="status">{message}</div>}
        <form className="auth-form" onSubmit={submit}>
          <label>
            <span>Email address</span>
            <input autoComplete="email" inputMode="email" onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required type="email" value={email} />
          </label>
          <button className="auth-primary" disabled={submitting} type="submit">
            <span>{submitting ? 'Please wait...' : 'Send reset link'}</span>
          </button>
        </form>
        <p className="auth-switch"><a href="/login">Back to login</a></p>
      </section>
    </main>
  )
}

function ResetPasswordScreen() {
  const location = useLocation()
  const token = new URLSearchParams(location.search).get('token') || ''
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    if (!token) {
      setError('This reset link is missing its token.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setSubmitting(true)
    try {
      const activeCsrfToken = await refreshCsrfToken()
      const response = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': activeCsrfToken,
        },
        body: JSON.stringify({ token, password, confirmPassword }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Unable to reset the password.')
      setMessage(result.message)
      setPassword('')
      setConfirmPassword('')
    } catch (requestError) {
      setError(requestError.message || 'Unable to connect to the server.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-orb auth-orb-one" />
      <div className="auth-orb auth-orb-two" />
      <section className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark"><Icon name="focus" size={24} /></span>
          <span>FocusFlow</span><b>AI</b>
        </div>
        <div className="auth-heading">
          <span className="auth-kicker">SECURE RECOVERY</span>
          <h1>Create a new password</h1>
          <p>Choose a strong password you have not used elsewhere.</p>
        </div>
        {error && <div className="auth-error" role="alert">{error}</div>}
        {message && <div className="auth-message" role="status">{message}</div>}
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            <span>New password</span>
            <div className="password-input">
              <input autoComplete="new-password" minLength={8} onChange={(event) => setPassword(event.target.value)} placeholder="Create a strong password" required type={showPassword ? 'text' : 'password'} value={password} />
              <button aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((visible) => !visible)} type="button">{showPassword ? 'Hide' : 'Show'}</button>
            </div>
          </label>
          <PasswordStrength password={password} />
          <label>
            <span>Confirm new password</span>
            <div className="password-input">
              <input autoComplete="new-password" onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repeat your password" required type={showPassword ? 'text' : 'password'} value={confirmPassword} />
            </div>
          </label>
          <button className="auth-primary" disabled={submitting} type="submit">
            <span>{submitting ? 'Please wait...' : 'Reset password'}</span>
          </button>
        </form>
        <p className="auth-switch"><a href="/login">Back to login</a></p>
      </section>
    </main>
  )
}

function App() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  async function refreshAuth() {
    try {
      const meResponse = await fetch(`${API_BASE_URL}/api/auth/me`, { credentials: 'include' })
      const me = await meResponse.json()
      if (me.authenticated) setUser(me.data)
      else setUser(null)
    } catch {
      setUser(null)
    } finally {
      setAuthLoading(false)
    }
  }

  useEffect(() => {
    refreshAuth()
  }, [])

  async function logout() {
    try {
      const activeCsrfToken = await refreshCsrfToken()
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-CSRF-Token': activeCsrfToken },
      })
    } finally {
      setUser(null)
      window.location.assign('/login')
    }
  }

  async function handleAuthenticated(authenticatedUser) {
    setUser(authenticatedUser)
  }

  if (authLoading) {
    return <div className="auth-loading">Preparing your focus space...</div>
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={user ? <Navigate replace to="/" /> : <AuthScreen mode="login" onAuthenticated={handleAuthenticated} />} path="/login" />
        <Route element={user ? <Navigate replace to="/" /> : <AuthScreen mode="register" onAuthenticated={setUser} />} path="/register" />
        <Route element={<ForgotPasswordScreen />} path="/forgot-password" />
        <Route element={<ResetPasswordScreen />} path="/reset-password" />
        <Route
          element={
            user
              ? <AppLayout onLogout={logout} user={user} />
              : <Navigate replace to="/login" />
          }
          path="/*"
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
