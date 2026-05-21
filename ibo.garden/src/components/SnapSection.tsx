import { cn } from '@/lib/utils';

export function SnapSection({
  id,
  eyebrow,
  title,
  children,
  className,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        'relative flex min-h-screen snap-start flex-col items-center justify-center overflow-hidden px-4 pb-12 pt-24 sm:px-6 lg:px-8',
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(64,145,108,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(64,145,108,0.05)_1px,transparent_1px)] bg-[size:64px_64px]" />
      <div className="relative z-10 mb-8 w-full max-w-6xl">
        <p className="text-sm font-black uppercase tracking-[0.32em] text-garden-moss">{eyebrow}</p>
        <h2 className="mt-3 max-w-4xl text-4xl font-black tracking-tight text-stone-50 sm:text-5xl lg:text-6xl">
          {title}
        </h2>
      </div>
      <div className="relative z-10 flex w-full justify-center">{children}</div>
    </section>
  );
}
