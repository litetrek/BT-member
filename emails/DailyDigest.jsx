import {
  Html, Head, Body, Container, Preview,
  Heading, Text, Section, Hr, Link,
} from '@react-email/components'

const base = process.env.NEXT_PUBLIC_APP_URL || 'https://bt.cyber-tech.com'

export default function DailyDigestEmail({ user = {}, tasks = [], slug = '', lang = 'zh' }) {
  const isEn = lang === 'en'
  const locale = isEn ? 'en-US' : 'zh-TW'

  const STATUS_LABEL = isEn
    ? { open: 'Not Started', in_progress: 'In Progress', done: 'Done', overdue: 'Overdue' }
    : { open: '未開始', in_progress: '進行中', done: '已完成', overdue: '逾期' }

  return (
    <Html>
      <Head />
      <Preview>{isEn ? 'Your tasks today · BT Annual Event' : '今日任務摘要 · BT 年度活動'}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.h1}>
            {isEn ? 'Your tasks today' : '今日任務摘要'}
          </Heading>
          <Text style={styles.intro}>
            {isEn
              ? `Hi ${user.name ?? user.email}, here are your assigned tasks for today.`
              : `${user.name ?? user.email} 您好，以下是今日指派給您的任務。`}
          </Text>

          {tasks.length === 0 ? (
            <Text style={styles.muted}>
              {isEn ? 'No tasks assigned to you right now.' : '目前沒有指派給您的任務。'}
            </Text>
          ) : (
            <Section>
              {tasks.map((task) => (
                <div key={task.id} style={styles.card}>
                  <Text style={styles.cardTitle}>{task.title}</Text>
                  <Text style={styles.cardMeta}>
                    {isEn ? 'Status' : '狀態'}:{' '}
                    {STATUS_LABEL[task.status] ?? task.status}
                    {task.due_date
                      ? ` · ${isEn ? 'Due' : '到期'}:` +
                        ` ${new Date(task.due_date + 'T00:00:00').toLocaleDateString(locale, { month: 'short', day: 'numeric' })}`
                      : ''}
                  </Text>
                  <Link href={`${base}/${slug}/tasks?id=${task.id}`} style={styles.link}>
                    {isEn ? 'View task →' : '查看任務 →'}
                  </Link>
                </div>
              ))}
            </Section>
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
