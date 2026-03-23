// cadence-canvas / js / api / tasks.js
// API_SLOT: Linear / Jira / Notion Tasks
//
// Fetches top tasks weighted by due date, priority, and current calendar context.
// Integration order: 5th (or alongside Notion)

const TasksAPI = (() => {

  const CONFIG = {
    // API_SLOT — choose your task backend and add credentials
    backend: 'linear',   // 'linear' | 'jira' | 'notion'

    // Linear
    linearApiKey:  'YOUR_LINEAR_API_KEY',
    linearTeamId:  'YOUR_LINEAR_TEAM_ID',

    // Jira
    jiraBase:      'https://your-domain.atlassian.net',
    jiraEmail:     'your@email.com',
    jiraApiToken:  'YOUR_JIRA_API_TOKEN',
    jiraProjectKey:'CAD',

    // Serverless proxy base (recommended over direct client-side calls)
    proxyBase: '/api/tasks',
  };

  // ── Get top tasks ─────────────────────────────────────────
  async function getTopTasks(limit = 5) {
    // API_SLOT: Linear ─────────────────────────────────────────
    // const query = `{
    //   issues(
    //     filter: { assignee: { isMe: { eq: true } }, state: { type: { nin: ["completed", "cancelled"] } } }
    //     orderBy: updatedAt
    //     first: ${limit}
    //   ) {
    //     nodes {
    //       id title priority dueDate
    //       state { name }
    //       assignee { name avatarUrl }
    //       project { name }
    //     }
    //   }
    // }`;
    //
    // const res = await fetch('https://api.linear.app/graphql', {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'Authorization': CONFIG.linearApiKey,
    //   },
    //   body: JSON.stringify({ query })
    // });
    // const { data } = await res.json();
    //
    // return data.issues.nodes.map(issue => ({
    //   id:       issue.id,
    //   title:    issue.title,
    //   assignee: issue.assignee?.name ?? '',
    //   due:      formatDue(issue.dueDate),
    //   status:   issue.state.name,
    //   priority: mapLinearPriority(issue.priority),
    //   project:  issue.project?.name ?? '',
    // }));
    // ──────────────────────────────────────────────────────────

    // API_SLOT: Jira ───────────────────────────────────────────
    // const jql = `assignee = currentUser() AND statusCategory != Done ORDER BY priority ASC`;
    // const url = `${CONFIG.jiraBase}/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=${limit}`;
    // const auth = btoa(`${CONFIG.jiraEmail}:${CONFIG.jiraApiToken}`);
    //
    // const res = await fetch(url, {
    //   headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' }
    // });
    // const data = await res.json();
    //
    // return data.issues.map(issue => ({
    //   id:       issue.key,
    //   title:    issue.fields.summary,
    //   assignee: issue.fields.assignee?.displayName ?? '',
    //   due:      issue.fields.duedate ? formatDue(issue.fields.duedate) : 'No date',
    //   status:   issue.fields.status.name,
    //   priority: issue.fields.priority.name.toLowerCase(),
    //   project:  issue.fields.project.key,
    // }));
    // ──────────────────────────────────────────────────────────

    return MOCK.tasks.slice(0, limit);
  }

  // ── Update task status ────────────────────────────────────
  async function updateStatus(taskId, newStatus) {
    // API_SLOT — patch via proxy
    console.log('[Cadence] Task status update queued (API_SLOT):', { taskId, newStatus });
    return { ok: true, simulated: true };
  }

  // ── Helpers ───────────────────────────────────────────────
  function formatDue(dateStr) {
    if (!dateStr) return 'No date';
    const d = new Date(dateStr);
    const today = new Date();
    today.setHours(0,0,0,0);
    const diff = Math.round((d - today) / 86400000);
    if (diff === 0)  return 'Today';
    if (diff === 1)  return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    if (diff < 0)    return `${Math.abs(diff)} days overdue`;
    return `${diff} days`;
  }

  function mapLinearPriority(n) {
    return ['none', 'urgent', 'high', 'medium', 'low'][n] ?? 'low';
  }

  return { getTopTasks, updateStatus };

})();
