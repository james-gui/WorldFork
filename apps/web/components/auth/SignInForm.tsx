'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Github } from 'lucide-react';

export function SignInForm() {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    // Auth stub — no real authentication yet.
    setTimeout(() => {
      setLoading(false);
      toast.info('Auth coming soon', {
        description: 'Authentication is not yet wired up. Check back soon.',
      });
    }, 600);
  }

  return (
    <Card className="w-full max-w-sm shadow-lg">
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl">Sign in to WorldFork</CardTitle>
        <CardDescription>Enter your credentials to access your account.</CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link
            href="/runs/new"
            className="text-primary underline-offset-4 hover:underline"
          >
            Get started free →
          </Link>
        </p>
      </CardContent>

      <CardFooter className="flex flex-col gap-3 pt-0">
        <div className="flex w-full items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">Or continue with</span>
          <Separator className="flex-1" />
        </div>

        <div className="flex w-full gap-2">
          <Button variant="outline" className="flex-1" disabled title="GitHub auth coming soon">
            <Github className="mr-2 h-4 w-4" />
            GitHub
          </Button>
          <Button variant="outline" className="flex-1" disabled title="Google auth coming soon">
            {/* Simple G icon via text since lucide doesn't have Google */}
            <span className="mr-2 h-4 w-4 text-base leading-none font-semibold">G</span>
            Google
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
