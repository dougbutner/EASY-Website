/**
 * Intent-link share row for the Welcome Program — no clipboard API (avoids permission prompts).
 * Channels chosen for crypto / onboarding reach: Telegram, WhatsApp, X, email, SMS, native share.
 */
import { type ReactNode, useMemo, useState } from 'react';
import { Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const EASY_LIFE_RETURN_URL = 'https://flex.town/#easy-life';
const EASY_LIFE_WEBAUTH_URL = `https://webauth.com/?returnUrl=${encodeURIComponent(EASY_LIFE_RETURN_URL)}`;
const EASY_LIFE_SHARE_TITLE = 'Welcome loved ones to XPR Network';

export const EASY_LIFE_SHARE_TEXT = [
  EASY_LIFE_SHARE_TITLE,
  '',
  "When onboarding to the EASY life, challenge them to set up a wallet. If they do, hook them up with a Flex welcome package starting with EASY. If not, don't bug them, it's not time.",
  '',
  `Create a wallet: ${EASY_LIFE_WEBAUTH_URL}`,
  `EASY Life on Flex Town: ${EASY_LIFE_RETURN_URL}`,
].join('\n');

const shareIconClass = 'h-5 w-5';

function IconTelegram({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

function IconWhatsApp({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function IconX({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function IconMail({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16v12H4V6zm0 0 8 7 8-7" />
    </svg>
  );
}

function IconSms({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
      />
    </svg>
  );
}

type ShareChannel = {
  id: string;
  label: string;
  href: string;
  icon: ReactNode;
  hoverClass: string;
};

function buildShareChannels(text: string): ShareChannel[] {
  const params = new URLSearchParams({ url: EASY_LIFE_RETURN_URL, text });
  return [
    {
      id: 'telegram',
      label: 'Telegram',
      href: `https://t.me/share/url?${params.toString()}`,
      icon: <IconTelegram className={shareIconClass} />,
      hoverClass: 'hover:border-[#2AABEE]/60 hover:bg-[#2AABEE]/15 hover:text-[#2AABEE]',
    },
    {
      id: 'whatsapp',
      label: 'WhatsApp',
      href: `https://wa.me/?text=${encodeURIComponent(text)}`,
      icon: <IconWhatsApp className={shareIconClass} />,
      hoverClass: 'hover:border-[#25D366]/60 hover:bg-[#25D366]/15 hover:text-[#25D366]',
    },
    {
      id: 'x',
      label: 'X',
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
      icon: <IconX className={shareIconClass} />,
      hoverClass: 'hover:border-yellow-100/50 hover:bg-yellow-100/10 hover:text-yellow-50',
    },
    {
      id: 'email',
      label: 'Email',
      href: `mailto:?subject=${encodeURIComponent(EASY_LIFE_SHARE_TITLE)}&body=${encodeURIComponent(text)}`,
      icon: <IconMail className={shareIconClass} />,
      hoverClass: 'hover:border-yellow-300/50 hover:bg-yellow-300/15 hover:text-yellow-200',
    },
    {
      id: 'sms',
      label: 'Text message',
      href: `sms:?body=${encodeURIComponent(text)}`,
      icon: <IconSms className={shareIconClass} />,
      hoverClass: 'hover:border-emerald-400/50 hover:bg-emerald-400/10 hover:text-emerald-300',
    },
  ];
}

const iconButtonClass =
  'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-yellow-300/20 bg-black/60 text-yellow-100/90 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/50';

export function EasyLifeShareBar({ className }: { className?: string }) {
  const [nativeShareReady] = useState(
    () => typeof navigator !== 'undefined' && typeof navigator.share === 'function'
  );
  const channels = useMemo(() => buildShareChannels(EASY_LIFE_SHARE_TEXT), []);

  const nativeShare = async () => {
    if (!navigator.share) return;
    try {
      await navigator.share({
        title: EASY_LIFE_SHARE_TITLE,
        text: EASY_LIFE_SHARE_TEXT,
        url: EASY_LIFE_RETURN_URL,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
    }
  };

  return (
    <div className={cn(className)}>
      <div className="flex flex-wrap items-center gap-2.5" role="group" aria-label="Share welcome message">
        {channels.map((channel) => (
          <a
            key={channel.id}
            href={channel.href}
            target={channel.id === 'sms' ? undefined : '_blank'}
            rel={channel.id === 'sms' ? undefined : 'noopener noreferrer'}
            aria-label={`Share via ${channel.label}`}
            title={channel.label}
            className={cn(iconButtonClass, channel.hoverClass)}
          >
            {channel.icon}
          </a>
        ))}
        {nativeShareReady && (
          <button
            type="button"
            onClick={() => void nativeShare()}
            aria-label="Share with device apps"
            title="More apps"
            className={cn(iconButtonClass, 'hover:border-yellow-300/50 hover:bg-yellow-300/15 hover:text-yellow-200')}
          >
            <Share2 className={shareIconClass} aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}

