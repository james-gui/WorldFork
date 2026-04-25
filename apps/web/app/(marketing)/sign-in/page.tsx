import * as React from 'react';
import { SignInForm } from '@/components/auth/SignInForm';

// Page — /sign-in
// Provides a minimal sign-in card within the marketing layout.
export default function SignInPage() {
  return (
    <section className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4 py-16">
      <div className="flex w-full flex-col items-center gap-6">
        <h1 className="text-3xl font-bold tracking-tight">Sign in to WorldFork</h1>
        <SignInForm />
      </div>
    </section>
  );
}
