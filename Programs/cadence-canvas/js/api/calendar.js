// cadence-canvas / js / api / calendar.js
// API_SLOT: Google Calendar / iCal
//
// Replace the mock return below with a live fetch once credentials are set up.
// Scope required: https://www.googleapis.com/auth/calendar.readonly
//
// Integration order: 1st — most impactful, directly feeds the somatic timeline.

const CalendarAPI = (() => {

  // ── Config (fill in post-auth) ────────────────────────────
  const CONFIG = {
    // API_SLOT — replace with your OAuth client ID
    clientId:    'YOUR_GOOGLE_CLIENT_ID',
    // API_SLOT — replace with your API key (for public calendars)
    apiKey:      'YOUR_GOOGLE_API_KEY',
    calendarId:  'primary',
    maxResults:  10,
    scopes:      'https://www.googleapis.com/auth/calendar.readonly',
  };

  // ── Fetch upcoming events ─────────────────────────────────
  async function getUpcoming(count = 3) {
    // API_SLOT ─────────────────────────────────────────────────
    // Uncomment and configure once Google OAuth is set up:
    //
    // const timeMin = new Date().toISOString();
    // const url = `https://www.googleapis.com/calendar/v3/calendars/${CONFIG.calendarId}/events`
    //           + `?key=${CONFIG.apiKey}`
    //           + `&timeMin=${timeMin}`
    //           + `&maxResults=${count}`
    //           + `&singleEvents=true`
    //           + `&orderBy=startTime`;
    //
    // const res = await fetch(url, {
    //   headers: { Authorization: `Bearer ${await getAccessToken()}` }
    // });
    // const data = await res.json();
    //
    // return data.items.map(ev => ({
    //   id:         ev.id,
    //   title:      ev.summary,
    //   time:       formatTime(ev.start.dateTime),
    //   duration:   getDurationMins(ev.start.dateTime, ev.end.dateTime),
    //   type:       ev.colorId === '2' ? 'personal' : 'work',
    //   attendees:  (ev.attendees || []).map(a => a.email),
    //   minutesUntil: getMinutesUntil(ev.start.dateTime),
    //   agenda:     ev.description || '',
    // }));
    // ──────────────────────────────────────────────────────────

    // Fallback: return mock data
    return MOCK.calendar.slice(0, count);
  }

  // ── iCal feed (alternative to Google API) ─────────────────
  async function getFromICal(feedUrl) {
    // API_SLOT ─────────────────────────────────────────────────
    // Parse .ics feed via a proxy (browser can't fetch iCal directly due to CORS).
    // Recommended: use a small serverless function to proxy and parse.
    //
    // const res = await fetch(`/api/ical-proxy?url=${encodeURIComponent(feedUrl)}`);
    // const events = await res.json();
    // return events;
    // ──────────────────────────────────────────────────────────
    return MOCK.calendar;
  }

  // ── Helpers ───────────────────────────────────────────────
  function formatTime(dateTimeStr) {
    const d = new Date(dateTimeStr);
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  function getDurationMins(start, end) {
    return Math.round((new Date(end) - new Date(start)) / 60000);
  }

  function getMinutesUntil(dateTimeStr) {
    return Math.max(0, Math.round((new Date(dateTimeStr) - Date.now()) / 60000));
  }

  async function getAccessToken() {
    // API_SLOT — implement Google OAuth 2.0 token refresh here
    return null;
  }

  return { getUpcoming, getFromICal };

})();
