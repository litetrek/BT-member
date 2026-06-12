import {
  Html, Head, Body, Container, Preview,
  Heading, Text, Section, Hr, Link,
} from '@react-email/components'

const base = process.env.NEXT_PUBLIC_APP_URL || 'https://bt.cyber-tech.com'

const STATUS_LABEL = { open: 'Open', in_progress: 'In Progress', done: 'Done' }
const STATUS_COLOR = { open: '#6b7280', in_progress: '#d97706', done: '#16a34a' }

export default function LeadDigestEmail({ user = {}, activity = {}, tasks = [], slug = '' }) {
  const byStatus = {
    in_progress: tasks.filter((t) => t.status === 'in_progress'),
    open:        tasks.filter((t) => t.status === 'open'),
    done:        tasks.filter((t) => t.status === 'done'),
  }

  return (
    <Html>
      <Head />
      <Preview>Activity summary · {activity.name}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.h1}>Activity summary</Heading>
          <Text style={styles.subtitle}>{activity.name}</Text>
          <Text style={styles.intro}>
            Hi {user.name ?? user.email}, here is the current status of tasks in your activity.
          </Text>

          {tasks.length === 0 ? (
            <Text style={styles.muted}>No tasks in this activity yet.</Text>
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
                          ? `Due: ${new Date(task.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                          : 'No due date'}
                      </Text>
                      <Link href={`${base}/${slug}/tasks?id=${task.id}`} style={styles.link}>
                        View task →
                      </Link>
                    </div>
                  ))}
                </Section>
              ) : null
            )
          )}

          <Hr style={styles.hr} />
          <Text style={styles.footer}>Reply to this email to contact admin.</Text>
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
