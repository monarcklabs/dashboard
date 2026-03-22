import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';
import { ThemeProvider } from './providers';
import { SettingsProvider } from './settings-provider';
import { AppShell } from '@/components/auth/AppShell';
import { APP_NAME } from '@/lib/branding';
import { getCurrentSession } from '@/lib/auth';

export const metadata: Metadata = {
  title: `${APP_NAME} -- Command Centre`,
  description: `${APP_NAME} AI Agent Management Dashboard`,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let session = null
  try {
    session = await getCurrentSession()
  } catch (err) {
    console.error('[RootLayout] getCurrentSession error:', err)
  }

  try {
    return (
      <html lang="en" data-theme="dark" suppressHydrationWarning>
        <body>
          <ClerkProvider>
            <ThemeProvider>
              <SettingsProvider>
                <AppShell session={session}>{children}</AppShell>
              </SettingsProvider>
            </ThemeProvider>
          </ClerkProvider>
        </body>
      </html>
    );
  } catch (err) {
    console.error('[RootLayout] render error:', err)
    return (
      <html lang="en">
        <body>
          <pre>Layout render error - check server logs</pre>
        </body>
      </html>
    );
  }
}
