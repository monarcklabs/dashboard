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
  const session = await getCurrentSession()

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
}
