import {
  Html, Head, Body, Container, Preview,
  Heading, Text, Section, Hr, Link,
} from '@react-email/components'

const base = process.env.NEXT_PUBLIC_APP_URL || 'https://bt.cyber-tech.com'

export default function OverdueReminderEmail({ user = {}, tasks = [], slug = '', lang = 'zh' }) {
  const isEn = lang === 'en'
  const locale = isEn ? 'en-US' : 'zh-TW'

  return (
    <Html>
      <Head />
      <Preview>
        {isEn ? 'Action needed — overdue tasks · BT Annual Event' : '注意：逾期任務提醒 · BT 年度活動'}
      </Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.h1}>
            {isEn ? 'Action needed — overdue tasks' : '注意：您有逾期任務'}
          </Heading>
          <Text style={styles.intro}>
            {isEn
              ? `Hi ${user.name ?? user.email}, the following tasks are past their due date and still open.`
              : `${user.name ?? user.email} 您好，以下任務已逾期且尚未完成，請盡快處理。`}
          </Text>

          <Section>
            {tasks.map((task) => (
              <div key={task.id} style={styles.card}>
                <Text style={styles.cardTitle}>{task.title}</Text>
                <Text style={styles.cardMeta}>
                  {isEn ? 'Due:' : '到期日：'}{' '}
                  <span style={{ color: '#dc2626' }}>
                    {task.due_date
                      ? new Date(task.due_date + 'T00:00:00').toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' })
                      : '—'}
                  </span>
                </Text>
                <Link href={`${base}/${slug}/tasks?id=${task.id}`} style={styles.link}>
                  {isEn ? 'View task →' : '查看任務 →'}
                </Link>
              </div>
            ))}
          </Section>

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
  h1:         { fontSize: '20px', color: '#dc2626', marginBottom: '8px' },
  intro:      { color: '#6b7280', marginBottom: '24px' },
  card:       { background: '#fff', border: '1px solid #fecaca', borderRadius: '8px', padding: '16px', marginBottom: '12px' },
  cardTitle:  { margin: '0 0 4px', fontWeight: '600', color: '#111827', fontSize: '14px' },
  cardMeta:   { margin: '0 0 8px', color: '#6b7280', fontSize: '13px' },
  link:       { color: '#2563eb', fontSize: '13px' },
  hr:         { margin: '24px 0', borderColor: '#e5e7eb' },
  footer:     { fontSize: '12px', color: '#9ca3af' },
}
