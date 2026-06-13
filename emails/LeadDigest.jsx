import {
  Html, Head, Body, Container, Preview,
  Heading, Text, Section, Hr, Link,
} from '@react-email/components'

const base = process.env.NEXT_PUBLIC_APP_URL || 'https://bt.cyber-tech.com'

export default function LeadDigestEmail({ user = {}, activity = {}, tasks = [], slug = '', lang = 'zh' }) {
  const isEn = lang === 'en'
  const locale = isEn ? 'en-US' : 'zh-TW'

  const STATUS_LABEL = isEn
    ? { open: 'Not Started', in_progress: 'In Progress', done: 'Done' }
    : { open: '未開始', in_progress: '進行中', done: '已完成' }
  const STATUS_COLOR = { open: '#6b7280', in_progress: '#d97706', done: '#16a34a' }

  const byStatus = {
    in_progress: tasks.filter((t) => t.status === 'in_progress'),
    open:        tasks.filter((t) => t.status === 'open'),
    done:        tasks.filter((t) => t.status === 'done'),
  }

  return (
    <Html>
      <Head />
      <Preview>
        {isEn ? `Activity summary · ${activity.name}` : `活動進度摘要 · ${activity.name}`}
      </Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.h1}>
            {isEn ? 'Activity summary' : '活動進度摘要'}
          </Heading>
          <Text style={styles.subtitle}>{activity.name}</Text>
          <Text style={styles.intro}>
            {isEn
              ? `Hi ${user.name ?? user.email}, here is the current status of tasks in your activity.`
              : `${user.name ?? user.email} 您好，以下是您負責活動的最新任務狀態。`}
          </Text>

          {tasks.length === 0 ? (
            <Text style={styles.muted}>
              {isEn ? 'No tasks in this activity yet.' : '此活動目前尚無任務。'}
            </Text>
          ) : (
            Object.entries(byStatus).map(([statusKey, group]) =>
              group.length > 0 ? (
                <Section key={statusKey}>
                  <Text style={{ ...styles.sectionHeader, color: STATUS_COLOR[statusKey] }}>
                    {STATUS_LABEL[statusKey]} ({group.length})
                  </Text>
                  {group.map((task) => (
                    <div key={task.id} style={styles.card}>
                      <Text style={styles.cardTitle}>{task.title}</Text>
                      <Text style={styles.cardMeta}>
                        {task.due_date
                          ? `${isEn ? 'Due' : '到期'}: ${new Date(task.due_date + 'T00:00:00').toLocaleDateString(locale, { month: 'short', day: 'numeric' })}`
                          : (isEn ? 'No due date' : '無到期日')}
                      </Text>
                      <Link href={`${base}/${slug}/tasks?id=${task.id}`} style={styles.link}>
                        {isEn ? 'View task →' : '查看任務 →'}
                      </Link>
                    </div>
                  ))}
                </Section>
              ) : null
            )
          )}

          <Hr style={styles.hr} />
          <Text style={styles.footer}>
            {isEn ? 'Reply to this email to contact admin.' : '如有問題，請回覆此郵件聯繫管理員。'}
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

const styles = {
  body:          { fontFamily: 'sans-serif', backgroundColor: '#f9fafb' },
  container:     { maxWidth: '600px', margin: '0 auto', padding: '32px 16px' },
  h1:            { fontSize: '20px', color: '#111827', marginBottom: '4px' },
  subtitle:      { fontSize: '14px', color: '#6b7280', marginTop: 0, marginBottom: '16px' },
  intro:         { color: '#6b7280', marginBottom: '24px' },
  muted:         { color: '#9ca3af' },
  sectionHeader: { fontWeight: '600', fontSize: '13px', marginBottom: '8px', marginTop: '16px' },
  card:          { background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '14px', marginBottom: '10px' },
  cardTitle:     { margin: '0 0 4px', fontWeight: '600', color: '#111827', fontSize: '14px' },
  cardMeta:      { margin: '0 0 8px', color: '#6b7280', fontSize: '13px' },
  link:          { color: '#2563eb', fontSize: '13px' },
  hr:            { margin: '24px 0', borderColor: '#e5e7eb' },
  footer:        { fontSize: '12px', color: '#9ca3af' },
}
