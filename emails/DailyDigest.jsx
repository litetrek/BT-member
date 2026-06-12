import {
  Html, Head, Body, Container, Preview,
  Heading, Text, Section, Hr, Link,
} from '@react-email/components'

const base = process.env.NEXT_PUBLIC_APP_URL || 'https://bt.cyber-tech.com'

export default function DailyDigestEmail({ user = {}, tasks = [], slug = '' }) {
  return (
    <Html>
      <Head />
      <Preview>Your tasks today · BT Annual Event</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.h1}>Your tasks today</Heading>
          <Text style={styles.intro}>
            Hi {user.name ?? user.email}, here are your assigned tasks for today.
          </Text>

          {tasks.length === 0 ? (
            <Text style={styles.muted}>No tasks assigned to you right now.</Text>
          ) : (
            <Section>
              {tasks.map((task) => (
                <div key={task.id} style={styles.card}>
                  <Text style={styles.cardTitle}>{task.title}</Text>
                  <Text style={styles.cardMeta}>
                    Status: {task.status.replace('_', ' ')}
                    {task.due_date
                      ? ` · Due: ${new Date(task.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                      : ''}
                  </Text>
                  <Link href={`${base}/${slug}/tasks?id=${task.id}`} style={styles.link}>
                    View task →
                  </Link>
                </div>
              ))}
            </Section>
          )}

          <Hr style={styles.hr} />
          <Text style={styles.footer}>Reply to this email to contact admin.</Text>
        </Container>
      </Body>
    </Html>
  )
}

const styles = {
  body:       { fontFamily: 'sans-serif', backgroundColor: '#f9fafb' },
  container:  { maxWidth: '600px', margin: '0 auto', padding: '32px 16px' },
  h1:         { fontSize: '20px', color: '#111827', marginBottom: '8px' },
  intro:      { color: '#6b7280', marginBottom: '24px' },
  muted:      { color: '#9ca3af' },
  card:       { background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px', marginBottom: '12px' },
  cardTitle:  { margin: '0 0 4px', fontWeight: '600', color: '#111827', fontSize: '14px' },
  cardMeta:   { margin: '0 0 8px', color: '#6b7280', fontSize: '13px' },
  link:       { color: '#2563eb', fontSize: '13px' },
  hr:         { margin: '24px 0', borderColor: '#e5e7eb' },
  footer:     { fontSize: '12px', color: '#9ca3af' },
}
