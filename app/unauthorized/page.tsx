import Link from 'next/link'

export default async function UnauthorizedPage({
  searchParams,
}: {
  searchParams: Promise<{ requiredOrg?: string; activeOrg?: string }>
}) {
  const params = await searchParams
  const requiredOrg = params.requiredOrg?.trim() || 'this client'
  const activeOrg = params.activeOrg?.trim() || ''

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: 'var(--bg)' }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          borderRadius: '24px',
          border: '1px solid rgba(255,69,58,0.25)',
          background: 'linear-gradient(180deg, rgba(255,69,58,0.12), rgba(255,69,58,0.04))',
          boxShadow: 'var(--shadow-overlay)',
          padding: '28px',
          color: 'var(--text-primary)',
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: '24px',
            lineHeight: 1.1,
            fontWeight: 700,
          }}
        >
          You do not have access to this dashboard
        </h1>

        <p
          style={{
            marginTop: '14px',
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
          }}
        >
          This deployment only allows members of the Clerk organization{' '}
          <strong>{requiredOrg}</strong>.
          {activeOrg
            ? ` Your active organization is ${activeOrg}.`
            : ' You are signed in without the required organization active.'}
        </p>

        <div className="mt-6 flex gap-3">
          <Link
            href="/login"
            style={{
              minHeight: '42px',
              padding: '0 16px',
              borderRadius: '12px',
              border: '1px solid rgba(239,68,68,0.2)',
              background: 'rgba(239,68,68,0.12)',
              color: 'var(--text-primary)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            Return to login
          </Link>
        </div>
      </div>
    </div>
  )
}
