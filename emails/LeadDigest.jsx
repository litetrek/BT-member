import {
  Html, Head, Body, Container, Preview,
  Heading, Text, Section, Hr, Link,
} from '@react-email/components'
import { t } from '@/lib/lang'

const base = process.env.NEXT_PUBLIC_APP_URL || 'https://bt.cyber-tech.com'

export default function LeadDigestEmail({ user = {}, activity = {}, tasks = [], slug = '', lang = 'zh' }) {
  const locale = lang === 'en' ? 'en-US' : 'zh-TW'

  const STATUS_LABEL = {
    open:        t(lang, 'Not Started', '未開始'),
    in_progress: t(lang, 'In Progress', '進行中'),
    done:        t(lang, 'Done',        '已完成'),
  }
  const STATUS_COLOR = { open: '#6b7280', in_progress: '#d97706', done: '#16a34a' }

  const byStatus = {
    in_progress: tasks.filter((tk) => tk.status === 'in_progress'),
    open:        tasks.filter((tk) => tk.status === 'open'),
    done:        tasks.filter((tk) => tk.status === 'done'),
  }

  return (
    <Html>
      <Head />
      <Preview>{t(lang, 'Activity Summary', '活動摘要')} · {activity.name}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.h1}>
            {t(lang, 'Activity summary', '活動進度摘要')}
          </Heading>
          <Text style={styles.subtitle}>{activity.name}</Text>
          <Text style={styles.intro}>
            {t(lang,
              `Hi ${user.name ?? user.email}, here is the current status of tasks in your activity.`,
              `${user.name ?? user.email} 您好，以下是您負責活動的最新任務狀態。`
            )}
          </Text>

          {tasks.length === 0 ? (
            <Text style={styles.muted}>
              {t(lang, 'No tasks in this activity yet.', '此活動目前尚無任務。')}
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
                          ? `${t(lang, 'Due', '到期')}: ${new Date(task.due_date + 'T00:00:00').toLocaleDateString(locale, { month: 'short', day: 'numeric' })}`
                          : t(lang, 'No due date', '無到期日')}
                      </Text>
                      <Link href={`${base}/${slug}/tasks?id=${task.id}`} style={styles.link}>
                        {t(lang, 'View task →', '查看任務 →')}
                      </Link>
                    </div>
                  ))}
                </Section>
              ) : null
            )
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
