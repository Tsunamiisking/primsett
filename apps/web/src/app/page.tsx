import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-16 text-center">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            Primsett 💅
          </h1>
          <p className="mt-3 text-lg text-muted-foreground">
            Your personal booking assistant. Built for Nigerian beauty pros.
          </p>
        </div>

        <div className="space-y-3">
          <Button asChild size="lg" className="w-full">
            <Link href="/sign-up">Get your booking link — free</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="w-full">
            <Link href="/sign-in">Sign in</Link>
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-4 pt-4">
          {[
            { emoji: '📅', label: 'No more ghost bookings' },
            { emoji: '💰', label: 'Auto deposit collection' },
            { emoji: '📲', label: 'WhatsApp reminders' },
          ].map((item) => (
            <div key={item.label} className="text-center">
              <div className="text-2xl">{item.emoji}</div>
              <p className="mt-1 text-xs text-muted-foreground">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
