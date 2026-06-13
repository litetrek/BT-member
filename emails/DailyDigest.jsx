import {
  Html, Head, Body, Container, Preview,
  Heading, Text, Section, Hr, Link,
} from '@react-email/components'
import { t } from '@/lib/lang'

const base = process.env.NEXT_PUBLIC_APP_URL || 'https://bt.cyber-tech.com'

export default function DailyDigestEmail({ user = {}, tasks = [], slug = '', lang = 'zh' }) {
  const locale = lang === 'en' ? 'en-US' : 'zh-TW'

  const STATUS_LABEL = {
    open:        t(lang, 'Not Started', '未開始'),
    in_progress: t(lang, 'In Progress', '進行中'),
    done:        t(lang, 'Done',        '已完成'),
    overdue:     t(lang, 'Overdue',     '逾期'),
  }

  return (
    <Html>
      <Head />
      <Preview>{t(lang, 'Your Daily Task Summary', '今日任務摘要')}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.h1}>
            {t(lang, 'Your tasks today', '今日任務摘要')}
          </Heading>
          <Text style={styles.intro}>
            {t(lang,
              `Hi ${user.name ?? user.email}, here are your assigned tasks for today.`,
              `${user.name ?? user.email} 您好，以下是今日指派給您的任務。`
            )}
          </Text>

          {tasks.length === 0 ? (
            <Text style={styles.muted}>
              {t(lang, 'No tasks assigned to you right now.', '目前沒有指派給您的任務。')}
            </Text>
          ) : (
            <Section>
              {tasks.map((task) => (
                <div key={task.id} style={styles.card}>
                  <Text style={styles.cardTitle}>{task.title}</Text>
                  <Text style={styles.cardMeta}>
                    {t(lang, 'Status', '狀態')}:{' '}
                    {STATUS_LABEL[task.status] ?? task.status}
                    {task.due_date
                      ? ` · ${t(lang, 'Due', '到期')}: ` +
                        new Date(task.due_date + 'T00:00:00').toLocaleDateString(locale, { month: 'short', day: 'numeric' })
                      : ''}
                  </Text>
                  <Link href={`${base}/${slug}/tasks?id=${task.id}`} style={styles.link}>
                    {t(lang, 'View task →', '查看任務 →')}
                  </Link>
                </div>
              ))}
            </Section>
          )}

          <Hr style={styles.hr} />
          <Text style={styles.footer}>
            {t(lang, 'Reply to this email to contact admin.', '如有問題，請回覆此郵件聯繫管理員。')}
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
