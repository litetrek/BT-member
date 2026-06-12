import {
  Html, Head, Body, Container, Preview,
  Heading, Text, Hr,
} from '@react-email/components'

export default function AnnouncementEmail({ message = '', senderName = '', eventName = 'BT Annual Event' }) {
  const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <Html>
      <Head />
      <Preview>Announcement · {eventName}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.h1}>Announcement</Heading>
          <Text style={styles.eventName}>{eventName}</Text>

          <div style={styles.messageBox}>
            <Text style={styles.message}>{message}</Text>
          </div>

          <Text style={styles.meta}>
            Posted by {senderName} on {date}
          </Text>

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
  h1:         { fontSize: '20px', color: '#111827', marginBottom: '4px' },
  eventName:  { fontSize: '13px', color: '#6b7280', marginTop: 0, marginBottom: '24px' },
  messageBox: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '20px', marginBottom: '16px' },
  message:    { color: '#111827', fontSize: '15px', lineHeight: '1.6', margin: 0 },
  meta:       { fontSize: '12px', color: '#9ca3af' },
  hr:         { margin: '24px 0', borderColor: '#e5e7eb' },
  footer:     { fontSize: '12px', color: '#9ca3af' },
}
